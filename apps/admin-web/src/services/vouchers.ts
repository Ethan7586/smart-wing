/**
 * Typed boundary for the production voucher API. Components must never turn
 * mock objects into live-looking data; every value here originates in a
 * server response marked `dataSource: "live"`.
 */

export type VoucherApiStatus = 'inactive' | 'active' | 'disabled' | 'redeemed' | 'expired' | 'void';

export interface LiveVoucherOverview {
  activeVoucherCount: number;
  inactiveVoucherCount: number;
  disabledVoucherCount: number;
  redeemedVoucherCount: number;
  remainingValueCents: number;
  updatedAt: string | null;
}

export interface LiveVoucherProgram {
  id: string;
  programCode: string;
  name: string;
  denominationCents: number;
  defaultValidDays: number;
  redemptionPolicy: string;
  status: string;
  enterpriseId: string;
  mallId: string;
  updatedAt: string;
}

export interface LiveVoucherReserve {
  id: string;
  requestNo: string;
  voucherProgramId: string;
  programName: string;
  requestedQuantity: number;
  requestedValueCents: number;
  status: string;
  enterpriseId: string;
  mallId: string;
  requestedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveVoucherBatch {
  id: string;
  batchNo: string;
  reserveRequestId: string;
  voucherProgramId: string;
  issuedQuantity: number;
  issuedValueCents: number;
  status: string;
  enterpriseId: string;
  mallId: string;
  issuedAt: string | null;
  createdAt: string;
}

export interface LiveVoucher {
  id: string;
  voucherCode: string;
  cardNo: string | null;
  programName: string;
  status: VoucherApiStatus;
  initialCents: number;
  remainingCents: number;
  expiresAt: string;
  boundUserId: string | null;
  issueBatchId: string;
  enterpriseId: string;
  mallId: string;
  version: number;
  updatedAt: string;
}

export interface LiveVoucherRedemption {
  id: string;
  redemptionNo: string;
  voucherId: string;
  voucherCode: string;
  amountCents: number;
  remainingBeforeCents: number;
  remainingAfterCents: number;
  merchantReference: string;
  operatorUserId: string;
  enterpriseId: string;
  mallId: string;
  createdAt: string;
}

export interface LiveVoucherAudit {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  requestId: string;
  actorUserId: string | null;
  membershipId: string | null;
  grantedVia: Record<string, unknown> | null;
  createdAt: string;
}

export interface LiveVoucherVoidBalanceHold {
  id: string;
  voucherId: string;
  voucherCode: string;
  amountCents: number;
  status: 'open' | 'reconciled';
  voidReason: string;
  reconciliationReference: string | null;
  reconciliationNote: string | null;
  createdAt: string;
  reconciledAt: string | null;
  enterpriseId: string;
  mallId: string;
}

export interface VoucherPage<T> {
  items: T[];
  limit: number;
  offset: number;
}

interface LiveEnvelope<T> {
  dataSource?: unknown;
  data?: unknown;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function integer(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : fallback;
}

function valueRecord(value: unknown): Record<string, unknown> {
  const parsed = record(value);
  if (!parsed) throw new Error('VOUCHER_API_RESPONSE_INVALID');
  return parsed;
}

async function getLiveData<T>(path: string, parse: (value: unknown) => T): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`VOUCHER_API_REQUEST_FAILED_${response.status}`);
  const envelope = (await response.json()) as LiveEnvelope<unknown>;
  if (envelope.dataSource !== 'live') throw new Error('VOUCHER_API_DATA_SOURCE_INVALID');
  return parse(envelope.data);
}

function parseOverview(value: unknown): LiveVoucherOverview {
  const source = valueRecord(value);
  return {
    activeVoucherCount: integer(source.activeVoucherCount),
    inactiveVoucherCount: integer(source.inactiveVoucherCount),
    disabledVoucherCount: integer(source.disabledVoucherCount),
    redeemedVoucherCount: integer(source.redeemedVoucherCount),
    remainingValueCents: integer(source.remainingValueCents),
    updatedAt: nullableText(source.updatedAt),
  };
}

function parsePage<T>(value: unknown, parseItem: (item: Record<string, unknown>) => T): VoucherPage<T> {
  const source = valueRecord(value);
  if (!Array.isArray(source.items)) throw new Error('VOUCHER_API_RESPONSE_INVALID');
  const items = source.items.map(record).filter((item): item is Record<string, unknown> => item !== null).map(parseItem);
  return { items, limit: integer(source.limit), offset: integer(source.offset) };
}

function parseProgram(item: Record<string, unknown>): LiveVoucherProgram {
  return {
    id: text(item.id), programCode: text(item.program_code), name: text(item.name), denominationCents: integer(item.denomination_cents),
    defaultValidDays: integer(item.default_valid_days), redemptionPolicy: text(item.redemption_policy), status: text(item.status),
    enterpriseId: text(item.enterprise_id), mallId: text(item.mall_id), updatedAt: text(item.updated_at),
  };
}

function parseReserve(item: Record<string, unknown>): LiveVoucherReserve {
  return {
    id: text(item.id), requestNo: text(item.request_no), voucherProgramId: text(item.voucher_program_id), programName: text(item.program_name),
    requestedQuantity: integer(item.requested_quantity), requestedValueCents: integer(item.requested_value_cents), status: text(item.status),
    enterpriseId: text(item.enterprise_id), mallId: text(item.mall_id), requestedByUserId: text(item.requested_by_user_id),
    createdAt: text(item.created_at), updatedAt: text(item.updated_at),
  };
}

