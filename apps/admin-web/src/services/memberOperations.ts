import { createMemoryResource } from './memoryResource';

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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 207) throw new Error(payload?.error?.message ?? `会员运营请求失败 (${response.status})`);
  return payload as T;
}
const jsonBody = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });

const memberOperationsResource = createMemoryResource(() => requestJson<MemberOperationsData>('/api/v1/admin/member-operations'));

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
