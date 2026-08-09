/** Shared authorization contracts. Browser clients receive only safe projections. */

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'offboarded' | 'expired';
export type MembershipTarget = 'storefront' | 'admin';
export type ScopeKind = 'tenant' | 'enterprise' | 'mall' | 'supplier' | 'self';

export const PERMISSIONS = {
  catalogRead: 'catalog.read',
  productPublish: 'product.publish',
  orderCreate: 'order.create',
  orderRead: 'order.read',
  orderShip: 'order.ship',
  orderRefund: 'order.refund',
  financeReconcile: 'finance.reconcile',
  memberRead: 'member.read',
  memberInvite: 'member.invite',
  memberDisable: 'member.disable',
  roleRead: 'role.read',
  roleGrant: 'role.grant',
  auditRead: 'audit.read',
  tenantManage: 'tenant.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** The tenant context that is fixed when a membership is activated. */
export interface MembershipContextScope {
  tenantId: string;
  enterpriseId?: string;
  mallId?: string;
  supplierId?: string;
  userId?: string;
}

/** A positive authorization grant. It is never inferred from client input. */
export interface ScopeBinding {
  kind: ScopeKind;
  resourceId: string;
}

/** Facts loaded by commerce-api from the requested resource's database row. */
export interface ResourceScope {
  tenantId: string;
  enterpriseId?: string;
  mallId?: string;
  supplierId?: string;
  ownerUserId?: string;
}

export interface Membership {
  id: string;
  memberId: string;
  target: MembershipTarget;
  status: MembershipStatus;
  roleIds: string[];
  permissions: Permission[];
  context: MembershipContextScope;
  scopeBindings: ScopeBinding[];
  expiresAt: string | null;
  authzVersion: number;
}

/** A session identifies one active membership, never a union of memberships. */
export interface SessionContext {
  sessionId: string;
  memberId: string;
  membershipId: string;
  target: MembershipTarget;
  issuedAt: string;
  expiresAt: string;
  authzVersion: number;
  stepUpAt: string | null;
}

export interface AuthorizationEvidence {
  membershipId: string;
  roleIds: string[];
  permission: Permission;
  scope: ScopeBinding;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: 'ALLOWED' | 'MEMBERSHIP_INACTIVE' | 'PERMISSION_MISSING' | 'TENANT_MISMATCH' | 'SCOPE_MISMATCH' | 'STEP_UP_REQUIRED';
  evidence?: AuthorizationEvidence;
}

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
}
