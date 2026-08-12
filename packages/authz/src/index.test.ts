import { describe, expect, it } from 'vitest';
import { decide } from './index';
import { PERMISSIONS, type Membership, type ResourceScope } from '@smart-wing/api-contract';

const employee: Membership = {
  id: 'membership-employee',
  memberId: 'member-1',
  target: 'storefront',
  status: 'active',
  roleIds: ['employee'],
  permissions: [PERMISSIONS.orderRead],
  context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
  scopeBindings: [{ kind: 'self', resourceId: 'user-a' }],
  expiresAt: null,
  authzVersion: 1,
};

const ownOrder: ResourceScope = { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', ownerUserId: 'user-a' };

describe('authorization decisions', () => {
  it('allows an employee to read only their own order', () => {
    expect(decide(employee, PERMISSIONS.orderRead, ownOrder)).toMatchObject({ allowed: true, reason: 'ALLOWED' });
  });

  it('does not let enterprise context widen an employee self grant', () => {
    expect(decide(employee, PERMISSIONS.orderRead, { ...ownOrder, ownerUserId: 'user-b' })).toMatchObject({ allowed: false, reason: 'SCOPE_MISMATCH' });
  });

  it('lets an explicit deny override a permission inherited from any role', () => {
    expect(decide({ ...employee, deniedPermissions: [PERMISSIONS.orderRead] }, PERMISSIONS.orderRead, ownOrder)).toMatchObject({ allowed: false, reason: 'PERMISSION_DENIED' });
  });

  it('supports reserved store and department scopes without widening them', () => {
    const storeOperator: Membership = {
      ...employee,
      target: 'admin',
      permissions: [PERMISSIONS.orderRead],
      scopeBindings: [
        { kind: 'store', resourceId: 'store-a' },
        { kind: 'department', resourceId: 'department-a' },
      ],
    };
    expect(decide(storeOperator, PERMISSIONS.orderRead, { ...ownOrder, storeId: 'store-a' })).toMatchObject({ allowed: true });
    expect(decide(storeOperator, PERMISSIONS.orderRead, { ...ownOrder, storeId: 'store-b', departmentId: 'department-b' })).toMatchObject({ allowed: false, reason: 'SCOPE_MISMATCH' });
  });

  it('rejects a resource from another tenant before scope evaluation', () => {
    expect(decide(employee, PERMISSIONS.orderRead, { ...ownOrder, tenantId: 'tenant-b' })).toMatchObject({ allowed: false, reason: 'TENANT_MISMATCH' });
  });

  it('requires step-up for a refund even when the permission is present', () => {
    const refundOperator: Membership = { ...employee, id: 'membership-admin', target: 'admin', permissions: [PERMISSIONS.orderRefund], scopeBindings: [{ kind: 'mall', resourceId: 'mall-a' }] };
    expect(decide(refundOperator, PERMISSIONS.orderRefund, ownOrder)).toMatchObject({ allowed: false, reason: 'STEP_UP_REQUIRED' });
    expect(decide(refundOperator, PERMISSIONS.orderRefund, ownOrder, { stepUpAt: new Date().toISOString() })).toMatchObject({ allowed: true, reason: 'ALLOWED' });
  });

  it('derives critical step-up behavior from the shared permission catalogue', () => {
    const administrator: Membership = { ...employee, target: 'admin', permissions: [PERMISSIONS.roleGrant], scopeBindings: [{ kind: 'tenant', resourceId: 'tenant-a' }] };
    expect(decide(administrator, PERMISSIONS.roleGrant, ownOrder)).toMatchObject({ allowed: false, reason: 'STEP_UP_REQUIRED' });
  });

  it('rejects an expired step-up verification', () => {
    const refundOperator: Membership = { ...employee, id: 'membership-admin', target: 'admin', permissions: [PERMISSIONS.orderRefund], scopeBindings: [{ kind: 'mall', resourceId: 'mall-a' }] };
    expect(
      decide(refundOperator, PERMISSIONS.orderRefund, ownOrder, {
        now: new Date('2026-08-09T12:00:00.000Z'),
        stepUpAt: '2026-08-09T11:40:00.000Z',
      })
    ).toMatchObject({ allowed: false, reason: 'STEP_UP_REQUIRED' });
  });
});
