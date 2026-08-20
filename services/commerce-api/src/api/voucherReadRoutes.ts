import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { resourceScopeFromDatabaseRow } from './membershipContext';
import { authorizationEvidence, invalidBody, loadResourceScope, readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';
import { livePayload, parsePage, parseVoucherList, requireVoucherRead } from './voucherInput';

export async function handleAdminVoucherOverview(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const overview = await callRpc<Record<string, unknown>>(env, 'api_voucher_overview_scoped', { p_membership_id: authorization.membership.id });
  return json(livePayload(overview, requestId));
}

export async function handleAdminVoucherAudit(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  if (!authorize(authorization, PERMISSIONS.voucherAuditRead).allowed) return apiError(403, 'FORBIDDEN', '没有查看卡券审计记录的权限', requestId);
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_audit_scoped', {
    p_membership_id: authorization.membership.id,
    p_limit: page.limit,
    p_offset: page.offset,
  });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVoucherVoidHolds(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  // Reconciling is step-up protected; merely viewing the scoped finance worklist
  // is not. The membership is server-resolved and the RPC applies its scope.
  if (!authorization.membership.permissions.includes(PERMISSIONS.voucherReconcile)) return apiError(403, 'FORBIDDEN', '没有查看卡券作废余额对账的权限', requestId);
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_void_holds_scoped', {
    p_membership_id: authorization.membership.id,
    p_limit: page.limit,
    p_offset: page.offset,
  });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVoucherPrograms(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_programs_scoped', { p_membership_id: authorization.membership.id, p_limit: page.limit, p_offset: page.offset });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVoucherReserves(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_reserves_scoped', { p_membership_id: authorization.membership.id, p_limit: page.limit, p_offset: page.offset });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVoucherBatches(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_batches_scoped', { p_membership_id: authorization.membership.id, p_limit: page.limit, p_offset: page.offset });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVouchers(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const input = parseVoucherList(new URL(request.url));
  if (!input) return apiError(422, 'INVALID_VOUCHER_QUERY', '卡券查询参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_vouchers_scoped', {
    p_membership_id: authorization.membership.id,
    p_query: input.query,
    p_status: input.status,
    p_limit: input.limit,
    p_offset: input.offset,
  });
  return json(livePayload({ items, ...input }, requestId));
}

export async function handleAdminVoucherDetail(request: Request, env: WorkerEnv, authorization: AuthorizationContext, voucherId: string, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const scope = await loadResourceScope(env, 'api_voucher_authorization_scope', voucherId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherRead, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有查看该卡券的权限', requestId);
  const item = await callRpc<Record<string, unknown> | null>(env, 'api_voucher_detail_scoped', { p_membership_id: authorization.membership.id, p_voucher_id: voucherId });
  if (!item) return apiError(404, 'VOUCHER_NOT_FOUND', '卡券不存在或不在当前数据范围内', requestId);
  return json(livePayload(item, requestId));
}

export async function handleAdminVoucherRedemptions(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_redemptions_scoped', { p_membership_id: authorization.membership.id, p_limit: page.limit, p_offset: page.offset });
  return json(livePayload({ items, ...page }, requestId));
}
