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
    if (
      !isRecord(item) ||
      typeof item.skuId !== "string" ||
      item.skuId.length < 1 ||
      item.skuId.length > 100 ||
      !Number.isInteger(item.quantity) ||
      (item.quantity as number) < 1 ||
      (item.quantity as number) > 99 ||
      seen.has(item.skuId)
    ) {
      return null;
    }
    seen.add(item.skuId);
    items.push({ skuId: item.skuId, quantity: item.quantity as number });
  }

  const recipient = value.recipient;
  const name = readRequiredString(recipient, "name", 50);
  const mobile = readRequiredString(recipient, "mobile", 50);
  const province = readRequiredString(recipient, "province", 50);
  const city = readRequiredString(recipient, "city", 50);
  const district = readRequiredString(recipient, "district", 50);
  const address = readRequiredString(recipient, "address", 200);
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

export function parseInternalPaymentInput(
  value: unknown
): InternalPaymentInput | null {
  if (!isRecord(value)) {
    return null;
  }
  const welfareCents = value.welfareCents;
  const mealCents = value.mealCents;
  if (
    !Number.isSafeInteger(welfareCents) ||
    !Number.isSafeInteger(mealCents) ||
    (welfareCents as number) < 0 ||
    (mealCents as number) < 0 ||
    (welfareCents as number) + (mealCents as number) <= 0
  ) {
    return null;
  }
  return {
    welfareCents: welfareCents as number,
    mealCents: mealCents as number,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number
): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength
    ? normalized
    : null;
}
