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
