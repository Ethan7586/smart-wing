#!/usr/bin/env bash
set -euo pipefail

# Apply the append-only mall application builder schema to the current Supabase
# database. The database password is read from the operator's terminal and is
# never stored in this repository, a process list, or a command history.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration_file="${1:-$repo_root/database/supabase/migrations/20260818120000_mall_application_builder.sql}"
backup_root="${SMART_WING_BACKUP_ROOT:-/opt/smart-wing-backups}"
project_ref="${SUPABASE_PROJECT_REF:-hiymcddxofngbenxwean}"
pooler_host="${SUPABASE_POOLER_HOST:-aws-0-ap-southeast-1.pooler.supabase.com}"
database="host=$pooler_host port=5432 dbname=postgres user=postgres.$project_ref sslmode=require connect_timeout=20"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_root/pre-mall-application-builder-$timestamp.dump"
success_marker="$backup_root/mall-application-builder-$timestamp.ok"

if [[ ! -r "$migration_file" ]]; then
  echo "Migration file is not readable: $migration_file" >&2
  exit 1
fi

if [[ ! -t 0 ]]; then
  echo "Run this script from an interactive terminal so the database password can be entered privately." >&2
  exit 1
fi

install -d -m 0700 "$backup_root"
read -r -s -p "Supabase database password: " database_password
echo
export PGPASSWORD="$database_password"
unset database_password
trap 'unset PGPASSWORD' EXIT

echo "Checking database connection and required base schema..."
psql "$database" -v ON_ERROR_STOP=1 -X -qAt <<'SQL'
select case
  when to_regclass('public.malls') is null then 1/0
  when to_regclass('public.memberships') is null then 1/0
  when to_regclass('public.idempotency_keys') is null then 1/0
  when to_regclass('public.audit_logs') is null then 1/0
  else 1
end;
SQL

echo "Creating recoverable public-schema backup: $backup_file"
pg_dump "$database" \
  --format=custom \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file="$backup_file"
chmod 0600 "$backup_file"

echo "Applying mall application builder migration in one transaction..."
psql "$database" \
  --single-transaction \
  -v ON_ERROR_STOP=1 \
  -X \
  --file="$migration_file"

echo "Verifying tables, functions, version heads, permissions and references..."
psql "$database" -v ON_ERROR_STOP=1 -X <<'SQL'
do $$
declare
  mall_count bigint;
  head_count bigint;
  invalid_head_count bigint;
  permission_count bigint;
begin
  if to_regclass('public.mall_application_versions') is null
     or to_regclass('public.mall_application_heads') is null then
    raise exception 'mall application tables are missing';
  end if;

  if to_regprocedure('public.api_mall_application_center(text,text,text)') is null
     or to_regprocedure('public.api_mall_application_experience(text,text)') is null
     or to_regprocedure('public.api_mutate_mall_application(text,text,text,text,text,text,text,jsonb,bigint,text,text,text,text,text,text)') is null then
    raise exception 'mall application RPCs are missing';
  end if;

  select count(*) into mall_count from public.malls;
  select count(*) into head_count from public.mall_application_heads;
  if head_count <> mall_count then
    raise exception 'head backfill mismatch: malls %, heads %', mall_count, head_count;
  end if;

  select count(*) into invalid_head_count
  from public.mall_application_heads h
  left join public.mall_application_versions d on d.id = h.draft_version_id and d.mall_id = h.mall_id
  left join public.mall_application_versions p on p.id = h.published_version_id and p.mall_id = h.mall_id
  where d.id is null or p.id is null;
  if invalid_head_count <> 0 then
    raise exception 'invalid mall application head references: %', invalid_head_count;
  end if;

  select count(*) into permission_count
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id
  where (r.code = 'enterprise_manager' and p.code in ('mall.read','mall.manage','mall.decorate','mall.publish'))
     or (r.code = 'mall_admin' and p.code in ('mall.read','mall.decorate','mall.publish'))
     or (r.code = 'test_admin' and p.code in ('mall.read','mall.decorate'));
  if permission_count < 9 then
    raise exception 'expected role permissions were not installed: % of 9', permission_count;
  end if;
end $$;

notify pgrst, 'reload schema';
SQL

cat >"$success_marker" <<EOF
applied_at=$timestamp
migration=$(basename "$migration_file")
backup=$backup_file
EOF
chmod 0600 "$success_marker"

echo "Migration verified successfully."
echo "Rollback backup: $backup_file"
echo "Success marker: $success_marker"
