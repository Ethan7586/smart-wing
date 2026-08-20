import { VoucherOperationError } from '../../services/voucherOperations';
import type { LiveVoucher, LiveVoucherRedemption, LiveVoucherReserve, LiveVoucherVoidBalanceHold } from '../../services/vouchers';

export type VoucherWriteAction =
  | { kind: 'reserve' }
  | { kind: 'approval'; reserve: LiveVoucherReserve }
  | { kind: 'issue' }
  | { kind: 'status'; voucher: LiveVoucher }
  | { kind: 'redeem' }
  | { kind: 'reverse'; redemption: LiveVoucherRedemption }
  | { kind: 'reconcile'; voidHold: LiveVoucherVoidBalanceHold };

export function yuanToCents(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  const [yuan, decimal = ''] = normalized.split('.');
  const cents = Number(yuan) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 1) throw new Error('VOUCHER_CLIENT_INPUT_INVALID');
  return cents;
}

export function operationErrorMessage(error: unknown): string {
  if (error instanceof VoucherOperationError) return error.message;
  return error instanceof Error && error.message === 'VOUCHER_CLIENT_INPUT_INVALID' ? '请检查必填信息、金额和操作参数。' : '卡券操作未完成，请稍后重试。';
}

export function titleFor(action: VoucherWriteAction): string {
  switch (action.kind) {
    case 'reserve':
      return '创建备券申请';
    case 'approval':
      return '处理备券审批';
    case 'issue':
      return '发行电子券批次';
    case 'status':
      return '变更单券状态';
    case 'redeem':
      return '门店核销券码';
    case 'reverse':
      return '冲正核销流水';
    case 'reconcile':
      return '处理作废余额对账';
  }
}
