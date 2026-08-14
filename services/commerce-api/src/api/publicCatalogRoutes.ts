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
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '24', 10) || 24, 1), 100);
  const cursor = Math.max(Number.parseInt(url.searchParams.get('cursor') ?? '0', 10) || 0, 0);
  const rows = await callRpc<PublicCatalogRow[]>(env, 'api_catalog', {
    p_mall_slug: mallSlug,
    p_category: category,
    p_limit: limit,
    p_offset: cursor,
  });

  return json({
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
}
