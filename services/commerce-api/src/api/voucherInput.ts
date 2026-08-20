import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { resourceScopeFromDatabaseRow } from './membershipContext';
import { authorizationEvidence, invalidBody, loadResourceScope, readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';

export const VOUCHER_STATUSES = new Set(['inactive', 'active', 'disabled', 'redeemed', 'expired', 'void']);

export interface PageInput {
  limit: number;
  offset: number;
}

export interface VoucherListInput extends PageInput {
  query: string | null;
  status: string | null;
}

export function parseNonNegativeInteger(value: string | null, fallback: number, maximum: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export function parsePage(url: URL): PageInput | null {
  const limit = parseNonNegativeInteger(url.searchParams.get('limit'), 50, 100);
  const offset = parseNonNegativeInteger(url.searchParams.get('offset'), 0, 1_000_000);
  return limit === null || limit < 1 || offset === null ? null : { limit, offset };
}

export function parseVoucherList(url: URL): VoucherListInput | null {
  const page = parsePage(url);
  if (!page) return null;
  const rawQuery = url.searchParams.get('q');
  const query = rawQuery?.trim() ?? null;
  const rawStatus = url.searchParams.get('status');
  const status = rawStatus?.trim() ?? null;
  if ((query && query.length > 100) || (status && !VOUCHER_STATUSES.has(status))) return null;
  return { ...page, query: query || null, status: status || null };
}

export function requireVoucherRead(authorization: AuthorizationContext, requestId: string): Response | null {
  return authorize(authorization, PERMISSIONS.voucherRead).allowed ? null : apiError(403, 'FORBIDDEN', '没有查看卡券数据的权限', requestId);
}

export function livePayload<T>(data: T, requestId: string) {
  return { dataSource: 'live' as const, data, requestId };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function requiredString(value: Record<string, unknown>, key: string, maximum: number): string | null {
  const candidate = value[key];
  if (typeof candidate !== 'string') return null;
  const normalized = candidate.trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}

export function optionalString(value: Record<string, unknown>, key: string, maximum: number): string | null | undefined {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return null;
  if (typeof candidate !== 'string') return undefined;
  const normalized = candidate.trim();
  return normalized.length <= maximum ? normalized || null : undefined;
}

export function idempotencyKey(request: Request, requestId: string): string | Response {
  const key = request.headers.get('idempotency-key');
  return key && key.length <= 120 ? key : apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '卡券写操作必须提供 Idempotency-Key', requestId);
}

export interface ReserveInput {
  voucherProgramId: string;
  quantity: number;
  reason: string;
}

export interface ApprovalInput {
  decision: 'approved' | 'rejected';
  reason: string;
  evidence: string | null;
}

export interface IssueInput {
  /** Electronic stored-value vouchers do not consume a physical card number. */
  cardPoolId: string | null;
}

export interface StatusInput {
  operation: 'activate' | 'disable' | 'extend' | 'void';
  extensionDays: number;
  expectedVersion: number;
  reason: string;
  evidence: string | null;
}

export interface RedemptionInput {
  voucherCode: string;
  amountCents: number;
  merchantReference: string;
}

export interface ReversalInput {
  reason: string;
}

export interface VoidHoldReconciliationInput {
  reconciliationReference: string;
  reconciliationNote: string;
}

export function parseReserveInput(value: unknown): ReserveInput | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.quantity)) return null;
  const voucherProgramId = requiredString(value, 'voucherProgramId', 120);
  const reason = requiredString(value, 'reason', 500);
  const quantity = value.quantity as number;
  return voucherProgramId && reason && quantity >= 1 && quantity <= 1_000_000 ? { voucherProgramId, quantity, reason } : null;
}

export function parseApprovalInput(value: unknown): ApprovalInput | null {
  if (!isRecord(value) || (value.decision !== 'approved' && value.decision !== 'rejected')) return null;
  const reason = requiredString(value, 'reason', 500);
  const evidence = optionalString(value, 'evidence', 2000);
  return reason && evidence !== undefined ? { decision: value.decision, reason, evidence } : null;
}

export function parseIssueInput(value: unknown): IssueInput | null {
  if (!isRecord(value)) return null;
  const cardPoolId = optionalString(value, 'cardPoolId', 120);
  return cardPoolId === undefined ? null : { cardPoolId };
}

export function parseStatusInput(value: unknown): StatusInput | null {
  if (!isRecord(value) || !['activate', 'disable', 'extend', 'void'].includes(String(value.operation)) || !Number.isSafeInteger(value.expectedVersion)) return null;
  const operation = value.operation as StatusInput['operation'];
  const extensionDays = operation === 'extend' ? value.extensionDays : 0;
  const reason = requiredString(value, 'reason', 500);
  const evidence = optionalString(value, 'evidence', 2000);
  if (!Number.isSafeInteger(extensionDays) || !reason || evidence === undefined || (operation === 'extend' && ((extensionDays as number) < 1 || (extensionDays as number) > 3650))) return null;
  const expectedVersion = value.expectedVersion as number;
  return expectedVersion > 0 ? { operation, extensionDays: extensionDays as number, expectedVersion, reason, evidence } : null;
}

export function parseRedemptionInput(value: unknown): RedemptionInput | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.amountCents)) return null;
  const voucherCode = requiredString(value, 'voucherCode', 100)?.toUpperCase();
  const merchantReference = requiredString(value, 'merchantReference', 160);
  const amountCents = value.amountCents as number;
  return voucherCode && merchantReference && amountCents > 0 && amountCents <= 100_000_000 ? { voucherCode, amountCents, merchantReference } : null;
}

export function parseReversalInput(value: unknown): ReversalInput | null {
  if (!isRecord(value)) return null;
  const reason = requiredString(value, 'reason', 500);
  return reason ? { reason } : null;
}

export function parseVoidHoldReconciliationInput(value: unknown): VoidHoldReconciliationInput | null {
  if (!isRecord(value)) return null;
  const reconciliationReference = requiredString(value, 'reconciliationReference', 160);
  const reconciliationNote = requiredString(value, 'reconciliationNote', 500);
  return reconciliationReference && reconciliationNote ? { reconciliationReference, reconciliationNote } : null;
}
