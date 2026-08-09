-- Retire the pre-membership permission vocabulary. Runtime authorization uses
-- dot-separated @smart-wing/api-contract permission codes exclusively.
-- This removes the stale financial grants observed on role-mall-admin.
delete from public.role_permissions rp
using public.permissions p
where rp.permission_id = p.id
  and p.code in ('finance:refund', 'finance:reconcile', 'order:read:own');

-- Existing mall-admin sessions must be rejected and re-issued against the
-- cleaned role graph on their next request.
update public.memberships membership
set authz_version = authz_version + 1,
    updated_at = now()
where exists (
  select 1
  from public.membership_roles membership_role
  where membership_role.membership_id = membership.id
    and membership_role.role_id = 'role-mall-admin'
    and membership_role.revoked_at is null
);
