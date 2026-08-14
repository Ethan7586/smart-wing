import type { AccessPermission } from './accessControl';

export interface CustomRole {
  id: string;
  code: string;
  name: string;
  description: string;
  status: 'active' | 'disabled';
  isSystem: boolean;
  isOwner: boolean;
  isEditable: boolean;
  assignmentCount: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}
export interface GrantablePermission extends AccessPermission {
  grantable: boolean;
}
export interface CustomRoleCenterData {
  roles: CustomRole[];
  permissions: GrantablePermission[];
  requestId: string;
}
export interface CustomRoleInput {
  code?: string;
  name: string;
  description: string;
  permissionCodes: string[];
  sourceRoleId?: string | null;
  reason: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? `角色服务请求失败 (${response.status})`);
  return payload as T;
}
export function loadCustomRoles(): Promise<CustomRoleCenterData> {
  return requestJson('/api/v1/admin/roles');
}
export function createCustomRole(input: CustomRoleInput): Promise<CustomRole> {
  return requestJson('/api/v1/admin/roles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
}
export function updateCustomRole(roleId: string, input: CustomRoleInput): Promise<CustomRole> {
  return requestJson(`/api/v1/admin/roles/${encodeURIComponent(roleId)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
}
export function setCustomRoleStatus(roleId: string, status: 'active' | 'disabled', reason: string): Promise<CustomRole> {
  return requestJson(`/api/v1/admin/roles/${encodeURIComponent(roleId)}/status`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, reason }) });
}
