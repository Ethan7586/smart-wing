import { describe, expect, it } from 'vitest';
import { parseMembershipRuntime, resourceScopeFromDatabaseRow } from './membershipContext';

describe('resource scope derivation', () => {
  it('accepts scope facts loaded from a database row', () => {
    expect(resourceScopeFromDatabaseRow({ tenant_id: 'tenant-a', enterprise_id: 'enterprise-a', mall_id: 'mall-a', supplier_id: 'supplier-a', user_id: 'user-a' })).toEqual({
      tenantId: 'tenant-a',
      enterpriseId: 'enterprise-a',
      mallId: 'mall-a',
      supplierId: 'supplier-a',
      ownerUserId: 'user-a',
    });
  });

  it('does not turn arbitrary request-shaped data into a resource scope', () => {
    expect(resourceScopeFromDatabaseRow({ mallId: 'attacker-controlled' })).toBeNull();
  });

  it('accepts only a typed organization path loaded from a database row', () => {
    expect(
      resourceScopeFromDatabaseRow({
        tenant_id: 'tenant-a',
        mall_id: 'mall-a',
        org_unit_path: [
          { kind: 'platform', resourceId: 'org-platform-smart-wing' },
          { kind: 'enterprise', resourceId: 'enterprise-a' },
          { kind: 'mall', resourceId: 'mall-a' },
        ],
      })
    ).toMatchObject({
      orgUnitPath: [
        { kind: 'platform', resourceId: 'org-platform-smart-wing' },
        { kind: 'enterprise', resourceId: 'enterprise-a' },
        { kind: 'mall', resourceId: 'mall-a' },
      ],
    });
  });

  it('fails closed when the database organization path is malformed', () => {
    expect(resourceScopeFromDatabaseRow({ tenant_id: 'tenant-a', org_unit_path: [{ kind: 'platform', resourceId: '' }] })).toEqual({ tenantId: 'tenant-a' });
  });
});

function runtimePayload(bindings: Array<{ kind: string; resourceId: string }>, contextExtras: Record<string, unknown> = {}) {
  return {
    id: 'membership-a',
    memberId: 'member-a',
    target: 'admin',
    status: 'active',
    roleIds: ['role-a'],
    permissions: [],
    deniedPermissions: [],
    scopeBindings: bindings,
    expiresAt: null,
    authzVersion: 1,
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a', ...contextExtras },
    actor: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', mallCode: 'MALL_A', userId: 'user-a', employeeNo: 'A001' },
  };
}

describe('distributor session projection', () => {
  it('projects the distributor from the server-resolved bindings, not from the session context', () => {
    const runtime = parseMembershipRuntime(runtimePayload([{ kind: 'distributor', resourceId: 'distributor-a' }], { distributorId: 'attacker-controlled' }));

    expect(runtime?.authorization.distributorId).toBe('distributor-a');
  });

  it('fails closed when two different distributors are granted', () => {
    const runtime = parseMembershipRuntime(
      runtimePayload([
        { kind: 'distributor', resourceId: 'distributor-a' },
        { kind: 'distributor', resourceId: 'distributor-b' },
      ])
    );

    expect(runtime?.authorization.distributorId).toBeNull();
  });

  it('reports no distributor when none is granted, even if the context claims one', () => {
    const runtime = parseMembershipRuntime(runtimePayload([{ kind: 'tenant', resourceId: 'tenant-a' }], { distributorId: 'distributor-a' }));

    expect(runtime?.authorization.distributorId).toBeNull();
  });
});
