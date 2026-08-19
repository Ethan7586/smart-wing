import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCustomRoles } from './customRoles';

const validResponse = {
  roles: [
    {
      id: 'role-1',
      code: 'support',
      name: '客服专员',
      description: '处理售后问题',
      status: 'active',
      isSystem: false,
      isOwner: false,
      isEditable: true,
      assignmentCount: 2,
      permissions: ['member.read'],
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
    },
  ],
  permissions: [{ code: 'member.read', name: '查看会员', category: '会员', risk: 'low', mvp: true, grantable: true }],
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

describe('custom role read model', () => {
  it('accepts a complete role center response', async () => {
    respond(validResponse);
    await expect(loadCustomRoles()).resolves.toEqual(validResponse);
  });

  it('rejects a role missing its permissions before the view can iterate them', async () => {
    respond({ ...validResponse, roles: [{ ...validResponse.roles[0], permissions: undefined }] });
    await expect(loadCustomRoles()).rejects.toThrow('角色服务返回了不完整的数据');
  });
});
