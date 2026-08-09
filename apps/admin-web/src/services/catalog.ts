import type { Product, ProductStatus } from '../types';

type CatalogItem = {
  id?: unknown;
  skuId?: unknown;
  name?: unknown;
  nameZh?: unknown;
  supplierName?: unknown;
  categoryCode?: unknown;
  coverUrl?: unknown;
  marketPriceCents?: unknown;
  priceCents?: unknown;
  availableStock?: unknown;
};

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toAdminProduct(item: CatalogItem): Product {
  const id = text(item.id, text(item.skuId, crypto.randomUUID()));
  const stock = number(item.availableStock);
  const status: ProductStatus = stock > 0 ? '已发布' : '已下架';
  const title = text(item.nameZh, text(item.name, '未命名商品'));
  const supplierName = text(item.supplierName, '未标注供应商');

  return {
    id,
    spuCode: text(item.skuId, id),
    title,
    brand: supplierName,
    supplierId: supplierName,
    supplierName,
    categoryL1: text(item.categoryCode, '未分类'),
    supplierCategory: text(item.categoryCode, '未分类'),
    costPrice: number(item.marketPriceCents) / 100,
    mallPrice: number(item.priceCents) / 100,
    enterprisePrice: number(item.priceCents) / 100,
    stock,
    status,
    riskLevel: '低',
    missingFields: [],
    reviewer: '生产目录同步',
    visibleEnterprises: ['ALL'],
    mainImage: text(item.coverUrl),
    secondaryImages: [],
    skus: [],
    checklist: { category: true, price: true, stock: true, agreement: true, images: Boolean(text(item.coverUrl)), visibility: true },
    versions: [],
  };
}

/** Reads the production catalogue through commerce-api; no write action uses this adapter. */
export async function loadLiveCatalog(): Promise<Product[]> {
  const response = await fetch('/api/v1/products?limit=100', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`CATALOG_REQUEST_FAILED_${response.status}`);
  const payload = await response.json() as { items?: unknown };
  if (!Array.isArray(payload.items)) throw new Error('CATALOG_RESPONSE_INVALID');
  return payload.items.filter((item): item is CatalogItem => typeof item === 'object' && item !== null).map(toAdminProduct);
}
