import { hasArrayProperties, hasRecordProperties, isJsonRecord, requestAdminJson } from './adminJson';

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
export type QualificationImpactPreview = { requiresApproval: boolean; riskLevel: 'elevated' | 'high' | 'critical'; affectedEmployees: number; affectedSkus: number; currentStatus: string | null; requestedStatus: string; reasons: string[] };
export type QualificationChangeRequest = {
  id: string;
  kind: QualificationConfigKind;
  entityId: string | null;
  expectedVersion: number;
  requestedStatus: QualificationStatus;
  reason: string;
  riskLevel: string;
  status: 'pending' | 'rejected' | 'applied' | 'stale' | 'cancelled';
  preview: QualificationImpactPreview;
  requesterName: string;
  requesterMembershipId: string;
  reviewerName: string | null;
  reviewReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
export type EmployeeQualificationTag = { code: string; startsAt: string | null; endsAt: string | null; source: string };
export type EmployeeQualification = {
  userId: string;
  membershipId: string;
  name: string;
  employeeNo: string;
  departmentId: string | null;
  departmentName: string | null;
  cityCode: string | null;
  cityName: string | null;
  status: 'active' | 'disabled';
  version: number;
  tags: EmployeeQualificationTag[];
};
export type QualificationGovernanceData = {
  changeRequests: QualificationChangeRequest[];
  employees: EmployeeQualification[];
  currentMembershipId: string;
  capabilities: { readEmployees: boolean; manageEmployees: boolean; approveChanges: boolean; simulate: boolean };
};
export type QualificationHistoryItem = { auditId: string; version: number; status: QualificationStatus; config: Record<string, unknown>; reason: string; actorUserId: string; actorMembershipId: string; createdAt: string };

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
    readEmployees: boolean;
    manageEmployees: boolean;
    approveChanges: boolean;
    simulate: boolean;
  };
}

export async function loadQualificationCenter(): Promise<QualificationCenterData> {
  return requestAdminJson('/api/v1/admin/qualification-center', { label: '资格服务', validate: isQualificationCenterData });
}

export async function saveQualificationConfig(input: { kind: QualificationConfigKind; entityId: string | null; expectedVersion: number; payload: Record<string, unknown>; reason: string }): Promise<Record<string, unknown>> {
  return requestJson('/api/v1/admin/qualification-center/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}

export async function previewQualificationConfig(input: { kind: QualificationConfigKind; entityId: string | null; expectedVersion: number; payload: Record<string, unknown>; reason: string }): Promise<QualificationImpactPreview> {
  return requestJson('/api/v1/admin/qualification-center/preview', jsonRequest(input));
}
export async function loadQualificationGovernance(): Promise<QualificationGovernanceData> {
  return requestAdminJson('/api/v1/admin/qualification-center/governance', { label: '资格服务', validate: isQualificationGovernanceData });
}
export async function reviewQualificationChange(input: { changeRequestId: string; decision: 'approve' | 'reject'; reason: string }): Promise<Record<string, unknown>> {
  return requestJson('/api/v1/admin/qualification-center/review', jsonRequest(input));
}
export async function loadQualificationHistory(kind: QualificationConfigKind, entityId: string): Promise<QualificationHistoryItem[]> {
  const payload = await requestAdminJson<{ history: QualificationHistoryItem[] }>(`/api/v1/admin/qualification-center/history?kind=${encodeURIComponent(kind)}&entityId=${encodeURIComponent(entityId)}`, {
    label: '资格服务',
    validate: (value): value is { history: QualificationHistoryItem[] } => hasArrayProperties(value, ['history']),
  });
  return payload.history;
}
export async function rollbackQualificationConfig(input: { kind: QualificationConfigKind; entityId: string; auditId: string; expectedVersion: number; reason: string }): Promise<Record<string, unknown>> {
  return requestJson('/api/v1/admin/qualification-center/rollback', { ...jsonRequest(input), headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() } });
}
export async function simulateQualification(input: { userId: string; membershipId: string; skuId: string; quantity: number; cityCode?: string | null; cityName?: string | null }): Promise<Record<string, unknown>> {
  return requestJson('/api/v1/admin/qualification-center/simulate', jsonRequest(input));
}
export async function updateEmployeeQualification(
  userId: string,
  input: {
    expectedVersion: number;
    cityCode: string | null;
    cityName: string | null;
    status: 'active' | 'disabled';
    attributes: Record<string, unknown>;
    tags: Array<{ code: string; startsAt: string | null; endsAt: string | null }>;
    reason: string;
  }
): Promise<Record<string, unknown>> {
  return requestJson(`/api/v1/admin/qualification-center/employees/${encodeURIComponent(userId)}`, { ...jsonRequest(input), method: 'PUT' });
}

function jsonRequest(input: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) };
}

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return requestAdminJson<T>(url, { label: '资格服务', ...init });
}

function isQualificationCenterData(payload: unknown): payload is QualificationCenterData {
  if (!hasArrayProperties(payload, ['catalogPools', 'cityZones', 'policies', 'limitTemplates']) || !hasRecordProperties(payload, ['commercialResources', 'selectors', 'commercialSummary', 'capabilities'])) {
    return false;
  }
  const resources = payload.commercialResources;
  const selectors = payload.selectors;
  return hasArrayProperties(resources, ['agreements', 'brands', 'stores']) && hasArrayProperties(selectors, ['enterprises', 'suppliers', 'products', 'skus', 'departments', 'users', 'memberships']);
}

function isQualificationGovernanceData(payload: unknown): payload is QualificationGovernanceData {
  return hasArrayProperties(payload, ['changeRequests', 'employees']) && isJsonRecord(payload) && isJsonRecord(payload.capabilities) && typeof payload.currentMembershipId === 'string';
}
