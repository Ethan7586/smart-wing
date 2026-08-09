import type { Membership, ResourceScope, ScopeBinding } from '@smart-wing/api-contract';
import { readSession } from './session';
import { callRpc } from './supabase';
import type { WorkerEnv } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

function scopeBindings(value: unknown): ScopeBinding[] | null {
  if (!Array.isArray(value)) return null;
  const bindings: ScopeBinding[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const kind = optionalString(item.kind);
    const resourceId = optionalString(item.resourceId);
    if (!kind || !resourceId || !['tenant', 'enterprise', 'mall', 'supplier', 'self'].includes(kind)) return null;
    bindings.push({ kind: kind as ScopeBinding['kind'], resourceId });
  }
  return bindings;
}

/**
 * Resolves the one membership referenced by the host-only signed cookie. This
 * is intentionally called on every request; permissions are never stored in a
 * cookie and a revoked membership is rejected immediately.
 */
export async function resolveMembershipContext(request: Request, env: WorkerEnv): Promise<Membership | null> {
  const session = await readSession(request, env);
  if (!session?.memberId || !session.membershipId) return null;
  const raw = await callRpc<unknown>(env, 'api_resolve_membership_context', {
    p_member_id: session.memberId,
    p_membership_id: session.membershipId,
    p_target: session.target,
  });
  const membership = parseMembership(raw);
  if (!membership || membership.authzVersion !== session.authzVersion || membership.memberId !== session.memberId || membership.id !== session.membershipId || membership.target !== session.target) {
    return null;
  }
  return membership;
}

/** Converts a row loaded by commerce-api into trusted authorization facts. */
export function resourceScopeFromDatabaseRow(row: unknown): ResourceScope | null {
  if (!isRecord(row)) return null;
  const tenantId = optionalString(row.tenant_id);
  if (!tenantId) return null;
  return {
    tenantId,
    ...(optionalString(row.enterprise_id) ? { enterpriseId: optionalString(row.enterprise_id) } : {}),
    ...(optionalString(row.mall_id) ? { mallId: optionalString(row.mall_id) } : {}),
    ...(optionalString(row.supplier_id) ? { supplierId: optionalString(row.supplier_id) } : {}),
    ...(optionalString(row.user_id) ? { ownerUserId: optionalString(row.user_id) } : {}),
  };
}

function parseMembership(value: unknown): Membership | null {
  if (!isRecord(value) || !isRecord(value.context)) return null;
  const id = optionalString(value.id);
  const memberId = optionalString(value.memberId);
  const target = optionalString(value.target);
  const status = optionalString(value.status);
  const tenantId = optionalString(value.context.tenantId);
  const roleIds = stringList(value.roleIds);
  const permissions = stringList(value.permissions);
  const bindings = scopeBindings(value.scopeBindings);
  if (
    !id ||
    !memberId ||
    (target !== 'storefront' && target !== 'admin') ||
    !['invited', 'active', 'suspended', 'offboarded', 'expired'].includes(status ?? '') ||
    !tenantId ||
    !roleIds ||
    !permissions ||
    !bindings ||
    typeof value.authzVersion !== 'number'
  ) {
    return null;
  }
  return {
    id,
    memberId,
    target,
    status: status as Membership['status'],
    roleIds,
    permissions: permissions as Membership['permissions'],
    context: {
      tenantId,
      ...(optionalString(value.context.enterpriseId) ? { enterpriseId: optionalString(value.context.enterpriseId) } : {}),
      ...(optionalString(value.context.mallId) ? { mallId: optionalString(value.context.mallId) } : {}),
      ...(optionalString(value.context.supplierId) ? { supplierId: optionalString(value.context.supplierId) } : {}),
      ...(optionalString(value.context.userId) ? { userId: optionalString(value.context.userId) } : {}),
    },
    scopeBindings: bindings,
    expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : null,
    authzVersion: value.authzVersion,
  };
}