function parseBatch(item: Record<string, unknown>): LiveVoucherBatch {
  return {
    id: text(item.id), batchNo: text(item.batch_no), reserveRequestId: text(item.reserve_request_id), voucherProgramId: text(item.voucher_program_id),
    issuedQuantity: integer(item.issued_quantity), issuedValueCents: integer(item.issued_value_cents), status: text(item.status),
    enterpriseId: text(item.enterprise_id), mallId: text(item.mall_id), issuedAt: nullableText(item.issued_at), createdAt: text(item.created_at),
  };
}

function parseVoucher(item: Record<string, unknown>): LiveVoucher {
  const status = text(item.status);
  if (!['inactive', 'active', 'disabled', 'redeemed', 'expired', 'void'].includes(status)) throw new Error('VOUCHER_API_RESPONSE_INVALID');
  return {
    id: text(item.id), voucherCode: text(item.voucher_code), cardNo: nullableText(item.card_no), programName: text(item.program_name), status: status as VoucherApiStatus,
    initialCents: integer(item.initial_cents), remainingCents: integer(item.remaining_cents), expiresAt: text(item.expires_at),
    boundUserId: nullableText(item.bound_user_id), issueBatchId: text(item.issue_batch_id), enterpriseId: text(item.enterprise_id), mallId: text(item.mall_id), version: integer(item.version), updatedAt: text(item.updated_at),
  };
}

function parseRedemption(item: Record<string, unknown>): LiveVoucherRedemption {
  return {
    id: text(item.id), redemptionNo: text(item.redemption_no), voucherId: text(item.voucher_id), voucherCode: text(item.voucher_code),
    amountCents: integer(item.amount_cents), remainingBeforeCents: integer(item.remaining_before_cents), remainingAfterCents: integer(item.remaining_after_cents),
    merchantReference: text(item.merchant_reference), operatorUserId: text(item.operator_user_id), enterpriseId: text(item.enterprise_id), mallId: text(item.mall_id), createdAt: text(item.created_at),
  };
}

function parseAudit(item: Record<string, unknown>): LiveVoucherAudit {
  return {
    id: text(item.id), action: text(item.action), resourceType: text(item.resource_type), resourceId: nullableText(item.resource_id),
    requestId: text(item.request_id), actorUserId: nullableText(item.actor_user_id), membershipId: nullableText(item.membership_id),
    grantedVia: record(item.granted_via), createdAt: text(item.created_at),
  };
}

function parseVoidBalanceHold(item: Record<string, unknown>): LiveVoucherVoidBalanceHold {
  const status = text(item.status);
  if (status !== 'open' && status !== 'reconciled') throw new Error('VOUCHER_API_RESPONSE_INVALID');
  return {
    id: text(item.id), voucherId: text(item.voucher_id), voucherCode: text(item.voucher_code), amountCents: integer(item.amount_cents),
    status, voidReason: text(item.void_reason), reconciliationReference: nullableText(item.reconciliation_reference), reconciliationNote: nullableText(item.reconciliation_note),
    createdAt: text(item.created_at), reconciledAt: nullableText(item.reconciled_at), enterpriseId: text(item.enterprise_id), mallId: text(item.mall_id),
  };
}

export function loadLiveVoucherOverview(): Promise<LiveVoucherOverview> {
  return getLiveData('/api/v1/admin/vouchers/overview', parseOverview);
}

export function loadLiveVoucherPrograms(limit = 50, offset = 0): Promise<VoucherPage<LiveVoucherProgram>> {
  return getLiveData(`/api/v1/admin/voucher-programs?limit=${limit}&offset=${offset}`, (value) => parsePage(value, parseProgram));
}

export function loadLiveVoucherReserves(limit = 50, offset = 0): Promise<VoucherPage<LiveVoucherReserve>> {
  return getLiveData(`/api/v1/admin/voucher-reserves?limit=${limit}&offset=${offset}`, (value) => parsePage(value, parseReserve));
}

export function loadLiveVoucherBatches(limit = 50, offset = 0): Promise<VoucherPage<LiveVoucherBatch>> {
  return getLiveData(`/api/v1/admin/voucher-batches?limit=${limit}&offset=${offset}`, (value) => parsePage(value, parseBatch));
}

export function loadLiveVouchers(options: { query?: string; status?: VoucherApiStatus; limit?: number; offset?: number } = {}): Promise<VoucherPage<LiveVoucher>> {
  const query = new URLSearchParams({ limit: String(options.limit ?? 50), offset: String(options.offset ?? 0) });
  if (options.query?.trim()) query.set('q', options.query.trim());
  if (options.status) query.set('status', options.status);
  return getLiveData(`/api/v1/admin/vouchers?${query.toString()}`, (value) => parsePage(value, parseVoucher));
}

export function loadLiveVoucherRedemptions(limit = 50, offset = 0): Promise<VoucherPage<LiveVoucherRedemption>> {
  return getLiveData(`/api/v1/admin/voucher-redemptions?limit=${limit}&offset=${offset}`, (value) => parsePage(value, parseRedemption));
}

export function loadLiveVoucherAudit(limit = 50, offset = 0): Promise<VoucherPage<LiveVoucherAudit>> {
  return getLiveData(`/api/v1/admin/voucher-audit?limit=${limit}&offset=${offset}`, (value) => parsePage(value, parseAudit));
}

export function loadLiveVoucherVoidBalanceHolds(limit = 50, offset = 0): Promise<VoucherPage<LiveVoucherVoidBalanceHold>> {
  return getLiveData(`/api/v1/admin/voucher-void-holds?limit=${limit}&offset=${offset}`, (value) => parsePage(value, parseVoidBalanceHold));
}
