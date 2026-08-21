-- W2 operations MVP modules.  This migration only introduces server-owned
-- records and RPC read/write boundaries; it intentionally does not seed
-- channels, commissions, partner connections, or catalogue import results.

create table if not exists public.admin_control_settings (
  tenant_id text not null,
  mall_id text not null,
  operations_notice text not null default '' check (char_length(operations_notice) <= 600),
  order_attention_threshold integer not null default 0 check (order_attention_threshold between 0 and 100000),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by_user_id text,
  primary key (tenant_id, mall_id)
);

create table if not exists public.admin_control_setting_commands (
  tenant_id text not null,
  mall_id text not null,
  idempotency_key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, mall_id, idempotency_key)
);

create table if not exists public.distribution_channels (
  id text primary key default ('channel-' || replace(gen_random_uuid()::text, '-', '')),
  tenant_id text not null,
  enterprise_id text not null,
  mall_id text not null,
  distributor_id text,
  code text not null check (code ~ '^[A-Z0-9_-]{2,64}$'),
  name text not null check (char_length(name) between 2 and 120),
  source_reference text not null default '' check (char_length(source_reference) <= 200),
  status text not null default 'pending_setup' check (status in ('pending_setup', 'active', 'paused', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id text,
  unique (tenant_id, mall_id, code)
);

create table if not exists public.distribution_channel_commands (
  tenant_id text not null,
  mall_id text not null,
  idempotency_key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, mall_id, idempotency_key)
);

create table if not exists public.distribution_order_attributions (
  id text primary key default ('channel-order-' || replace(gen_random_uuid()::text, '-', '')),
  tenant_id text not null,
  mall_id text not null,
  channel_id text not null references public.distribution_channels(id) on delete restrict,
  order_id text not null references public.orders(id) on delete restrict,
  commission_status text not null default 'pending_source' check (commission_status in ('not_ready', 'pending_source', 'calculated', 'locked')),
  source_reference text not null default '' check (char_length(source_reference) <= 200),
  recorded_at timestamptz not null default now(),
  unique (channel_id, order_id)
);

create index if not exists idx_distribution_channels_scope
  on public.distribution_channels (tenant_id, enterprise_id, mall_id, status, created_at desc);
create index if not exists idx_distribution_order_attributions_scope
  on public.distribution_order_attributions (tenant_id, mall_id, channel_id, recorded_at desc);

create table if not exists public.partner_catalog_connections (
  id text primary key default ('partner-catalog-' || replace(gen_random_uuid()::text, '-', '')),
  tenant_id text not null,
  mall_id text not null,
  provider_code text not null check (provider_code ~ '^[a-z][a-z0-9_-]{1,63}$'),
  display_name text not null check (char_length(display_name) between 2 and 120),
  external_catalog_reference text not null default '' check (char_length(external_catalog_reference) <= 200),
  status text not null default 'pending_credentials' check (status in ('pending_credentials', 'awaiting_approval', 'active', 'disabled', 'error')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id text,
  unique (tenant_id, mall_id, provider_code)
);

create table if not exists public.partner_catalog_connection_commands (
  tenant_id text not null,
  mall_id text not null,
  idempotency_key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, mall_id, idempotency_key)
);

create table if not exists public.partner_catalog_sync_runs (
  id text primary key default ('partner-sync-' || replace(gen_random_uuid()::text, '-', '')),
  connection_id text not null references public.partner_catalog_connections(id) on delete restrict,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'blocked')),
  source_item_count integer check (source_item_count is null or source_item_count >= 0),
  imported_item_count integer check (imported_item_count is null or imported_item_count >= 0),
  message text not null default '' check (char_length(message) <= 600),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_catalog_connections_scope
  on public.partner_catalog_connections (tenant_id, mall_id, status, created_at desc);
create index if not exists idx_partner_catalog_sync_runs_connection
  on public.partner_catalog_sync_runs (connection_id, created_at desc);

create or replace function public.api_admin_control_center(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'sales', public.api_admin_sales_overview_scoped(p_tenant_id, p_enterprise_id, p_mall_id, p_user_id),
    'settings', coalesce(
      (
        select jsonb_build_object(
          'configured', true,
          'operationsNotice', settings.operations_notice,
          'orderAttentionThreshold', settings.order_attention_threshold,
          'version', settings.version,
          'updatedAt', settings.updated_at
        )
        from public.admin_control_settings settings
        where settings.tenant_id = p_tenant_id and settings.mall_id = p_mall_id
      ),
      jsonb_build_object('configured', false, 'operationsNotice', null, 'orderAttentionThreshold', null, 'version', 0, 'updatedAt', null)
    )
  );
