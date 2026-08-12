export type QualificationStatus = 'draft' | 'active' | 'disabled';
export type QualificationConfigKind = 'catalog_pool' | 'supplier_agreement' | 'brand' | 'store' | 'city_zone' | 'entitlement_policy' | 'purchase_limit';
export type QualificationSelector = { kind: string; id: string };
export type Option = { id: string; name: string; productId?: string };
export type CatalogPool = { id: string; code: string; name: string; kind: 'selected' | 'combined'; status: QualificationStatus; version: number; skuIds: string[]; itemCount: number };
export type CityZone = {
  id: string;
  code: string;
  name: string;
  appliesTo: 'visible' | 'purchasable' | 'both';
  status: QualificationStatus;
  version: number;
  cities: Array<{ code: string; name: string }>;
  resources: QualificationSelector[];
  cityCount: number;
  itemCount: number;
};
export type EntitlementPolicy = {
  id: string;
  name: string;
  action: 'visible' | 'purchasable';
  effect: 'allow' | 'deny';
  priority: number;
  reasonCode: string;
  status: QualificationStatus;
  version: number;
  subjects: QualificationSelector[];
  resources: QualificationSelector[];
  subjectCount: number;
  resourceCount: number;
};
export type PurchaseLimit = {
  id: string;
  code: string;
  name: string;
  countScope: 'sku' | 'product';
  status: QualificationStatus;
  version: number;
  maxPerOrderQty: number | null;
  maxDailyQty: number | null;
  maxMonthlyQty: number | null;
  maxLifetimeQty: number | null;
  maxPerOrderAmountCents: number | null;
  maxDailyAmountCents: number | null;
  maxMonthlyAmountCents: number | null;
  maxLifetimeAmountCents: number | null;
  subjects: QualificationSelector[];
  resources: QualificationSelector[];
};
export type SupplierAgreement = { id: string; supplierId: string; agreementCode: string; settlementMode: string; status: QualificationStatus; version: number };
export type Brand = { id: string; code: string; name: string; status: QualificationStatus; version: number; supplierIds: string[]; productIds: string[]; authorizedInMall: boolean };
export type StoreResource = {
  id: string;
  code: string;
  name: string;
  storeType: 'online' | 'offline' | 'hybrid';
  provinceCode: string | null;
  cityCode: string | null;
  addressText: string | null;
  status: QualificationStatus;
  version: number;
  brandIds: string[];
};

export interface QualificationCenterData {
  catalogPools: CatalogPool[];
  cityZones: CityZone[];
  policies: EntitlementPolicy[];
  limitTemplates: PurchaseLimit[];
  commercialResources: { agreements: SupplierAgreement[]; brands: Brand[]; stores: StoreResource[] };
  selectors: { enterprises: Option[]; suppliers: Option[]; products: Option[]; skus: Option[]; departments: Option[]; users: Option[]; memberships: Option[] };
  commercialSummary: { brands: number; stores: number; supplierAgreements: number; brandAuthorizations: number };
  capabilities: {
    readCommercialResources: boolean;
    manageCommercialResources: boolean;
    readEntitlements: boolean;
    manageEntitlements: boolean;
    readPurchaseLimits: boolean;
    managePurchaseLimits: boolean;
  };
}

export async function loadQualificationCenter(): Promise<QualificationCenterData> {
  return requestJson('/api/v1/admin/qualification-center');
}

export async function saveQualificationConfig(input: { kind: QualificationConfigKind; entityId: string | null; expectedVersion: number; payload: Record<string, unknown>; reason: string }): Promise<Record<string, unknown>> {
  return requestJson('/api/v1/admin/qualification-center/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? `资格服务请求失败 (${response.status})`);
  return payload as T;
}
