import { describe, expect, it } from 'vitest';
import { MOCK_PRODUCTS } from '../mock/data';
import { toFrontendOrders, toFrontendProducts } from './frontendData';

describe('multi-device frontend data adapter', () => {
  it('preserves production identifiers and SKU references', () => {
    const source = {
      ...MOCK_PRODUCTS[0],
      id: 'product-live',
      skuId: 'sku-live',
      priceMarket: 120,
      priceWelfare: 90,
      images: ['https://example.com/live.jpg'],
    };

    const [adapted] = toFrontendProducts([source]);

    expect(adapted.id).toBe('product-live');
    expect(adapted.skuId).toBe('sku-live');
    expect(adapted.imageUrl).toBe('https://example.com/live.jpg');
    expect(adapted.enterpriseSubsidyAmount).toBe(30);
  });

  it('maps real order rows without replacing order identity', () => {
    const products = toFrontendProducts(MOCK_PRODUCTS);
    const order = {
      id: 'order-live',
      orderNo: 'SW-LIVE-001',
      enterpriseId: 'enterprise-live',
      enterpriseName: '测试集团',
      mallId: 'mall-live',
      mallName: '测试商城',
      supplierId: 'supplier-live',
      supplierName: '测试供应商',
      supplierType: 'third_party' as const,
      status: 'pending_receipt' as const,
      createTime: '2026-07-24T10:00:00.000Z',
      items: [
        {
          productId: products[0].id,
          productTitle: products[0].title,
          productImage: products[0].imageUrl,
          price: products[0].price,
          quantity: 1,
          specText: '标准规格',
          itemType: products[0].itemType,
        },
      ],
      payment: {
        totalGoodsAmount: products[0].price,
        shippingFee: 0,
        welfareDeducted: products[0].price,
        mealDeducted: 0,
        wechatPaid: 0,
        finalPaidAmount: products[0].price,
        payMethodText: '福利账户支付',
      },
    };

    const [adapted] = toFrontendOrders([order], products);

    expect(adapted.id).toBe('order-live');
    expect(adapted.orderNo).toBe('SW-LIVE-001');
    expect(adapted.statusText).toBe('待收货');
    expect(adapted.items[0].product.id).toBe(products[0].id);
  });
});
