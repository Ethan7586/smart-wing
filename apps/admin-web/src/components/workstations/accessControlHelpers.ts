import type { AccessMember, AccessPermission, AccessRole, AccessScope, PermissionRisk } from '../../services/accessControl';

export const RISK_LABELS: Record<PermissionRisk, string> = { low: '普通', elevated: '关注', high: '高风险', critical: '核心风险' };
export const SCOPE_LABELS: Record<AccessScope['kind'], string> = { tenant: '整个平台', distributor: '分销商', enterprise: '集团企业', mall: '商城', supplier: '供应商', brand: '品牌', store: '门店', department: '部门', self: '仅本人' };

export function effectivePermissionCodes(member: AccessMember, roles: AccessRole[]): Set<string> {
  const denied = new Set(member.deniedPermissions);
  return new Set(
    roles
      .filter((role) => member.roles.some((assigned) => assigned.id === role.id))
      .flatMap((role) => role.permissions)
      .filter((permission) => !denied.has(permission))
  );
}

export function permissionsByCategory(permissions: AccessPermission[]): Array<[string, AccessPermission[]]> {
  const grouped = new Map<string, AccessPermission[]>();
  for (const permission of permissions) grouped.set(permission.category, [...(grouped.get(permission.category) ?? []), permission]);
  return [...grouped.entries()];
}

export function memberSearchText(member: AccessMember): string {
  return [member.displayName, member.employeeNo, member.email, ...member.roles.map((role) => role.name)].filter(Boolean).join(' ').toLowerCase();
}
