export type PermissionRisk = 'low' | 'elevated' | 'high' | 'critical';
export type ScopeKind = 'platform' | 'tenant' | 'distributor' | 'enterprise' | 'mall' | 'supplier' | 'brand' | 'store' | 'department' | 'self';
export interface AccessRole {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  isOwner: boolean;
  isEditable: boolean;
  status: 'active' | 'disabled';
  permissions: string[];
}
export interface AccessPermission {
  code: string;
  name: string;
  category: string;
  risk: PermissionRisk;
  mvp: boolean;
}
export interface AccessScope {
  kind: ScopeKind;
  resourceId: string;
}
export interface AccessMember {
  membershipId: string;
  memberId: string;
  displayName: string;
  employeeNo: string;
  email: string | null;
  mobileMasked: string | null;
  target: 'storefront' | 'admin';
  status: 'invited' | 'active' | 'suspended' | 'offboarded' | 'expired';
  authzVersion: number;
  isSelf: boolean;
  isOwner: boolean;
  roles: Array<{ id: string; code: string; name: string }>;
  scopes: AccessScope[];
  deniedPermissions: string[];
}
export interface ScopeOption {
  id: string;
  name: string;
}
export interface AccessControlData {
  members: AccessMember[];
  roles: AccessRole[];
  permissions: AccessPermission[];
  scopeOptions: Partial<Record<ScopeKind, ScopeOption[]>>;
  requestId: string;
}
export interface AccessUpdate {
  roleIds: string[];
  scopes: AccessScope[];
  deniedPermissions: string[];
  reason: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? `权限服务请求失败 (${response.status})`);
  return payload as T;
}

export function loadAccessControl(): Promise<AccessControlData> {
  return requestJson('/api/v1/admin/access-control');
}

export function updateMemberAccess(membershipId: string, update: AccessUpdate): Promise<Record<string, unknown>> {
  return requestJson(`/api/v1/admin/memberships/${encodeURIComponent(membershipId)}/access`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(update),
  });
}

export function updateMemberStatus(membershipId: string, status: 'active' | 'suspended' | 'offboarded', reason: string): Promise<Record<string, unknown>> {
  return requestJson(`/api/v1/admin/memberships/${encodeURIComponent(membershipId)}/status`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  });
}

export function verifyCurrentPassword(password: string): Promise<{ verified: true; verifiedAt: string }> {
  return requestJson('/api/v1/auth/step-up', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
}
