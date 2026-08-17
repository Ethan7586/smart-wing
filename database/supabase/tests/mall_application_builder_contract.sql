begin;

do $$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);
  config jsonb:=public.api_default_mall_application_config('契约测试商城');
  created jsonb; saved jsonb; replayed jsonb; published jsonb; restored jsonb;
  new_mall_id text; initial_version_id text; immutable_error text;
begin
  created:=public.api_mutate_mall_application(
    'create','tenant-smart-wing','enterprise-demo','mall-demo','user-test-manager','membership-test-manager-admin','',
    jsonb_build_object('code','CONTRACT_'||upper(suffix),'publicSlug','contract-'||lower(suffix),'name','契约测试商城','config',config),
    0,'','复制页面配置建立契约商城','mall-create-'||suffix,'hash-create-'||suffix,'mall-create-contract','contract-test'
  );
  new_mall_id:=created->>'mallId';
  if created->>'status'<>'created' or not exists(
    select 1 from public.malls where id=new_mall_id and status='disabled'
  ) then raise exception 'CONTRACT_MALL_NOT_CREATED_AS_DRAFT'; end if;
  select published_version_id into initial_version_id from public.mall_application_heads where mall_id=new_mall_id;
  if (select count(*) from public.mall_application_versions where mall_id=new_mall_id)<>2 then
    raise exception 'CONTRACT_INITIAL_VERSIONS_INVALID';
  end if;
  if exists(select 1 from public.memberships where mall_id=new_mall_id)
    or exists(select 1 from public.welfare_accounts where mall_id=new_mall_id)
    or exists(select 1 from public.orders where mall_id=new_mall_id) then
    raise exception 'CONTRACT_TRANSACTIONAL_DATA_WAS_COPIED';
  end if;

  config:=config||jsonb_build_object(
    'mallDisplayName','契约自定义商城',
    'announcement','契约测试公告仅在发布后可见'
  );
  saved:=public.api_mutate_mall_application(
    'save','tenant-smart-wing','enterprise-demo','mall-demo','user-test-manager','membership-test-manager-admin',new_mall_id,
    config,1,'','保存契约商城页面草稿','mall-save-'||suffix,'hash-save-'||suffix,'mall-save-contract','contract-test'
  );
  replayed:=public.api_mutate_mall_application(
    'save','tenant-smart-wing','enterprise-demo','mall-demo','user-test-manager','membership-test-manager-admin',new_mall_id,
    config,1,'','保存契约商城页面草稿','mall-save-'||suffix,'hash-save-'||suffix,'mall-save-replay','contract-test'
  );
  if saved<>replayed or saved->>'rowVersion'<>'2' then raise exception 'CONTRACT_IDEMPOTENCY_OR_VERSION_FAILED'; end if;
  if public.api_mall_application_experience('tenant-smart-wing',new_mall_id) is not null then
    raise exception 'CONTRACT_DRAFT_MALL_BECAME_PUBLIC';
  end if;

  published:=public.api_mutate_mall_application(
    'publish','tenant-smart-wing','enterprise-demo','mall-demo','user-test-manager','membership-test-manager-admin',new_mall_id,
    '{}'::jsonb,2,'','发布契约商城页面版本','mall-publish-'||suffix,'hash-publish-'||suffix,'mall-publish-contract','contract-test'
  );
  if published->>'rowVersion'<>'3'
    or public.api_mall_application_experience('tenant-smart-wing',new_mall_id)->>'announcement'<>'契约测试公告仅在发布后可见' then
    raise exception 'CONTRACT_PUBLISHED_EXPERIENCE_INVALID';
  end if;

  restored:=public.api_mutate_mall_application(
    'restore','tenant-smart-wing','enterprise-demo','mall-demo','user-test-manager','membership-test-manager-admin',new_mall_id,
    '{}'::jsonb,3,initial_version_id,'恢复初始页面为新草稿','mall-restore-'||suffix,'hash-restore-'||suffix,'mall-restore-contract','contract-test'
  );
  if restored->>'rowVersion'<>'4'
    or public.api_mall_application_experience('tenant-smart-wing',new_mall_id)->>'announcement'<>'契约测试公告仅在发布后可见' then
    raise exception 'CONTRACT_RESTORE_CHANGED_PUBLISHED_VERSION';
  end if;
  if not exists(select 1 from public.audit_logs where mall_id=new_mall_id and action='mall.application.publish') then
    raise exception 'CONTRACT_MALL_AUDIT_MISSING';
  end if;

  begin
    update public.mall_application_versions set reason='篡改历史版本' where id=initial_version_id;
    raise exception 'CONTRACT_IMMUTABLE_VERSION_CHANGED';
  exception when others then
    get stacked diagnostics immutable_error=message_text;
    if immutable_error not like '%mall_application_versions_IS_IMMUTABLE%' then raise; end if;
  end;
end;
$$;

rollback;
