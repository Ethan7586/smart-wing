export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'offboarded' | 'expired';
export type MembershipTarget = 'storefront' | 'admin';

export interface MembershipScope {
  tenantId: string;
  enterpriseId?: string;
  mallId?: string;
  supplierId?: string;
}

export interface Membership {
  id: string;
  memberId: string;
  target: MembershipTarget;
  status: MembershipStatus;
  roleNames: string[];
  permissions: string[];
  scope: MembershipScope;
  expiresAt: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
}
