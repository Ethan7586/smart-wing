import { isRecord, readOptionalRecord, readOptionalString, readOptionalUrl, readRequiredString } from './inputPrimitives';

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

function isSourceCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{1,39}$/.test(value);
}
