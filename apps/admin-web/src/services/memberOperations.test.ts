import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMemberOperations } from './memberOperations';

const validResponse = {
  profiles: [
    {
      membershipId: 'membership-1',
      memberId: 'member-1',
      userId: 'user-1',
      displayName: 'Ethan',
      employeeNo: 'EMP-001',
      username: null,
      email: null,
      mobileMasked: null,
      phoneBound: false,
      departmentId: null,
      departmentName: null,
      target: 'admin',
      status: 'active',
      authzVersion: 1,
      isOwner: true,
      createdAt: '2026-08-19T00:00:00.000Z',
    },
  ],
  invitations: [],
  imports: [{ id: 'import-1', sourceName: 'members.csv', status: 'completed', totalRows: 1, successRows: 1, failedRows: 0, createdAt: '2026-08-19T00:00:00.000Z', errors: [] }],
  history: [],
  departments: [{ id: 'department-1', name: '运营部' }],
  requestId: 'request-1',
};

function respond(payload: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('member operation read model', () => {
  it('accepts a complete operations response', async () => {
    respond(validResponse);
    await expect(loadMemberOperations({ force: true })).resolves.toEqual(validResponse);
  });

  it('rejects an import row without its errors collection before rendering', async () => {
    respond({ ...validResponse, imports: [{ ...validResponse.imports[0], errors: undefined }] });
    await expect(loadMemberOperations({ force: true })).rejects.toThrow('会员运营返回了不完整的数据');
  });
});
