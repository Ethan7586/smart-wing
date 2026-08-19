import { createMemoryResource } from './memoryResource';
import { hasArrayProperties, requestAdminJson } from './adminJson';

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
  return hasArrayProperties(payload, ['profiles', 'invitations', 'imports', 'history', 'departments']) && typeof payload.requestId === 'string';
}

const memberOperationsResource = createMemoryResource(() =>
  requestAdminJson<MemberOperationsData>('/api/v1/admin/member-operations', { label: '会员运营', validate: isMemberOperationsData })
);

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
