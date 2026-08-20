import type { AccessPermission } from './accessControl';
import { isJsonRecord, requestAdminJson } from './adminJson';

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
  return isJsonRecord(payload) && Array.isArray(payload.roles) && payload.roles.every(isCustomRole) && Array.isArray(payload.permissions) && payload.permissions.every(isGrantablePermission) && typeof payload.requestId === 'string';
}

function isCustomRole(value: unknown): value is CustomRole {
  return (
    hasStringFields(value, ['id', 'code', 'name', 'description', 'createdAt', 'updatedAt']) &&
    isOneOf(value.status, ['active', 'disabled']) &&
    typeof value.isSystem === 'boolean' &&
    typeof value.isOwner === 'boolean' &&
    typeof value.isEditable === 'boolean' &&
    isNonNegativeInteger(value.assignmentCount) &&
    isStringList(value.permissions)
  );
}

function isGrantablePermission(value: unknown): value is GrantablePermission {
  return hasStringFields(value, ['code', 'name', 'category']) && isOneOf(value.risk, ['low', 'elevated', 'high', 'critical']) && typeof value.mvp === 'boolean' && typeof value.grantable === 'boolean';
}

function hasStringFields(value: unknown, fields: string[]): value is Record<string, string> {
  return isJsonRecord(value) && fields.every((field) => typeof value[field] === 'string');
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
