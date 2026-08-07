import { MOCK_CATEGORIES as SOURCE_CATEGORIES, MOCK_ORDERS as SOURCE_ORDERS, MOCK_PRODUCTS as SOURCE_PRODUCTS } from '../mock/data';
import type { Category, Order, OrderItem, OrderStatus, Product } from '../types';

export type FrontendProduct = Product & {
  imageUrl: string;
  image: string;
  gallery: string[];
  price: number;
  originalPrice: number;
  enterpriseSubsidyAmount: number;
  stockCount: number;
  description: string;
  parameters: Record<string, string>;
  specOptions: Record<string, string[]>;
  allowMealCard: boolean;
  isEnterpriseSubsidized: boolean;
  welfarePrice: number;
  marketPrice: number;
  salesVolume: number;
  applicableStoreName: string;
  category: string;
};

export type FrontendCategory = Category & {
  icon: string;
  description: string;
  subCategories: NonNullable<Category['children']>;
};

export type FrontendOrderItem = OrderItem & {
  product: FrontendProduct;
  priceAtPurchase: number;
};

export type FrontendOrder = Omit<Order, 'items' | 'status'> & {
  orderId: string;
  createdAt: string;
  totalAmount: number;
  welfareDeduction: number;
  statusText: string;
  status: OrderStatus | 'shipping' | 'shipped' | 'paid' | 'pending_pay';
  items: FrontendOrderItem[];
};

function toSpecOptions(product: Product): Record<string, string[]> {
  return Object.fromEntries((product.specs ?? []).map((spec) => [spec.name, spec.options]));
}

function toParameters(product: Product): Record<string, string> {
  return Object.fromEntries((product.params ?? []).map((parameter) => [parameter.key, parameter.value]));
}

export function toFrontendProduct(product: Product): FrontendProduct {
  const primaryImage = product.images[0] ?? '';
  return {
    ...product,
    imageUrl: primaryImage,
    image: primaryImage,
    gallery: product.images.slice(1),
    price: product.priceWelfare,
    originalPrice: product.priceMarket,
    enterpriseSubsidyAmount: Math.max(0, Number((product.priceMarket - product.priceWelfare).toFixed(2))),
    stockCount: product.stock,
    description: product.descriptionDetailText?.join(' ') ?? product.subtitle ?? '智慧翼企业福利商城严选商品。',
    parameters: toParameters(product),
    specOptions: toSpecOptions(product),
    allowMealCard: product.allowedAccounts.includes('meal'),
    isEnterpriseSubsidized: Boolean(product.isEnterpriseExclusive),
    welfarePrice: product.priceWelfare,
    marketPrice: product.priceMarket,
    salesVolume: product.salesCount,
    applicableStoreName: product.nearbyStoreInfo?.storeName ?? product.supplierName,
    category: product.categoryName,
  };
}

function statusText(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending_payment: '待付款',
    pending_shipment: '待发货',
    pending_receipt: '待收货',
    completed: '已完成',
    after_sale: '售后中',
  };
  return labels[status];
}

export function toFrontendProducts(products: Product[]): FrontendProduct[] {
  return products.map(toFrontendProduct);
}

export const MOCK_PRODUCTS: FrontendProduct[] = toFrontendProducts(SOURCE_PRODUCTS);

export const MOCK_CATEGORIES: FrontendCategory[] = SOURCE_CATEGORIES.map((category) => ({
  ...category,
  icon: category.iconName,
  description: category.hotKeywords.join(' · '),
  subCategories: category.children ?? [],
}));

export function toFrontendOrders(orders: Order[], products: FrontendProduct[]): FrontendOrder[] {
  return orders.map((order) => ({
    ...order,
    orderId: order.id,
    createdAt: order.createTime,
    totalAmount: order.payment.finalPaidAmount,
    welfareDeduction: order.payment.welfareDeducted,
    statusText: statusText(order.status),
    items: order.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId) ?? products[0] ?? MOCK_PRODUCTS[0];
      return {
        ...item,
        product: {
          ...product,
          id: item.productId,
          title: item.productTitle,
          images: [item.productImage],
          image: item.productImage,
          imageUrl: item.productImage,
          price: item.price,
          priceMarket: item.price,
          priceMall: item.price,
          priceWelfare: item.price,
          originalPrice: item.price,
          welfarePrice: item.price,
          marketPrice: item.price,
          itemType: item.itemType,
        },
        priceAtPurchase: item.price,
      };
    }),
  }));
}

export const MOCK_ORDERS: FrontendOrder[] = toFrontendOrders(SOURCE_ORDERS, MOCK_PRODUCTS);
