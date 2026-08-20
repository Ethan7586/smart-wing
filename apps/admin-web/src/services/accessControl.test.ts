import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAccessControl } from './accessControl';

const validResponse = {
  members: [
    {
      membershipId: 'membership-1',
      memberId: 'member-1',
      displayName: 'Ethan',
      employeeNo: 'EMP-001',
      email: null,
      mobileMasked: null,
      target: 'admin',
      status: 'active',
      authzVersion: 1,
      isSelf: true,
      isOwner: true,
      roles: [{ id: 'role-1', code: 'owner', name: '平台 Owner' }],
      scopes: [{ kind: 'tenant', resourceId: 'tenant-1' }],
      deniedPermissions: [],
    },
  ],
  roles: [
    {
      id: 'role-1',
      code: 'owner',
      name: '平台 Owner',
      description: '完整后台权限',
      isSystem: true,
      isOwner: true,
      isEditable: false,
      status: 'active',
      permissions: ['member.read'],
    },
  ],
  permissions: [{ code: 'member.read', name: '查看会员', category: '会员', risk: 'low', mvp: true }],
  scopeOptions: { tenant: [{ id: 'tenant-1', name: 'Smart Wing 安全租户' }] },
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

describe('access control read model', () => {
  it('accepts a complete command-center response', async () => {
    respond(validResponse);
    await expect(loadAccessControl({ force: true })).resolves.toEqual(validResponse);
  });

  it('rejects a member row that would break member filters during rendering', async () => {
    respond({ ...validResponse, members: [{ ...validResponse.members[0], roles: undefined }] });
    await expect(loadAccessControl({ force: true })).rejects.toThrow('权限服务返回了不完整的数据');
  });
});
