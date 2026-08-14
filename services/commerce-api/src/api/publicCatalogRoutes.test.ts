import { afterEach, describe, expect, it, vi } from 'vitest';
import { handlePublicCatalog } from './publicCatalogRoutes';
import { routeApi } from './router';
import type { WorkerEnv } from './types';

afterEach(() => vi.unstubAllGlobals());

const env: WorkerEnv = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
};

const catalogRow = {
  id: 'product-one',
  sku_id: 'sku-one',
  name: '公开商品',
  name_en: null,
  name_zh: '公开商品',
  subtitle: '所有访客可见',
  subtitle_en: null,
  subtitle_zh: '所有访客可见',
  category_code: 'food',
  taxonomy_l1: 'food',
  taxonomy_l2: 'food_snack',
  taxonomy_l3: 'food_snack_nuts',
  classification_status: 'approved',
  cover_url: 'https://mall.hbbtzn.com/product-one.webp',
  price_cents: 2590,
  market_price_cents: 2990,
  available_stock: 12,
  supplier_name: '公开供应商',
  is_test: false,
};

describe('public catalog', () => {
  it('returns the shared Shop catalog without creating a member session', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([catalogRow]), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await routeApi(new Request('https://hbbtzn.com/api/v1/catalog/public/products?limit=24'), env);

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      items: [
        {
          id: 'product-one',
          priceCents: 2590,
          purchasable: false,
          qualification: { visible: true, purchasable: false, visibilityReason: 'PUBLIC_CATALOG', purchaseReason: 'LOGIN_REQUIRED' },
        },
      ],
      access: { mode: 'public', memberPricing: false, purchaseQualification: false },
    });
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody).toEqual({ p_mall_slug: 'smart-wing-demo', p_category: null, p_limit: 24, p_offset: 0 });
  });

  it('rejects malformed server-side mall configuration before database access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products'), { ...env, PUBLIC_MALL_SLUG: '../secret' }, 'bad-mall');

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PUBLIC_CATALOG_NOT_CONFIGURED' } });
  });

  it('keeps writes disabled on the public catalog endpoint', async () => {
    const response = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products', { method: 'POST' }), env, 'catalog-method');

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
