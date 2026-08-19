import { createMemoryResource } from './memoryResource';
import { isJsonRecord, requestAdminJson } from './adminJson';

export interface MemberProfile {
  membershipId: string;
  memberId: string;
  userId: string;
  displayName: string;
  employeeNo: string;
  username: string | null;
  email: string | null;
  mobileMasked: string | null;
  phoneBound: boolean;
  departmentId: string | null;
  departmentName: string | null;
  target: 'storefront' | 'admin';
  status: string;
  authzVersion: number;
  isOwner: boolean;
  createdAt: string;
}
export interface MemberInvitation {
  id: string;
  label: string;
  target: 'storefront';
  maxUses: number;
  useCount: number;
  startsAt: string;
  expiresAt: string;
  status: string;
  createdAt: string;
}
export interface MemberImportJob {
  id: string;
  sourceName: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  errors: Array<{ rowNumber: number; code: string; message: string; input: Record<string, unknown> }>;
}
export interface MemberHistory {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorUserId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}
export interface MemberOperationsData {
  profiles: MemberProfile[];
  invitations: MemberInvitation[];
  imports: MemberImportJob[];
  history: MemberHistory[];
  departments: Array<{ id: string; name: string }>;
  requestId: string;
}
export interface NewMember {
  username: string;
  password: string;
  displayName: string;
  employeeNo?: string;
  email?: string;
  departmentId?: string;
}

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return requestAdminJson<T>(url, { label: '会员运营', ...init });
}
const jsonBody = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });

function isMemberOperationsData(payload: unknown): payload is MemberOperationsData {
  return (
    isJsonRecord(payload) &&
    Array.isArray(payload.profiles) &&
    payload.profiles.every(isMemberProfile) &&
    Array.isArray(payload.invitations) &&
    payload.invitations.every(isMemberInvitation) &&
    Array.isArray(payload.imports) &&
    payload.imports.every(isMemberImportJob) &&
    Array.isArray(payload.history) &&
    payload.history.every(isMemberHistory) &&
    Array.isArray(payload.departments) &&
    payload.departments.every((department) => hasStringFields(department, ['id', 'name'])) &&
    typeof payload.requestId === 'string'
  );
}

function isMemberProfile(value: unknown): value is MemberProfile {
  return (
    hasStringFields(value, ['membershipId', 'memberId', 'userId', 'displayName', 'employeeNo', 'status', 'createdAt']) &&
    isNullableString(value.username) &&
    isNullableString(value.email) &&
    isNullableString(value.mobileMasked) &&
    typeof value.phoneBound === 'boolean' &&
    isNullableString(value.departmentId) &&
    isNullableString(value.departmentName) &&
    isOneOf(value.target, ['storefront', 'admin']) &&
    isNonNegativeInteger(value.authzVersion) &&
    typeof value.isOwner === 'boolean'
  );
}

function isMemberInvitation(value: unknown): value is MemberInvitation {
  return hasStringFields(value, ['id', 'label', 'startsAt', 'expiresAt', 'status', 'createdAt']) && value.target === 'storefront' && isNonNegativeInteger(value.maxUses) && isNonNegativeInteger(value.useCount);
}

function isMemberImportJob(value: unknown): value is MemberImportJob {
  return (
    hasStringFields(value, ['id', 'sourceName', 'status', 'createdAt']) &&
    isNonNegativeInteger(value.totalRows) &&
    isNonNegativeInteger(value.successRows) &&
    isNonNegativeInteger(value.failedRows) &&
    Array.isArray(value.errors) &&
    value.errors.every((error) => isJsonRecord(error) && isNonNegativeInteger(error.rowNumber) && typeof error.code === 'string' && typeof error.message === 'string' && isJsonRecord(error.input))
  );
}

function isMemberHistory(value: unknown): value is MemberHistory {
  return isJsonRecord(value) && hasStringFields(value, ['id', 'action', 'resourceType', 'createdAt']) && isNullableString(value.resourceId) && isNullableString(value.actorUserId) && 'before' in value && 'after' in value;
}

function hasStringFields(value: unknown, fields: string[]): value is Record<string, string> {
  return isJsonRecord(value) && fields.every((field) => typeof value[field] === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

const memberOperationsResource = createMemoryResource(() => requestAdminJson<MemberOperationsData>('/api/v1/admin/member-operations', { label: '会员运营', validate: isMemberOperationsData }));

export function cachedMemberOperations(): MemberOperationsData | null {
  return memberOperationsResource.peek();
}
export function preloadMemberOperations(): void {
  memberOperationsResource.prefetch();
}
export function loadMemberOperations(options?: { force?: boolean }) {
  return memberOperationsResource.load(options);
}
export function createInvitation(value: { label: string; maxUses: number; expiresAt: string }) {
  return requestJson<MemberInvitation & { code: string }>('/api/v1/admin/member-operations/invitations', jsonBody(value));
}
export function disableInvitation(id: string, reason: string) {
  return requestJson(`/api/v1/admin/member-operations/invitations/${encodeURIComponent(id)}`, { ...jsonBody({ reason }), method: 'PUT' });
}
export function createMember(value: NewMember) {
  return requestJson('/api/v1/admin/member-operations/members', jsonBody(value));
}
export function updateMemberProfile(membershipId: string, value: { displayName: string; email?: string; departmentId?: string; reason: string }) {
  return requestJson(`/api/v1/admin/member-operations/members/${encodeURIComponent(membershipId)}`, { ...jsonBody(value), method: 'PUT' });
}
export function importMembers(sourceName: string, rows: NewMember[]) {
  return requestJson<{ id: string; status: string; totalRows: number; successRows: number; failedRows: number; errors: Array<{ rowNumber: number; code: string; message: string }> }>(
    '/api/v1/admin/member-operations/imports',
    jsonBody({ sourceName, rows })
  );
}
