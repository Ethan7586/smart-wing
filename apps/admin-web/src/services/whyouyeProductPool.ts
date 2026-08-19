export type WhyouyePoolSource = 1 | 7 | 11 | 18 | 26 | 52 | 54 | 55 | 63 | 104 | 108;

export interface WhyouyePricing {
  priceWay?: 'adjust' | 'fixed';
  priceType?: 'markPrice' | 'supplyPrice' | 'priceSetting' | 'jdSellPrice' | 'eventPrice' | 'packPrice' | 'businessPrice';
  priceAdjust?: 'incr' | 'desc';
  priceVal?: string;
  priceUnit?: 'profit' | 'rmb';
  distribPriceWay?: 'adjust' | 'fixed';
  distribPriceType?: 'markPrice' | 'supplyPrice' | 'priceSetting' | 'jdSellPrice' | 'eventPrice' | 'packPrice' | 'businessPrice';
  distribPriceAdjust?: 'incr' | 'desc';
  distribPriceVal?: string;
  distribPriceUnit?: 'profit' | 'rmb';
  distribPriceSetting?: string;
  salePriceSetting?: string;
}

export interface WhyouyeIntegrationStatus {
  capabilities: {
    generalPoolEnroll: boolean;
    jdVopPoolEnroll: boolean;
    catalogRead: boolean;
    arbitraryProductCreate: boolean;
    fileImport: boolean;
  };
  externalWritePolicy: 'explicit-confirmation';
}

export interface PoolPreviewResult {
  mode: 'preview' | 'commit';
  endpoint: string;
  productCount: number;
  requestId: string;
  payload?: Record<string, unknown>;
  remote?: { httpStatus: number; code: number; message: string | null };
}

async function parseResponse(response: Response): Promise<PoolPreviewResult> {
  const payload = (await response.json().catch(() => null)) as { error?: { message?: unknown }; message?: unknown } & Partial<PoolPreviewResult> | null;
  if (!response.ok) {
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : typeof payload?.message === 'string' ? payload.message : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  if (!payload || typeof payload.endpoint !== 'string' || typeof payload.productCount !== 'number') throw new Error('甲方商品池响应格式异常');
  return payload as PoolPreviewResult;
}

export async function getWhyouyeIntegrationStatus(): Promise<WhyouyeIntegrationStatus> {
  const response = await fetch('/api/v1/admin/integrations/whyouye/status', { credentials: 'same-origin' });
  const payload = (await response.json().catch(() => null)) as { capabilities?: unknown; externalWritePolicy?: unknown; error?: { message?: unknown } } | null;
  if (!response.ok) throw new Error(typeof payload?.error?.message === 'string' ? payload.error.message : `读取对接状态失败（${response.status}）`);
  if (!payload || typeof payload.capabilities !== 'object' || payload.capabilities === null || payload.externalWritePolicy !== 'explicit-confirmation') {
    throw new Error('甲方对接状态响应格式异常');
  }
  return payload as WhyouyeIntegrationStatus;
}

export async function enrollWhyouyeGeneralPool(input: {
  mode: 'preview' | 'commit';
  source: WhyouyePoolSource;
  remoteProductIds: string[];
  pricing?: WhyouyePricing;
  targetSiteIds?: string[];
  operStatus?: 3 | 4;
}): Promise<PoolPreviewResult> {
  const response = await fetch('/api/v1/admin/integrations/whyouye/pool-enroll', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(input.mode === 'commit' ? { 'x-confirm-external-write': 'commit' } : {}),
    },
    body: JSON.stringify(input),
  });
  return parseResponse(response);
}

export async function enrollWhyouyeJdVopPool(input: { mode: 'preview' | 'commit'; remoteProductIds: string[]; targetPool: 'standard' | 'fresh' }): Promise<PoolPreviewResult> {
  const response = await fetch('/api/v1/admin/integrations/whyouye/jd-vop-pool-enroll', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(input.mode === 'commit' ? { 'x-confirm-external-write': 'commit' } : {}),
    },
    body: JSON.stringify(input),
  });
  return parseResponse(response);
}