$$;

create or replace function public.api_save_admin_control_settings(
  p_tenant_id text,
  p_mall_id text,
  p_actor_user_id text,
  p_expected_version integer,
  p_operations_notice text,
  p_order_attention_threshold integer,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_command public.admin_control_setting_commands%rowtype;
  current_settings public.admin_control_settings%rowtype;
  result jsonb;
begin
  select * into existing_command
  from public.admin_control_setting_commands
  where tenant_id = p_tenant_id and mall_id = p_mall_id and idempotency_key = p_idempotency_key;
  if found then
    if existing_command.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return existing_command.response;
  end if;

  select * into current_settings
  from public.admin_control_settings
  where tenant_id = p_tenant_id and mall_id = p_mall_id
  for update;
  if found and current_settings.version <> p_expected_version then raise exception 'CONTROL_SETTINGS_VERSION_CONFLICT'; end if;
  if not found and p_expected_version <> 0 then raise exception 'CONTROL_SETTINGS_VERSION_CONFLICT'; end if;

  insert into public.admin_control_settings (tenant_id, mall_id, operations_notice, order_attention_threshold, version, updated_at, updated_by_user_id)
  values (p_tenant_id, p_mall_id, p_operations_notice, p_order_attention_threshold, 1, now(), p_actor_user_id)
  on conflict (tenant_id, mall_id) do update
  set operations_notice = excluded.operations_notice,
      order_attention_threshold = excluded.order_attention_threshold,
      version = public.admin_control_settings.version + 1,
      updated_at = now(),
      updated_by_user_id = excluded.updated_by_user_id
  returning jsonb_build_object(
    'configured', true,
    'operationsNotice', operations_notice,
    'orderAttentionThreshold', order_attention_threshold,
    'version', version,
    'updatedAt', updated_at
  ) into result;

  insert into public.admin_control_setting_commands (tenant_id, mall_id, idempotency_key, request_hash, response)
  values (p_tenant_id, p_mall_id, p_idempotency_key, p_request_hash, result);
  return result;
end;
$$;

create or replace function public.api_distribution_hub(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', channel.id,
        'code', channel.code,
        'name', channel.name,
        'status', channel.status,
        'distributorId', channel.distributor_id,
        'sourceReference', channel.source_reference,
        'createdAt', channel.created_at,
        'updatedAt', channel.updated_at
      ) order by channel.created_at desc), '[]'::jsonb)
      from public.distribution_channels channel
      where channel.tenant_id = p_tenant_id and channel.enterprise_id = p_enterprise_id and channel.mall_id = p_mall_id
    ),
    'orderAttributions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', attribution.id,
        'channelId', attribution.channel_id,
        'channelName', channel.name,
        'orderId', attribution.order_id,
        'orderNo', orders.order_no,
        'orderStatus', orders.status,
        'commissionStatus', attribution.commission_status,
        'recordedAt', attribution.recorded_at
      ) order by attribution.recorded_at desc), '[]'::jsonb)
      from (
        select * from public.distribution_order_attributions
        where tenant_id = p_tenant_id and mall_id = p_mall_id
        order by recorded_at desc
        limit 100
      ) attribution
      join public.distribution_channels channel on channel.id = attribution.channel_id
      join public.orders orders on orders.id = attribution.order_id
    )
  );
$$;

