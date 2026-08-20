import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { resourceScopeFromDatabaseRow } from './membershipContext';
import { authorizationEvidence, invalidBody, loadResourceScope, readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';
import { idempotencyKey, parseApprovalInput, parseIssueInput, parseRedemptionInput, parseReserveInput, parseReversalInput, parseStatusInput, parseVoidHoldReconciliationInput } from './voucherInput';

export async function handleCreateAdminVoucherReserve(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherReserveCreate).allowed) return apiError(403, 'FORBIDDEN', '没有创建备券申请的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseReserveInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_RESERVE_INPUT', '备券申请参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_program_authorization_scope', input.voucherProgramId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherReserveCreate, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有为该卡券规则创建备券申请的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_create_voucher_reserve_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_voucher_program_id: input.voucherProgramId,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify(input)),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleDecideAdminVoucherReserve(request: Request, env: WorkerEnv, authorization: AuthorizationContext, reserveRequestId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherReserveApprove).allowed) return apiError(403, 'FORBIDDEN', '没有审批备券申请的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseApprovalInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_APPROVAL_INPUT', '备券审批参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_reserve_authorization_scope', reserveRequestId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherReserveApprove, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有审批该备券申请的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_decide_voucher_reserve_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_reserve_request_id: reserveRequestId,
    p_decision: input.decision,
    p_reason: input.reason,
    p_evidence: input.evidence,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ reserveRequestId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleIssueAdminVoucherBatch(request: Request, env: WorkerEnv, authorization: AuthorizationContext, reserveRequestId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherIssue).allowed) return apiError(403, 'FORBIDDEN', '没有发行卡券的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseIssueInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_ISSUE_INPUT', '卡券发行参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_reserve_authorization_scope', reserveRequestId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherIssue, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有为该备券申请发行卡券的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_issue_voucher_batch_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_reserve_request_id: reserveRequestId,
    p_card_pool_id: input.cardPoolId,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ reserveRequestId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleChangeAdminVoucherStatus(request: Request, env: WorkerEnv, authorization: AuthorizationContext, voucherId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherStatusManage).allowed) return apiError(403, 'FORBIDDEN', '没有变更卡券状态的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseStatusInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_STATUS_INPUT', '卡券状态操作参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_authorization_scope', voucherId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherStatusManage, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有变更该卡券状态的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_change_voucher_status_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_voucher_id: voucherId,
    p_operation: input.operation,
    p_extension_days: input.extensionDays,
    p_expected_version: input.expectedVersion,
    p_reason: input.reason,
    p_evidence: input.evidence,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ voucherId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleRedeemAdminVoucher(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherRedeem).allowed) return apiError(403, 'FORBIDDEN', '没有核销卡券的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseRedemptionInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_REDEMPTION_INPUT', '核销参数无效', requestId);
  const rawScope = await callRpc<Record<string, unknown> | null>(env, 'api_voucher_code_authorization_scope', { p_voucher_code: input.voucherCode });
  const voucherId = rawScope && typeof rawScope.id === 'string' ? rawScope.id : null;
  const scope = resourceScopeFromDatabaseRow(rawScope);
  const decision = voucherId && scope ? authorize(authorization, PERMISSIONS.voucherRedeem, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有核销该卡券的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_redeem_voucher_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_voucher_id: voucherId,
    p_amount_cents: input.amountCents,
    p_merchant_reference: input.merchantReference,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify(input)),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleReverseAdminVoucherRedemption(request: Request, env: WorkerEnv, authorization: AuthorizationContext, redemptionId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherRedemptionReverse).allowed) return apiError(403, 'FORBIDDEN', '没有冲正卡券核销的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseReversalInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_REVERSAL_INPUT', '核销冲正参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_redemption_authorization_scope', redemptionId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherRedemptionReverse, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有冲正该核销流水的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_reverse_voucher_redemption_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_redemption_id: redemptionId,
    p_reason: input.reason,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ redemptionId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleReconcileAdminVoucherVoidHold(request: Request, env: WorkerEnv, authorization: AuthorizationContext, voidHoldId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherReconcile).allowed) return apiError(403, 'FORBIDDEN', '没有处理卡券作废余额对账的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseVoidHoldReconciliationInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_RECONCILIATION_INPUT', '作废余额对账参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_void_hold_authorization_scope', voidHoldId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherReconcile, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有处理该作废余额对账项的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_reconcile_voucher_void_hold_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_void_hold_id: voidHoldId,
    p_reconciliation_reference: input.reconciliationReference,
    p_reconciliation_note: input.reconciliationNote,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ voidHoldId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}
