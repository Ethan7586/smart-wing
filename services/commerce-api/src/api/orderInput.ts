import { isRecord, readRequiredString } from './inputPrimitives';

export interface OrderItemInput {
  skuId: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  recipient: {
    name: string;
    mobile: string;
    province: string;
    city: string;
    district: string;
    address: string;
  };
}

export interface InternalPaymentInput {
  welfareCents: number;
  mealCents: number;
}

export interface CreateAfterSaleInput {
  orderId: string;
  type: 'refund_only' | 'return_refund' | 'exchange';
  reason: string;
  requestedAmountCents: number;
}

export interface ExecuteRefundInput {
  refundCents: number;
}

export function parseCreateOrderInput(value: unknown): CreateOrderInput | null {
  if (!isRecord(value) || !Array.isArray(value.items) || !isRecord(value.recipient)) {
    return null;
  }

  if (value.items.length < 1 || value.items.length > 50) {
    return null;
  }

  const items: OrderItemInput[] = [];
  const seen = new Set<string>();
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.skuId !== 'string' || item.skuId.length < 1 || item.skuId.length > 100 || !Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 99 || seen.has(item.skuId)) {
      return null;
    }
    seen.add(item.skuId);
    items.push({ skuId: item.skuId, quantity: item.quantity as number });
  }

  const recipient = value.recipient;
  const name = readRequiredString(recipient, 'name', 50);
  const mobile = readRequiredString(recipient, 'mobile', 50);
  const province = readRequiredString(recipient, 'province', 50);
  const city = readRequiredString(recipient, 'city', 50);
  const district = readRequiredString(recipient, 'district', 50);
  const address = readRequiredString(recipient, 'address', 200);
  if (!name || !mobile || !province || !city || !district || !address) {
    return null;
  }

  if (!/^1\d{10}$/.test(mobile)) {
    return null;
  }

  return {
    items,
    recipient: {
      name,
      mobile,
      province,
      city,
      district,
      address,
    },
  };
}

export function parseInternalPaymentInput(value: unknown): InternalPaymentInput | null {
  if (!isRecord(value)) {
    return null;
  }
  const welfareCents = value.welfareCents;
  const mealCents = value.mealCents;
  if (!Number.isSafeInteger(welfareCents) || !Number.isSafeInteger(mealCents) || (welfareCents as number) < 0 || (mealCents as number) < 0 || (welfareCents as number) + (mealCents as number) <= 0) {
    return null;
  }
  return {
    welfareCents: welfareCents as number,
    mealCents: mealCents as number,
  };
}

export function parseCreateAfterSaleInput(value: unknown): CreateAfterSaleInput | null {
  if (!isRecord(value)) return null;
  const orderId = readRequiredString(value, 'orderId', 100);
  const reason = readRequiredString(value, 'reason', 500);
  const type = value.type;
  const requestedAmountCents = value.requestedAmountCents;
  if (!orderId || !reason || !['refund_only', 'return_refund', 'exchange'].includes(String(type)) || !Number.isSafeInteger(requestedAmountCents) || (requestedAmountCents as number) <= 0) {
    return null;
  }
  return {
    orderId,
    reason,
    type: type as CreateAfterSaleInput['type'],
    requestedAmountCents: requestedAmountCents as number,
  };
}

export function parseExecuteRefundInput(value: unknown): ExecuteRefundInput | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.refundCents)) {
    return null;
  }
  const refundCents = value.refundCents as number;
  return refundCents > 0 ? { refundCents } : null;
}
