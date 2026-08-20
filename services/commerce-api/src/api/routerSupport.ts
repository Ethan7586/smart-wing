import { apiError } from './http';
import { resourceScopeFromDatabaseRow } from './membershipContext';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';
import type { ResourceScope } from '@smart-wing/api-contract';

export function authorizationScope(context: AuthorizationContext, includeUser = false): Record<string, string> {
  return {
    p_tenant_id: context.tenantId,
    p_enterprise_id: context.enterpriseId,
    p_mall_id: context.mallId,
    ...(includeUser ? { p_user_id: context.userId } : {}),
  };
}

/** Loads the target resource scope from a security-definer RPC, never request input. */
type ResourceScopeRpc =
  | 'api_order_authorization_scope'
  | 'api_after_sale_authorization_scope'
  | 'api_product_authorization_scope'
  | 'api_voucher_authorization_scope'
  | 'api_voucher_program_authorization_scope'
  | 'api_voucher_reserve_authorization_scope'
  | 'api_voucher_redemption_authorization_scope'
  | 'api_voucher_void_hold_authorization_scope';

export async function loadResourceScope(env: WorkerEnv, rpc: ResourceScopeRpc, resourceId: string): Promise<ResourceScope | null> {
  const params =
    rpc === 'api_order_authorization_scope'
      ? { p_order_id: resourceId }
      : rpc === 'api_after_sale_authorization_scope'
        ? { p_after_sale_id: resourceId }
        : rpc === 'api_product_authorization_scope'
          ? { p_product_id: resourceId }
          : rpc === 'api_voucher_authorization_scope'
            ? { p_voucher_id: resourceId }
            : rpc === 'api_voucher_program_authorization_scope'
              ? { p_voucher_program_id: resourceId }
              : rpc === 'api_voucher_reserve_authorization_scope'
                ? { p_reserve_request_id: resourceId }
                : rpc === 'api_voucher_redemption_authorization_scope'
                  ? { p_redemption_id: resourceId }
                  : { p_void_hold_id: resourceId };
  const row = await callRpc<Record<string, unknown> | null>(env, rpc, params);
  return resourceScopeFromDatabaseRow(row);
}

/** Audit proof is assembled from the server-resolved membership, never from the browser. */
export function authorizationEvidence(context: AuthorizationContext, decision: import('@smart-wing/api-contract').AuthorizationDecision): Record<string, unknown> {
  return {
    membershipId: context.membership.id,
    roleIds: context.roles,
    permission: decision.evidence?.permission ?? null,
    scope: decision.evidence?.scope ?? null,
  };
}

export function invalidBody(tooLarge: boolean, requestId: string): Response {
  return apiError(tooLarge ? 413 : 400, tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON', tooLarge ? '请求内容超过允许大小' : '请求内容不是有效 JSON', requestId);
}

export function requireIdempotencyKey(request: Request, requestId: string, message: string, minimumLength = 1): string | Response {
  const key = request.headers.get('idempotency-key');
  return key && key.length >= minimumLength && key.length <= 120 ? key : apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', message, requestId);
}

export async function readJsonBody(request: Request, maximumBytes = 32 * 1024): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  const declaredLength = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (declaredLength > maximumBytes) return { ok: false, tooLarge: true };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    return { ok: false, tooLarge: true };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}
