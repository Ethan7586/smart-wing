import { isRecord } from './inputPrimitives';

export interface SimulationRechargeInput {
  accountType: 'welfare' | 'meal';
  channel: 'wechat_mock' | 'alipay_mock' | 'unionpay_mock' | 'bank_mock';
  amountCents: number;
}

export interface SimulationBenefitInput {
  targetUserId: string;
  instrumentType: 'voucher' | 'points';
  amount: number;
}

export interface SimulationMixedPaymentInput {
  welfareCents: number;
  mealCents: number;
  voucherId: string | null;
  voucherCents: number;
  pointsCents: number;
  externalChannel: 'wechat_mock' | 'alipay_mock' | 'unionpay_mock' | 'bank_mock';
  externalCents: number;
}

/**
 * Normalized, supplier-neutral shape for catalog writes.  Provider adapters
 * translate their payloads into this contract before they touch the catalogue.
 * Amounts are integer cents; no supplier credential is ever part of a payload.
 */
export function parseSimulationRechargeInput(value: unknown): SimulationRechargeInput | null {
  if (!isRecord(value) || !['welfare', 'meal'].includes(String(value.accountType)) || !['wechat_mock', 'alipay_mock', 'unionpay_mock', 'bank_mock'].includes(String(value.channel)) || !Number.isSafeInteger(value.amountCents)) return null;
  const amountCents = value.amountCents as number;
  return amountCents > 0 && amountCents <= 100000000 ? { accountType: value.accountType as SimulationRechargeInput['accountType'], channel: value.channel as SimulationRechargeInput['channel'], amountCents } : null;
}

export function parseSimulationBenefitInput(value: unknown): SimulationBenefitInput | null {
  if (!isRecord(value) || typeof value.targetUserId !== 'string' || value.targetUserId.length < 1 || value.targetUserId.length > 120 || !['voucher', 'points'].includes(String(value.instrumentType)) || !Number.isSafeInteger(value.amount))
    return null;
  const amount = value.amount as number;
  return amount > 0 && amount <= 100000000 ? { targetUserId: value.targetUserId, instrumentType: value.instrumentType as SimulationBenefitInput['instrumentType'], amount } : null;
}

export function parseSimulationMixedPaymentInput(value: unknown): SimulationMixedPaymentInput | null {
  if (!isRecord(value)) return null;
  const values = ['welfareCents', 'mealCents', 'voucherCents', 'pointsCents', 'externalCents'].map((key) => value[key]);
  if (values.some((item) => !Number.isSafeInteger(item) || (item as number) < 0) || !['wechat_mock', 'alipay_mock', 'unionpay_mock', 'bank_mock'].includes(String(value.externalChannel))) return null;
  const voucherId = value.voucherId === undefined || value.voucherId === null ? null : typeof value.voucherId === 'string' && value.voucherId.length <= 120 ? value.voucherId : undefined;
  if (voucherId === undefined || ((value.voucherCents as number) > 0 && !voucherId)) return null;
  const total = (values as unknown[]).reduce<number>((sum, item) => sum + (item as number), 0);
  return total > 0
    ? {
        welfareCents: value.welfareCents as number,
        mealCents: value.mealCents as number,
        voucherId,
        voucherCents: value.voucherCents as number,
        pointsCents: value.pointsCents as number,
        externalChannel: value.externalChannel as SimulationMixedPaymentInput['externalChannel'],
        externalCents: value.externalCents as number,
      }
    : null;
}

/** Validates the boundary shared by JD, Tmall, cake, book and voucher adapters. */