create or replace function public.api_create_distribution_channel(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_actor_user_id text,
  p_code text,
  p_name text,
  p_distributor_id text,
  p_source_reference text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_command public.distribution_channel_commands%rowtype;
  result jsonb;
begin
  select * into existing_command
  from public.distribution_channel_commands
  where tenant_id = p_tenant_id and mall_id = p_mall_id and idempotency_key = p_idempotency_key;
  if found then
    if existing_command.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return existing_command.response;
  end if;

  insert into public.distribution_channels (tenant_id, enterprise_id, mall_id, distributor_id, code, name, source_reference, status, created_by_user_id)
  values (p_tenant_id, p_enterprise_id, p_mall_id, nullif(p_distributor_id, ''), p_code, p_name, p_source_reference, 'pending_setup', p_actor_user_id)
  returning jsonb_build_object(
    'id', id, 'code', code, 'name', name, 'status', status,
    'distributorId', distributor_id, 'sourceReference', source_reference,
    'createdAt', created_at, 'updatedAt', updated_at
  ) into result;
  insert into public.distribution_channel_commands (tenant_id, mall_id, idempotency_key, request_hash, response)
  values (p_tenant_id, p_mall_id, p_idempotency_key, p_request_hash, result);
  return result;
end;
$$;

create or replace function public.api_partner_catalog_hub(
  p_tenant_id text,
  p_mall_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'connections', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', connection.id,
        'providerCode', connection.provider_code,
        'displayName', connection.display_name,
        'externalCatalogReference', connection.external_catalog_reference,
        'status', connection.status,
        'lastCheckedAt', connection.last_checked_at,
        'createdAt', connection.created_at,
        'updatedAt', connection.updated_at
      ) order by connection.created_at desc), '[]'::jsonb)
      from public.partner_catalog_connections connection
      where connection.tenant_id = p_tenant_id and connection.mall_id = p_mall_id
    ),
    'syncRuns', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', run.id,
        'connectionId', run.connection_id,
        'displayName', connection.display_name,
        'status', run.status,
        'sourceItemCount', run.source_item_count,
        'importedItemCount', run.imported_item_count,
        'message', run.message,
        'startedAt', run.started_at,
        'finishedAt', run.finished_at,
        'createdAt', run.created_at
      ) order by run.created_at desc), '[]'::jsonb)
      from (
        select run.*
        from public.partner_catalog_sync_runs run
        join public.partner_catalog_connections connection on connection.id = run.connection_id
        where connection.tenant_id = p_tenant_id and connection.mall_id = p_mall_id
        order by run.created_at desc
        limit 100
      ) run
      join public.partner_catalog_connections connection on connection.id = run.connection_id
    ),
    'catalogPools', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pool.id,
        'code', pool.code,
        'name', pool.name,
        'status', pool.status,
        'itemCount', (select count(*) from public.catalog_pool_items item where item.pool_id = pool.id and item.status = 'active')
      ) order by pool.code), '[]'::jsonb)
      from public.catalog_pools pool
      where pool.tenant_id = p_tenant_id and pool.owner_kind = 'mall' and pool.owner_id = p_mall_id
    )
  );
$$;

create or replace function public.api_create_partner_catalog_connection(
  p_tenant_id text,
  p_mall_id text,
  p_actor_user_id text,
  p_provider_code text,
  p_display_name text,
  p_external_catalog_reference text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_command public.partner_catalog_connection_commands%rowtype;
  result jsonb;
begin
  select * into existing_command
  from public.partner_catalog_connection_commands
  where tenant_id = p_tenant_id and mall_id = p_mall_id and idempotency_key = p_idempotency_key;
  if found then
    if existing_command.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return existing_command.response;
  end if;

  insert into public.partner_catalog_connections (tenant_id, mall_id, provider_code, display_name, external_catalog_reference, status, created_by_user_id)
  values (p_tenant_id, p_mall_id, p_provider_code, p_display_name, p_external_catalog_reference, 'pending_credentials', p_actor_user_id)
  returning jsonb_build_object(
    'id', id, 'providerCode', provider_code, 'displayName', display_name,
    'externalCatalogReference', external_catalog_reference, 'status', status,
    'lastCheckedAt', last_checked_at, 'createdAt', created_at, 'updatedAt', updated_at
  ) into result;
  insert into public.partner_catalog_connection_commands (tenant_id, mall_id, idempotency_key, request_hash, response)
  values (p_tenant_id, p_mall_id, p_idempotency_key, p_request_hash, result);
  return result;
end;
$$;

revoke all on function public.api_admin_control_center(text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_save_admin_control_settings(text, text, text, integer, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.api_distribution_hub(text, text, text) from public, anon, authenticated;
revoke all on function public.api_create_distribution_channel(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.api_partner_catalog_hub(text, text) from public, anon, authenticated;
revoke all on function public.api_create_partner_catalog_connection(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.api_admin_control_center(text, text, text, text) to service_role;
grant execute on function public.api_save_admin_control_settings(text, text, text, integer, text, integer, text, text) to service_role;
grant execute on function public.api_distribution_hub(text, text, text) to service_role;
grant execute on function public.api_create_distribution_channel(text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.api_partner_catalog_hub(text, text) to service_role;
grant execute on function public.api_create_partner_catalog_connection(text, text, text, text, text, text, text, text) to service_role;
