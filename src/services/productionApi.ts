/**
 * 生产数据访问层。
 *
 * 所有生产业务数据均通过同源服务端 API 访问，浏览器不接触数据库密钥。
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
  isTest: boolean;
}

export interface ApiOrder {
  id: string;
  orderNo: string;
  status: string;
  goodsAmountCents: number;
  discountCents: number;
  payableCents: number;
  paidCents: number;
  welfarePaidCents?: number;
  mealPaidCents?: number;
  createdAt: string;
  updatedAt: string;
  items?: Array<{
    productId: string;
    productTitle: string;
    productImage: string | null;
    priceCents: number;
    quantity: number;
    specs: Record<string, string>;
    itemType: string;
  }>;
}

export interface ApiAccount {
  id: string;
  type: "welfare" | "meal";
  balanceCents: number;
  status: string;
  updatedAt: string;
}

export interface ApiAccountLedger {
  id: string;
  accountType: "welfare" | "meal";
  direction: "credit" | "debit";
  amountCents: number;
  balanceAfterCents: number;
  businessType: string;
  businessId: string;
  orderNo: string | null;
  createdAt: string;
}

export interface ApiAfterSale {
  id: string;
  afterSaleNo: string;
  orderId: string;
  orderNo: string;
  type: "refund_only" | "return_refund" | "exchange";
  status: string;
  reason: string;
  requestedAmountCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiActor {
  userId: string;
  employeeNo: string;
  roles: string[];
  permissions: string[];
}

export interface ApiBootstrap {
  actor: ApiActor;
  scope: {
    tenantId: string;
    enterpriseId: string;
    mallId: string;
    mallCode: string;
    mallName: string;
    brandName: string;
    enterpriseName: string;
  };
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
  async getHealth(): Promise<{
    status: string;
    checks: {
      database: string;
      authentication: string;
      piiEncryption: string;
    };
    database: { provider: string; region: string };
  }> {
    return apiFetch("/api/health");
  },

  async getSession(): Promise<{ authenticated: true; actor: ApiActor }> {
    return apiFetch("/api/v1/auth/session");
  },

  async login(accessCode: string): Promise<{ authenticated: true; actor: ApiActor }> {
    return apiFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ accessCode }),
    });
  },

  async logout(): Promise<{ authenticated: false }> {
    return apiFetch("/api/v1/auth/logout", { method: "POST" });
  },

  async getBootstrap(): Promise<ApiBootstrap> {
    return apiFetch("/api/v1/bootstrap");
  },

  async listAccounts(): Promise<{ items: ApiAccount[] }> {
    return apiFetch("/api/v1/accounts");
  },

  async listAccountLedgers(): Promise<{ items: ApiAccountLedger[] }> {
    return apiFetch("/api/v1/account-ledgers");
  },

  async listAfterSales(): Promise<{ items: ApiAfterSale[] }> {
    return apiFetch("/api/v1/after-sales");
  },

  async createAfterSale(input: {
    orderId: string;
    type: ApiAfterSale["type"];
    reason: string;
    requestedAmountCents: number;
  }): Promise<{ afterSale: ApiAfterSale }> {
    return apiFetch("/api/v1/after-sales", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

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
