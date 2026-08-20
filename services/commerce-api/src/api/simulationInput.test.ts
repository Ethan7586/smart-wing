import { describe, expect, it } from 'vitest';
import { parseSimulationBenefitInput, parseSimulationMixedPaymentInput, parseSimulationRechargeInput } from './simulationInput';

describe('test payment simulation validation', () => {
  it('only accepts explicitly mocked recharge channels', () => {
    expect(parseSimulationRechargeInput({ accountType: 'welfare', channel: 'wechat_mock', amountCents: 10000 })).toEqual({ accountType: 'welfare', channel: 'wechat_mock', amountCents: 10000 });
    expect(parseSimulationRechargeInput({ accountType: 'welfare', channel: 'wechat', amountCents: 10000 })).toBeNull();
  });

  it('requires an owned voucher whenever voucher cents are used', () => {
    expect(parseSimulationMixedPaymentInput({ welfareCents: 100, mealCents: 0, voucherCents: 200, pointsCents: 50, externalChannel: 'alipay_mock', externalCents: 0 })).toBeNull();
    expect(parseSimulationMixedPaymentInput({ welfareCents: 100, mealCents: 0, voucherId: 'voucher-1', voucherCents: 200, pointsCents: 50, externalChannel: 'alipay_mock', externalCents: 0 })).toMatchObject({
      voucherId: 'voucher-1',
      externalChannel: 'alipay_mock',
    });
  });

  it('validates manager benefit grants', () => {
    expect(parseSimulationBenefitInput({ targetUserId: 'user-1', instrumentType: 'points', amount: 1000 })).toEqual({ targetUserId: 'user-1', instrumentType: 'points', amount: 1000 });
    expect(parseSimulationBenefitInput({ targetUserId: 'user-1', instrumentType: 'cash', amount: 1000 })).toBeNull();
  });
});
