/**
 * 生产数据访问层。
 *
 * 现有页面暂时仍使用 mallService 的演示数据；完成企业身份认证后，
 * 页面只需改为调用此模块，不再直接接触 localStorage。
 */
export interface ApiProduct {
  id: string;
  skuId: string;
  name: string;
  subtitle: string | null;
  categoryCode: string;
  coverUrl: string | null;
  priceCents: number;
  marketPriceCents: number | null;
  availableStock: number;
  supplierName: string;
}

export interface ApiOrder {
  id: string;
  orderNo: string;
  status: string;
  goodsAmountCents: number;
  discountCents: number;
  payableCents: number;
  paidCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  items: Array<{ skuId: string; quantity: number }>;
  recipient: {
    name: string;
    mobile: string;
    province: string;
    city: string;
    district: string;
    address: string;
  };
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

export class ProductionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = "ProductionApiError";
  }
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const body = (await response.json()) as T | ErrorEnvelope;
  if (!response.ok) {
    const error = (body as ErrorEnvelope).error;
    throw new ProductionApiError(
      error?.message ?? "服务请求失败",
      response.status,
      error?.code ?? "UNKNOWN_API_ERROR",
      error?.requestId
    );
  }
  return body as T;
}

export const productionApi = {
  async listProducts(
    mallSlug: string,
    options: { category?: string; cursor?: number; limit?: number } = {}
  ): Promise<{ items: ApiProduct[]; pagination: { nextCursor: number | null } }> {
    const query = new URLSearchParams({ mall: mallSlug });
    if (options.category) query.set("category", options.category);
    if (options.cursor !== undefined) query.set("cursor", String(options.cursor));
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    return apiFetch(`/api/v1/products?${query.toString()}`);
  },

  async listOrders(): Promise<{ items: ApiOrder[] }> {
    return apiFetch("/api/v1/orders");
  },

  async createOrder(
    input: CreateOrderRequest,
    idempotencyKey: string
  ): Promise<{ order: ApiOrder }> {
    return apiFetch("/api/v1/orders", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },

  async payWithInternalAccounts(
    orderId: string,
    allocation: { welfareCents: number; mealCents: number },
    idempotencyKey: string
  ): Promise<{
    payment: {
      orderId: string;
      status: string;
      amountCents: number;
      completedAt: string;
    };
  }> {
    return apiFetch(
      `/api/v1/orders/${encodeURIComponent(orderId)}/payments/internal`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(allocation),
      }
    );
  },
};
