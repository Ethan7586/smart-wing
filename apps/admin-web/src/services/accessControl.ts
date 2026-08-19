import { createMemoryResource } from './memoryResource';
import { isJsonRecord, requestAdminJson } from './adminJson';

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

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return requestAdminJson<T>(url, { label: '权限服务', ...init });
}

function isAccessControlData(payload: unknown): payload is AccessControlData {
  return (
    isJsonRecord(payload) &&
    Array.isArray(payload.members) &&
    payload.members.every(isAccessMember) &&
    Array.isArray(payload.roles) &&
    payload.roles.every(isAccessRole) &&
    Array.isArray(payload.permissions) &&
    payload.permissions.every(isAccessPermission) &&
    isScopeOptions(payload.scopeOptions) &&
    typeof payload.requestId === 'string'
  );
}

function isAccessMember(value: unknown): value is AccessMember {
  return (
    hasStringFields(value, ['membershipId', 'memberId', 'displayName', 'employeeNo']) &&
    isNullableString(value.email) &&
    isNullableString(value.mobileMasked) &&
    isOneOf(value.target, ['storefront', 'admin']) &&
    isOneOf(value.status, ['invited', 'active', 'suspended', 'offboarded', 'expired']) &&
    isNonNegativeInteger(value.authzVersion) &&
    typeof value.isSelf === 'boolean' &&
    typeof value.isOwner === 'boolean' &&
    Array.isArray(value.roles) &&
    value.roles.every((role) => hasStringFields(role, ['id', 'code', 'name'])) &&
    Array.isArray(value.scopes) &&
    value.scopes.every(isAccessScope) &&
    isStringList(value.deniedPermissions)
  );
}

function isAccessRole(value: unknown): value is AccessRole {
  return (
    hasStringFields(value, ['id', 'code', 'name', 'description']) &&
    isOneOf(value.status, ['active', 'disabled']) &&
    typeof value.isSystem === 'boolean' &&
    typeof value.isOwner === 'boolean' &&
    typeof value.isEditable === 'boolean' &&
    isStringList(value.permissions)
  );
}

function isAccessPermission(value: unknown): value is AccessPermission {
  return hasStringFields(value, ['code', 'name', 'category']) && isOneOf(value.risk, ['low', 'elevated', 'high', 'critical']) && typeof value.mvp === 'boolean';
}

function isAccessScope(value: unknown): value is AccessScope {
  return hasStringFields(value, ['resourceId']) && isOneOf(value.kind, ['platform', 'tenant', 'distributor', 'enterprise', 'mall', 'supplier', 'brand', 'store', 'department', 'self']);
}

function isScopeOptions(value: unknown): value is AccessControlData['scopeOptions'] {
  return isJsonRecord(value) && Object.values(value).every((options) => Array.isArray(options) && options.every((option) => hasStringFields(option, ['id', 'name'])));
}

function hasStringFields(value: unknown, keys: string[]): value is Record<string, string> {
  return isJsonRecord(value) && keys.every((key) => typeof value[key] === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
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

const accessControlResource = createMemoryResource(() => requestAdminJson<AccessControlData>('/api/v1/admin/access-control', { label: '权限服务', validate: isAccessControlData }));

export function cachedAccessControl(): AccessControlData | null {
  return accessControlResource.peek();
}
export function preloadAccessControl(): void {
  accessControlResource.prefetch();
}
export function loadAccessControl(options?: { force?: boolean }): Promise<AccessControlData> {
  return accessControlResource.load(options);
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
