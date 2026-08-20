import { describe, expect, it, vi } from 'vitest';
import type { ApiProduct } from '../services/productionApi';
import { createCatalogPublisher } from './catalogSync';
import { loadCatalogProgressively } from './useProductionSync';

function product(id: string, purchasable: boolean): ApiProduct {
  return {
    id,
    skuId: `${id}-sku`,
    name: id,
    subtitle: null,
    categoryCode: 'food',
    coverUrl: null,
    priceCents: 100,
    marketPriceCents: null,
    availableStock: 1,
    supplierName: 'supplier',
    isTest: false,
    purchasable,
    qualification: {
      visible: true,
      purchasable,
      visibilityReason: purchasable ? 'QUALIFIED' : 'PUBLIC_CATALOG',
      purchaseReason: purchasable ? 'QUALIFIED' : 'LOGIN_REQUIRED',
    },
  };
}

describe('catalog publication precedence', () => {
  it('publishes the first visible page before the remaining directory is fetched', async () => {
    const loadPage = vi.fn(async ({ cursor, limit }: { cursor?: number; limit?: number }) => {
      if (cursor === 0) return { items: [product('first', false)], pagination: { nextCursor: 24 } };
      return { items: [product('later', false)], pagination: { nextCursor: null } };
    });
    const publish = vi.fn();

    await loadCatalogProgressively(loadPage, publish);

    expect(loadPage).toHaveBeenNthCalledWith(1, { cursor: 0, limit: 24 });
    expect(loadPage).toHaveBeenNthCalledWith(2, { cursor: 24, limit: 100 });
    expect(publish.mock.calls.map(([items]) => items.map((item: ApiProduct) => item.id))).toEqual([['first'], ['first', 'later']]);
  });

  it('upgrades a public snapshot when qualified products arrive later', () => {
    const publish = vi.fn();
    const coordinator = createCatalogPublisher(() => true, publish);

    expect(coordinator.commitPublic([product('public', false)])).toBe(true);
    expect(coordinator.commitQualified([product('member', true)])).toBe(true);
    expect(publish.mock.calls.map(([items]) => items[0].id)).toEqual(['public', 'member']);
  });

  it('ignores a late public response after qualified products are committed', () => {
    const publish = vi.fn();
    const coordinator = createCatalogPublisher(() => true, publish);

    expect(coordinator.commitQualified([product('member', true)])).toBe(true);
    expect(coordinator.commitPublic([product('late-public', false)])).toBe(false);
    expect(publish).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0][0][0].id).toBe('member');
  });

  it('keeps the public snapshot available when no qualified commit succeeds', () => {
    const publish = vi.fn();
    const coordinator = createCatalogPublisher(() => true, publish);

    coordinator.commitPublic([product('public-fallback', false)]);
    expect(coordinator.hasPublicFallback()).toBe(true);
    expect(publish.mock.calls[0][0][0].id).toBe('public-fallback');
  });
});
