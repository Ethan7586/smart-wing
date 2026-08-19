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
export interface CatalogImportItem {
  externalSpuId: string;
  externalSkuId: string;
  name: string;
  nameZh: string | null;
  subtitle: string | null;
  sourceCategory: string | null;
  coverUrl: string | null;
  detail: Record<string, unknown>;
  specs: Record<string, unknown>;
  priceCents: number;
  marketPriceCents: number | null;
  availableStock: number;
  status: 'active' | 'inactive';
}

export interface CatalogImportInput {
  source: string;
  supplierName: string | null;
  items: CatalogImportItem[];
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
export function parseCatalogImportInput(value: unknown): CatalogImportInput | null {
  if (!isRecord(value) || !isSourceCode(value.source) || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 100) return null;
  const supplierName = readOptionalString(value, 'supplierName', 120);
  if (supplierName === undefined) return null;
  const items: CatalogImportItem[] = [];
  const seenSkuIds = new Set<string>();
  for (const candidate of value.items) {
    if (!isRecord(candidate)) return null;
    const externalSpuId = readRequiredString(candidate, 'externalSpuId', 160);
    const externalSkuId = readRequiredString(candidate, 'externalSkuId', 160);
    const name = readRequiredString(candidate, 'name', 500);
    const nameZh = readOptionalString(candidate, 'nameZh', 500);
    const subtitle = readOptionalString(candidate, 'subtitle', 500);
    const sourceCategory = readOptionalString(candidate, 'sourceCategory', 200);
    const coverUrl = readOptionalUrl(candidate, 'coverUrl');
    const detail = readOptionalRecord(candidate, 'detail');
    const specs = readOptionalRecord(candidate, 'specs');
    const priceCents = candidate.priceCents;
    const marketPriceCents = candidate.marketPriceCents;
    const availableStock = candidate.availableStock;
    const status = candidate.status;
    if (
      !externalSpuId ||
      !externalSkuId ||
      !name ||
      nameZh === undefined ||
      subtitle === undefined ||
      sourceCategory === undefined ||
      coverUrl === undefined ||
      detail === undefined ||
      specs === undefined ||
      !Number.isSafeInteger(priceCents) ||
      (priceCents as number) < 0 ||
      (marketPriceCents !== undefined && marketPriceCents !== null && (!Number.isSafeInteger(marketPriceCents) || (marketPriceCents as number) < (priceCents as number))) ||
      !Number.isSafeInteger(availableStock) ||
      (availableStock as number) < 0 ||
      (availableStock as number) > 2_147_483_647 ||
      (status !== undefined && status !== 'active' && status !== 'inactive') ||
      seenSkuIds.has(externalSkuId)
    ) {
      return null;
    }
    seenSkuIds.add(externalSkuId);
    items.push({
      externalSpuId,
      externalSkuId,
      name,
      nameZh: nameZh ?? null,
      subtitle: subtitle ?? null,
      sourceCategory: sourceCategory ?? null,
      coverUrl: coverUrl ?? null,
      detail: detail ?? {},
      specs: specs ?? {},
      priceCents: priceCents as number,
      marketPriceCents: marketPriceCents === undefined || marketPriceCents === null ? null : (marketPriceCents as number),
      availableStock: availableStock as number,
      status: status === 'inactive' ? 'inactive' : 'active',
    });
  }
  return { source: value.source, supplierName: supplierName ?? null, items };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(record: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = record[key];
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function readOptionalString(record: Record<string, unknown>, key: string, maxLength: number): string | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : undefined;
}

function readOptionalRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return undefined;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 16 * 1024 ? value : undefined;
  } catch {
    return undefined;
  }
}

function readOptionalUrl(record: Record<string, unknown>, key: string): string | null | undefined {
  const value = readOptionalString(record, key, 2_000);
  if (value === null || value === undefined) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isSourceCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{1,39}$/.test(value);
}
