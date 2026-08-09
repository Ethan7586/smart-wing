import type { Membership, MembershipScope } from '@smart-wing/api-contract';

export function isActiveMembership(membership: Membership, now = new Date()): boolean {
  return membership.status === 'active' && (!membership.expiresAt || new Date(membership.expiresAt) > now);
}

export function hasPermission(membership: Membership, permission: string): boolean {
  return isActiveMembership(membership) && membership.permissions.includes(permission);
}

export function scopeIncludes(scope: MembershipScope, requested: Partial<MembershipScope>): boolean {
  return Object.entries(requested).every(([key, value]) => value === undefined || scope[key as keyof MembershipScope] === value);
}
