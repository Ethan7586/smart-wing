import { apiError, json, methodNotAllowed } from './http';
import { callRpc } from './supabase';
import type { WorkerEnv } from './types';

interface PublicCatalogRow {
  id: string;
  sku_id: string;
  name: string;
  name_en: string | null;
  name_zh: string | null;
  subtitle: string | null;
  subtitle_en: string | null;
  subtitle_zh: string | null;
  category_code: string;
  taxonomy_l1: string | null;
  taxonomy_l2: string | null;
  taxonomy_l3: string | null;
  classification_status: string;
  cover_url: string | null;
  price_cents: number;
  market_price_cents: number | null;
  available_stock: number;
  supplier_name: string;
  is_test: boolean;
}

const DEFAULT_PUBLIC_MALL_SLUG = 'smart-wing-demo';
const MALL_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const CATALOG_CACHE_TTL_MS = 60_000;
const CATALOG_CACHE_MAX_ENTRIES = 32;
const CATALOG_RPC_PAGE_SIZE = 100;
const catalogCache = new Map<string, { rows: PublicCatalogRow[]; expiresAt: number }>();

export function clearPublicCatalogCache(): void {
  catalogCache.clear();
}

async function queryCatalogRows(env: WorkerEnv, mallSlug: string, category: string | null, limit: number, cursor: number): Promise<PublicCatalogRow[]> {
  const rows: PublicCatalogRow[] = [];
  while (rows.length < limit) {
    const pageLimit = Math.min(CATALOG_RPC_PAGE_SIZE, limit - rows.length);
    const rpcName = category ? 'api_catalog' : 'api_public_catalog_window';
    const args = category ? { p_mall_slug: mallSlug, p_category: category, p_limit: pageLimit, p_offset: cursor + rows.length } : { p_mall_slug: mallSlug, p_limit: pageLimit, p_offset: cursor + rows.length };
    const page = await callRpc<PublicCatalogRow[]>(env, rpcName, args);
    rows.push(...page);
    if (page.length < pageLimit) break;
  }
  return rows;
}

async function cachedCatalogRows(env: WorkerEnv, mallSlug: string, category: string | null, limit: number, cursor: number): Promise<{ rows: PublicCatalogRow[]; hit: boolean }> {
  const key = [env.SUPABASE_URL, mallSlug, category ?? '', limit, cursor].join('|');
  const now = Date.now();
  const cached = catalogCache.get(key);
  if (cached && cached.expiresAt > now) return { rows: cached.rows, hit: true };
  if (cached) catalogCache.delete(key);
  const rows = await queryCatalogRows(env, mallSlug, category, limit, cursor);
  if (catalogCache.size >= CATALOG_CACHE_MAX_ENTRIES) {
    const oldest = catalogCache.keys().next().value;
    if (oldest) catalogCache.delete(oldest);
  }
  catalogCache.set(key, { rows, expiresAt: now + CATALOG_CACHE_TTL_MS });
  return { rows, hit: false };
}

/** Public browsing returns the same active SKU rows as the main Shop.
 * Membership-specific visibility, prices and purchase qualification stay on
 * the authenticated /products endpoint and are never inferred here.
 */
export async function handlePublicCatalog(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const url = new URL(request.url);
  const mallSlug = env.PUBLIC_MALL_SLUG?.trim() || DEFAULT_PUBLIC_MALL_SLUG;
  if (!MALL_SLUG_PATTERN.test(mallSlug)) return apiError(503, 'PUBLIC_CATALOG_NOT_CONFIGURED', '公开商城目录尚未正确配置', requestId);
  const category = url.searchParams.get('category')?.slice(0, 80) ?? null;
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '200', 10) || 200, 1), 200);
  const cursor = Math.max(Number.parseInt(url.searchParams.get('cursor') ?? '0', 10) || 0, 0);
  const catalog = await cachedCatalogRows(env, mallSlug, category, limit, cursor);
  const rows = catalog.rows;

  const response = json({
    items: rows.map((row) => ({
      id: row.id,
      skuId: row.sku_id,
      name: row.name,
      nameEn: row.name_en,
      nameZh: row.name_zh,
      subtitle: row.subtitle,
      subtitleEn: row.subtitle_en,
      subtitleZh: row.subtitle_zh,
      categoryCode: row.category_code,
      taxonomy: {
        l1: row.taxonomy_l1,
        l2: row.taxonomy_l2,
        l3: row.taxonomy_l3,
        status: row.classification_status,
      },
      coverUrl: row.cover_url,
      priceCents: Number(row.price_cents),
      marketPriceCents: row.market_price_cents === null ? null : Number(row.market_price_cents),
      availableStock: row.available_stock,
      supplierName: row.supplier_name,
      isTest: row.is_test,
      purchasable: false,
      qualification: {
        visible: true,
        purchasable: false,
        visibilityReason: 'PUBLIC_CATALOG',
        purchaseReason: 'LOGIN_REQUIRED',
      },
    })),
    access: { mode: 'public', memberPricing: false, purchaseQualification: false },
    pagination: {
      cursor,
      nextCursor: rows.length === limit ? cursor + limit : null,
      limit,
    },
    requestId,
  });
  response.headers.set('cache-control', 'public, max-age=60, stale-while-revalidate=300');
  response.headers.set('x-sw-catalog-cache', catalog.hit ? 'hit' : 'miss');
  return response;
}
