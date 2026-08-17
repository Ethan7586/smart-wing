/** Write-side client for the server-authoritative voucher workflow. */

export class VoucherOperationError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = 'VoucherOperationError';
  }
}

interface ApiErrorPayload {
  error?: { code?: unknown; message?: unknown };
}

function nonEmpty(value: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  return normalized;
}

async function voucherWrite<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    const code = typeof payload.error?.code === 'string' ? payload.error.code : `VOUCHER_API_REQUEST_FAILED_${response.status}`;
    const message = typeof payload.error?.message === 'string' ? payload.error.message : '卡券操作未完成';
    throw new VoucherOperationError(code, response.status, message);
  }
  return await response.json() as T;
}

export interface StepUpChallenge {
  challengeId: string;
  method: 'totp';
  expiresAt: string;
}

export async function startVoucherStepUp(): Promise<StepUpChallenge> {
  const response = await fetch('/api/v1/auth/step-up', { method: 'POST', credentials: 'same-origin' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    throw new VoucherOperationError(typeof payload.error?.code === 'string' ? payload.error.code : `STEP_UP_REQUEST_FAILED_${response.status}`, response.status, typeof payload.error?.message === 'string' ? payload.error.message : '无法发起二次认证');
  }
  const payload = await response.json() as Partial<StepUpChallenge>;
  if (typeof payload.challengeId !== 'string' || payload.method !== 'totp' || typeof payload.expiresAt !== 'string') throw new Error('STEP_UP_RESPONSE_INVALID');
  return { challengeId: payload.challengeId, method: payload.method, expiresAt: payload.expiresAt };
}

export async function verifyVoucherStepUp(challengeId: string, code: string): Promise<void> {
  const verifiedChallengeId = nonEmpty(challengeId, 120);
  const verifiedCode = nonEmpty(code, 6);
  if (!/^\d{6}$/.test(verifiedCode)) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  const response = await fetch(`/api/v1/auth/step-up/${encodeURIComponent(verifiedChallengeId)}/verify`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: verifiedCode }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    throw new VoucherOperationError(typeof payload.error?.code === 'string' ? payload.error.code : `STEP_UP_VERIFY_FAILED_${response.status}`, response.status, typeof payload.error?.message === 'string' ? payload.error.message : '二次认证失败');
  }
}

export function createVoucherReserve(input: { voucherProgramId: string; quantity: number; reason: string }): Promise<unknown> {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 1_000_000) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  return voucherWrite('/api/v1/admin/voucher-reserves', {
    voucherProgramId: nonEmpty(input.voucherProgramId, 120), quantity: input.quantity, reason: nonEmpty(input.reason, 500),
  });
}

export function decideVoucherReserve(reserveRequestId: string, input: { decision: 'approved' | 'rejected'; reason: string; evidence?: string }): Promise<unknown> {
  return voucherWrite(`/api/v1/admin/voucher-reserves/${encodeURIComponent(nonEmpty(reserveRequestId, 120))}/decision`, {
    decision: input.decision, reason: nonEmpty(input.reason, 500), evidence: input.evidence?.trim() || null,
  });
}

export function issueVoucherBatch(reserveRequestId: string, cardPoolId?: string | null): Promise<unknown> {
  return voucherWrite(`/api/v1/admin/voucher-reserves/${encodeURIComponent(nonEmpty(reserveRequestId, 120))}/issue`, {
    // The first formal slice issues electronic vouchers. A physical card pool
    // remains an explicit future extension, never an invisible requirement.
    cardPoolId: cardPoolId ? nonEmpty(cardPoolId, 120) : null,
  });
}

export function changeVoucherStatus(voucherId: string, input: { operation: 'activate' | 'disable' | 'extend' | 'void'; expectedVersion: number; reason: string; evidence?: string; extensionDays?: number }): Promise<unknown> {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  if (input.operation === 'extend' && (!Number.isSafeInteger(input.extensionDays) || input.extensionDays! < 1 || input.extensionDays! > 3650)) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  return voucherWrite(`/api/v1/admin/vouchers/${encodeURIComponent(nonEmpty(voucherId, 120))}/status`, {
    operation: input.operation, expectedVersion: input.expectedVersion, extensionDays: input.operation === 'extend' ? input.extensionDays : 0,
    reason: nonEmpty(input.reason, 500), evidence: input.evidence?.trim() || null,
  });
}

export function redeemVoucher(input: { voucherCode: string; amountCents: number; merchantReference: string }): Promise<unknown> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  return voucherWrite('/api/v1/admin/voucher-redemptions', {
    voucherCode: nonEmpty(input.voucherCode, 100).toUpperCase(), amountCents: input.amountCents, merchantReference: nonEmpty(input.merchantReference, 160),
  });
}

export function reverseVoucherRedemption(redemptionId: string, reason: string): Promise<unknown> {
  return voucherWrite(`/api/v1/admin/voucher-redemptions/${encodeURIComponent(nonEmpty(redemptionId, 120))}/reversal`, { reason: nonEmpty(reason, 500) });
}

export function reconcileVoucherVoidBalanceHold(voidHoldId: string, input: { reconciliationReference: string; reconciliationNote: string }): Promise<unknown> {
  return voucherWrite(`/api/v1/admin/voucher-void-holds/${encodeURIComponent(nonEmpty(voidHoldId, 120))}/reconcile`, {
    reconciliationReference: nonEmpty(input.reconciliationReference, 160),
    reconciliationNote: nonEmpty(input.reconciliationNote, 500),
  });
}

