import type { AccessPermission } from './accessControl';
import { hasArrayProperties, requestAdminJson } from './adminJson';

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

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return requestAdminJson<T>(url, { label: '角色服务', ...init });
}
export function loadCustomRoles(): Promise<CustomRoleCenterData> {
  return requestAdminJson('/api/v1/admin/roles', { label: '角色服务', validate: isCustomRoleCenterData });
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

function isCustomRoleCenterData(payload: unknown): payload is CustomRoleCenterData {
  return hasArrayProperties(payload, ['roles', 'permissions']) && typeof payload.requestId === 'string';
}
