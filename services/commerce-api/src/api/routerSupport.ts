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
export async function loadResourceScope(env: WorkerEnv, rpc: 'api_order_authorization_scope' | 'api_after_sale_authorization_scope', resourceId: string): Promise<ResourceScope | null> {
  const row = await callRpc<Record<string, unknown> | null>(env, rpc, rpc === 'api_order_authorization_scope' ? { p_order_id: resourceId } : { p_after_sale_id: resourceId });
  return resourceScopeFromDatabaseRow(row);
}

export function invalidBody(tooLarge: boolean, requestId: string): Response {
  return apiError(tooLarge ? 413 : 400, tooLarge ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON', tooLarge ? '请求内容超过允许大小' : '请求内容不是有效 JSON', requestId);
}

export async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  const maximumBytes = 32 * 1024;
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
