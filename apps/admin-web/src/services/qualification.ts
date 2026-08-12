export interface QualificationCenterData {
  catalogPools: Array<{ id: string; code: string; name: string; kind: 'source' | 'selected' | 'combined'; status: string; itemCount: number }>;
  cityZones: Array<{ id: string; code: string; name: string; appliesTo: 'visible' | 'purchasable' | 'both'; status: string; cityCount: number; itemCount: number }>;
  policies: Array<{ id: string; name: string; action: 'visible' | 'purchasable'; effect: 'allow' | 'deny'; priority: number; status: string; version: number; subjectCount: number; resourceCount: number }>;
  limitTemplates: Array<{
    id: string;
    code: string;
    name: string;
    countScope: 'sku' | 'product';
    status: string;
    version: number;
    maxPerOrderQty: number | null;
    maxDailyQty: number | null;
    maxMonthlyQty: number | null;
    maxLifetimeQty: number | null;
  }>;
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
  const response = await fetch('/api/v1/admin/qualification-center', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`QUALIFICATION_CENTER_REQUEST_FAILED_${response.status}`);
  return (await response.json()) as QualificationCenterData;
}
