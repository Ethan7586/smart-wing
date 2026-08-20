import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import type { AuthorizationContext } from './types';

/** Shared authorization builders for the voucher read and write route suites. */
export function context(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-voucher-admin',
    memberId: 'member-voucher-admin',
    target: 'admin',
    status: 'active',
    roleIds: ['role-voucher-mall-operator-v1'],
    permissions: [PERMISSIONS.voucherRead],
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
    scopeBindings: [{ kind: 'mall', resourceId: 'mall-a' }],
    expiresAt: null,
    authzVersion: 1,
  };
  return {
    tenantId: 'tenant-a',
    enterpriseId: 'enterprise-a',
    mallId: 'mall-a',
    mallCode: 'MALL_A',
    userId: 'user-a',
    employeeNo: 'U001',
    roles: membership.roleIds,
    permissions: membership.permissions,
    membership,
    stepUpAt: null,
    ...overrides,
  };
}

export function contextWithPermissions(permissions: AuthorizationContext['permissions'], stepUpAt: string | null = null): AuthorizationContext {
  const base = context();
  return context({
    permissions,
    membership: { ...base.membership, permissions },
    stepUpAt,
  });
}
