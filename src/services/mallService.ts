/**
 * 智慧翼企业福利商城 - 业务服务与 API 模拟层
 * 处理商品搜索/筛选/排序、购物车、订单拆单、福利账户扣减与状态流转
 * 预留 REST API 端点集成接口
 * 技术服务方：雍彻科技
 */

import {
  Product,
  CartItem,
  Order,
  UserProfile,
  EnterpriseMall,
  AccountLog,
  UserCoupon,
  AfterSaleRecord,
  DeliveryAddress,
  OrderStatus,
  ProductItemType
} from '../types';

import {
  MOCK_PRODUCTS,
  MOCK_ENTERPRISE_MALLS,
  MOCK_USER,
  MOCK_ORDERS,
  MOCK_ACCOUNT_LOGS,
  MOCK_USER_COUPONS,
  MOCK_AFTER_SALES,
  MOCK_ADDRESSES
} from '../mock/data';

const STORAGE_KEYS = {
  USER: 'zhy_mall_user_profile',
  CART: 'zhy_mall_cart_items',
  ORDERS: 'zhy_mall_orders',
  LOGS: 'zhy_mall_account_logs',
  COUPONS: 'zhy_mall_user_coupons',
  AFTER_SALES: 'zhy_mall_after_sales',
  ADDRESSES: 'zhy_mall_addresses',
  FAVORITES: 'zhy_mall_favorites',
  MALL_ID: 'zhy_mall_current_id'
};

class MallService {
  private user: UserProfile;
  private cart: CartItem[];
  private orders: Order[];
  private logs: AccountLog[];
  private coupons: UserCoupon[];
  private afterSales: AfterSaleRecord[];
  private addresses: DeliveryAddress[];
  private favorites: string[]; // Product IDs
  private currentMallId: string;

  constructor() {
    // Load or initialize state
    this.currentMallId = this.loadFromStorage(STORAGE_KEYS.MALL_ID, MOCK_USER.currentMallId);
    this.user = this.loadFromStorage(STORAGE_KEYS.USER, MOCK_USER);
    const defaultCart: CartItem[] = [
      {
        id: 'cart_01',
        productId: 'p_101',
        product: MOCK_PRODUCTS[0],
        quantity: 1,
        selectedSpec: { '规格重量': '10kg/袋' },
        selected: true,
        distributorId: MOCK_USER.distributorId
      },
      {
        id: 'cart_02',
        productId: 'p_701',
        product: MOCK_PRODUCTS[14], // 星巴克100元电子卡
        quantity: 2,
        selectedSpec: { '卡面金额': '100元电子卡' },
        selected: true,
        distributorId: MOCK_USER.distributorId
      }
    ];
    this.cart = this.loadFromStorage(STORAGE_KEYS.CART, defaultCart);
    this.orders = this.loadFromStorage(STORAGE_KEYS.ORDERS, MOCK_ORDERS);
    this.logs = this.loadFromStorage(STORAGE_KEYS.LOGS, MOCK_ACCOUNT_LOGS);
    this.coupons = this.loadFromStorage(STORAGE_KEYS.COUPONS, MOCK_USER_COUPONS);
    this.afterSales = this.loadFromStorage(STORAGE_KEYS.AFTER_SALES, MOCK_AFTER_SALES);
    this.addresses = this.loadFromStorage(STORAGE_KEYS.ADDRESSES, MOCK_ADDRESSES);
    this.favorites = this.loadFromStorage(STORAGE_KEYS.FAVORITES, ['p_101', 'p_201', 'p_701']);
  }

  private loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private saveToStorage(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage saving error:', e);
    }
  }

  // --- Enterprise & Mall Operations ---
  public getMalls(): EnterpriseMall[] {
    return MOCK_ENTERPRISE_MALLS;
  }

  public getCurrentMall(): EnterpriseMall {
    const mall = MOCK_ENTERPRISE_MALLS.find(m => m.id === this.currentMallId);
    return mall || MOCK_ENTERPRISE_MALLS[0];
  }

  public switchMall(mallId: string): EnterpriseMall {
    this.currentMallId = mallId;
    this.saveToStorage(STORAGE_KEYS.MALL_ID, mallId);
    const mall = this.getCurrentMall();
    this.user.currentMallId = mall.id;
    this.user.enterpriseId = mall.enterpriseId;
    this.user.enterpriseName = mall.enterpriseName;
    this.saveUser();
    return mall;
  }

  // --- User Profile & Welfare Balances ---
  public getUserProfile(): UserProfile {
    return { ...this.user };
  }

  private saveUser(): void {
    this.saveToStorage(STORAGE_KEYS.USER, this.user);
  }

  // --- Product Search, Query & Filter ---
  public getProducts(params?: {
    keyword?: string;
    categoryId?: string;
    subCategoryName?: string;
    itemType?: ProductItemType | 'all';
    supplierType?: string;
    accountType?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    sortBy?: 'default' | 'sales' | 'priceAsc' | 'priceDesc' | 'newest';
  }): Product[] {
    let list = [...MOCK_PRODUCTS];

    if (!params) return list;

    if (params.keyword && params.keyword.trim() !== '') {
      const kw = params.keyword.trim().toLowerCase();
      list = list.filter(
        p =>
          p.title.toLowerCase().includes(kw) ||
          p.subtitle.toLowerCase().includes(kw) ||
          p.brand.toLowerCase().includes(kw) ||
          p.categoryName.toLowerCase().includes(kw) ||
          p.tags.some(t => t.toLowerCase().includes(kw))
      );
    }

    if (params.categoryId && params.categoryId !== 'all') {
      list = list.filter(p => p.categoryId === params.categoryId);
    }

    if (params.itemType && params.itemType !== 'all') {
      list = list.filter(p => p.itemType === params.itemType);
    }

    if (params.supplierType && params.supplierType !== 'all') {
      list = list.filter(p => p.supplierType === params.supplierType);
    }

    if (params.accountType && params.accountType !== 'all') {
      list = list.filter(p => p.allowedAccounts.includes(params.accountType as any));
    }

    if (params.minPrice !== undefined && !isNaN(params.minPrice)) {
      list = list.filter(p => p.priceWelfare >= params.minPrice!);
    }

    if (params.maxPrice !== undefined && !isNaN(params.maxPrice)) {
      list = list.filter(p => p.priceWelfare <= params.maxPrice!);
    }

    if (params.inStockOnly) {
      list = list.filter(p => p.stock > 0);
    }

    if (params.sortBy) {
      switch (params.sortBy) {
        case 'sales':
          list.sort((a, b) => b.salesCount - a.salesCount);
          break;
        case 'priceAsc':
          list.sort((a, b) => a.priceWelfare - b.priceWelfare);
          break;
        case 'priceDesc':
          list.sort((a, b) => b.priceWelfare - a.priceWelfare);
          break;
        case 'newest':
          list.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0));
          break;
      }
    }

    return list;
  }

  public getProductById(id: string): Product | undefined {
    return MOCK_PRODUCTS.find(p => p.id === id);
  }

  // --- Cart Management ---
  public getCart(): CartItem[] {
    return [...this.cart];
  }

  public addToCart(product: Product, quantity = 1, selectedSpec: Record<string, string> = {}): CartItem[] {
    const existingIndex = this.cart.findIndex(
      item =>
        item.productId === product.id &&
        JSON.stringify(item.selectedSpec) === JSON.stringify(selectedSpec)
    );

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({
        id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id,
        product,
        quantity,
        selectedSpec,
        selected: true,
        distributorId: this.user.distributorId
      });
    }

    this.saveCart();
    return this.getCart();
  }

  public updateCartQuantity(cartItemId: string, quantity: number): CartItem[] {
    if (quantity <= 0) {
      return this.removeCartItem(cartItemId);
    }
    const item = this.cart.find(i => i.id === cartItemId);
    if (item) {
      item.quantity = quantity;
      this.saveCart();
    }
    return this.getCart();
  }

  public toggleCartItemSelected(cartItemId: string): CartItem[] {
    const item = this.cart.find(i => i.id === cartItemId);
    if (item) {
      item.selected = !item.selected;
      this.saveCart();
    }
    return this.getCart();
  }

  public toggleSelectAllCart(selected: boolean): CartItem[] {
    this.cart.forEach(item => {
      item.selected = selected;
    });
    this.saveCart();
    return this.getCart();
  }

  public removeCartItem(cartItemId: string): CartItem[] {
    this.cart = this.cart.filter(i => i.id !== cartItemId);
    this.saveCart();
    return this.getCart();
  }

  public clearSelectedCartItems(): void {
    this.cart = this.cart.filter(i => !i.selected);
    this.saveCart();
  }

  private saveCart(): void {
    this.saveToStorage(STORAGE_KEYS.CART, this.cart);
  }

  // --- Favorites ---
  public getFavorites(): string[] {
    return [...this.favorites];
  }

  public toggleFavorite(productId: string): boolean {
    if (this.favorites.includes(productId)) {
      this.favorites = this.favorites.filter(id => id !== productId);
    } else {
      this.favorites.push(productId);
    }
    this.saveToStorage(STORAGE_KEYS.FAVORITES, this.favorites);
    return this.favorites.includes(productId);
  }

  // --- Address Management ---
  public getAddresses(): DeliveryAddress[] {
    return [...this.addresses];
  }

  public addAddress(address: Omit<DeliveryAddress, 'id'>): DeliveryAddress[] {
    const newAddr: DeliveryAddress = {
      ...address,
      id: `addr_${Date.now()}`
    };
    if (newAddr.isDefault) {
      this.addresses.forEach(a => (a.isDefault = false));
    }
    this.addresses.unshift(newAddr);
    this.saveToStorage(STORAGE_KEYS.ADDRESSES, this.addresses);
    return this.getAddresses();
  }

  // --- Order & Checkout Simulation ---
  public getOrders(statusFilter?: OrderStatus | 'all'): Order[] {
    if (!statusFilter || statusFilter === 'all') return [...this.orders];
    return this.orders.filter(o => o.status === statusFilter);
  }

  public getOrderById(orderId: string): Order | undefined {
    return this.orders.find(o => o.id === orderId || o.orderNo === orderId);
  }

  /**
   * 提交订单并模拟按不同供应商（第三方/自营/集团）进行逻辑拆单
   */
  public submitCheckoutOrder(params: {
    items: CartItem[];
    address?: DeliveryAddress;
    useWelfareAmount: number;
    useMealAmount: number;
    payMethod: 'welfare_plus_wechat' | 'wechat_only' | 'welfare_only';
    invoiceType?: 'none' | 'personal' | 'company';
    invoiceTitle?: string;
    invoiceTaxNo?: string;
    userRemark?: string;
  }): { parentOrderNo: string; subOrders: Order[]; remainingWelfare: number; remainingMeal: number } {
    const parentOrderNo = `PORD${Date.now()}`;
    
    // Group cart items by supplier
    const grouped = new Map<string, CartItem[]>();
    params.items.forEach(item => {
      const supKey = item.product.supplierId;
      if (!grouped.has(supKey)) grouped.set(supKey, []);
      grouped.get(supKey)!.push(item);
    });

    // Calculate total order amount
    let totalGoodsAmount = 0;
    params.items.forEach(item => {
      totalGoodsAmount += item.product.priceWelfare * item.quantity;
    });

    const welfareToDeduct = Math.min(
      Math.max(0, params.useWelfareAmount),
      this.user.welfareBalance,
      totalGoodsAmount
    );
    const remainingAfterWelfare = Math.max(0, totalGoodsAmount - welfareToDeduct);
    const mealToDeduct = Math.min(
      Math.max(0, params.useMealAmount),
      this.user.mealBalance,
      remainingAfterWelfare
    );

    const subOrders: Order[] = [];
    let currentOrderSeq = 1;

    grouped.forEach((supplierItems, supplierId) => {
      const firstItem = supplierItems[0].product;
      const subOrderNo = `ORD${Date.now()}${String(currentOrderSeq).padStart(2, '0')}`;
      currentOrderSeq++;

      let subTotal = 0;
      supplierItems.forEach(i => {
        subTotal += i.product.priceWelfare * i.quantity;
      });

      // Pro-rate welfare and meal deduction for sub-orders
      const ratio = totalGoodsAmount > 0 ? subTotal / totalGoodsAmount : 1;
      const subWelfare = Math.min(subTotal, Math.round(welfareToDeduct * ratio * 100) / 100);
      const subMeal = Math.min(subTotal - subWelfare, Math.round(mealToDeduct * ratio * 100) / 100);
      const subWechat = Math.max(0, subTotal - subWelfare - subMeal);

      const hasVirtualOrTicket = supplierItems.some(
        i => i.product.itemType === 'virtual_coupon' || i.product.itemType === 'movie_ticket' || i.product.itemType === 'nearby_store'
      );

      const newSubOrder: Order = {
        id: `ord_${Date.now()}_${currentOrderSeq}`,
        orderNo: subOrderNo,
        parentOrderNo,
        enterpriseId: this.user.enterpriseId,
        enterpriseName: this.user.enterpriseName,
        mallId: this.user.currentMallId,
        mallName: this.getCurrentMall().mallName,
        supplierId: firstItem.supplierId,
        supplierName: firstItem.supplierName,
        supplierType: firstItem.supplierType,
        status: 'pending_shipment', // auto paid in simulation
        createTime: new Date().toLocaleString('zh-CN', { hour12: false }),
        items: supplierItems.map(item => {
          const specText = Object.entries(item.selectedSpec)
            .map(([k, v]) => `${k}:${v}`)
            .join(' ');
          const vCode = hasVirtualOrTicket ? `${item.product.itemType.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}` : undefined;
          return {
            productId: item.product.id,
            productTitle: item.product.title,
            productImage: item.product.images[0],
            price: item.product.priceWelfare,
            quantity: item.quantity,
            specText: specText || '默认规格',
            itemType: item.product.itemType,
            verificationCode: vCode
          };
        }),
        address: params.address,
        payment: {
          totalGoodsAmount: subTotal,
          shippingFee: 0,
          welfareDeducted: subWelfare,
          mealDeducted: subMeal,
          wechatPaid: subWechat,
          finalPaidAmount: subTotal,
          payMethodText: subWechat > 0
            ? `福利/餐扣抵扣(¥${(subWelfare + subMeal).toFixed(2)}) + 微信补差(¥${subWechat.toFixed(2)})`
            : '福利卡/餐卡全额抵扣',
          paidAt: new Date().toLocaleString('zh-CN', { hour12: false })
        },
        invoice: params.invoiceType !== 'none' ? {
          type: params.invoiceType || 'personal',
          title: params.invoiceTitle,
          taxNumber: params.invoiceTaxNo
        } : undefined,
        userRemark: params.userRemark,
        verificationCode: hasVirtualOrTicket ? `VERI-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
        distributorId: this.user.distributorId
      };

      // Generate Coupons if virtual or store item
      supplierItems.forEach(item => {
        if (['virtual_coupon', 'movie_ticket', 'nearby_store', 'supermarket'].includes(item.product.itemType)) {
          const cpnCode = `${item.product.brand.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
          const newCpn: UserCoupon = {
            id: `cpn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: item.product.itemType,
            title: item.product.title,
            faceValue: item.product.priceWelfare,
            code: cpnCode,
            expiryDate: '2027-12-31',
            status: 'unused',
            storeName: item.product.nearbyStoreInfo?.storeName,
            storeAddress: item.product.nearbyStoreInfo?.address,
            usageRules: [
              '凭借电子二维码或核销码到店/线上直接抵扣',
              '此卡券由企业福利账户统一兑换发码，免挂失'
            ],
            sourceOrderNo: subOrderNo,
            distributorId: this.user.distributorId
          };
          this.coupons.unshift(newCpn);
        }
      });

      subOrders.push(newSubOrder);
      this.orders.unshift(newSubOrder);
    });

    // Deduct user balances and create transaction logs
    if (welfareToDeduct > 0) {
      this.user.welfareBalance -= welfareToDeduct;
      this.logs.unshift({
        id: `log_${Date.now()}_w`,
        accountType: 'welfare',
        title: `订单合并下单福利卡扣款 (单号:${parentOrderNo})`,
        amount: -welfareToDeduct,
        direction: 'out',
        orderNo: parentOrderNo,
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        balanceAfter: this.user.welfareBalance,
        remark: '智慧翼福利卡账户支取'
      });
    }

    if (mealToDeduct > 0) {
      this.user.mealBalance -= mealToDeduct;
      this.logs.unshift({
        id: `log_${Date.now()}_m`,
        accountType: 'meal',
        title: `订单合并下单餐卡扣款 (单号:${parentOrderNo})`,
        amount: -mealToDeduct,
        direction: 'out',
        orderNo: parentOrderNo,
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        balanceAfter: this.user.mealBalance,
        remark: '智慧翼餐卡专享账户支取'
      });
    }

    this.user.couponCount = this.coupons.filter(c => c.status === 'unused').length;

    // Save updated states
    this.saveUser();
    this.saveToStorage(STORAGE_KEYS.ORDERS, this.orders);
    this.saveToStorage(STORAGE_KEYS.LOGS, this.logs);
    this.saveToStorage(STORAGE_KEYS.COUPONS, this.coupons);

    // Clear checked cart items
    this.clearSelectedCartItems();

    return {
      parentOrderNo,
      subOrders,
      remainingWelfare: this.user.welfareBalance,
      remainingMeal: this.user.mealBalance
    };
  }

  public updateOrderStatus(orderId: string, status: OrderStatus): Order[] {
    const order = this.orders.find(o => o.id === orderId || o.orderNo === orderId);
    if (order) {
      order.status = status;
      this.saveToStorage(STORAGE_KEYS.ORDERS, this.orders);
    }
    return this.getOrders();
  }

  // --- After-Sales Management ---
  public getAfterSales(): AfterSaleRecord[] {
    return [...this.afterSales];
  }

  public applyAfterSale(params: {
    orderId: string;
    type: 'refund_only' | 'return_goods' | 'exchange';
    reason: string;
    description: string;
  }): AfterSaleRecord {
    const order = this.getOrderById(params.orderId);
    if (!order) throw new Error('Order not found');

    const newRecord: AfterSaleRecord = {
      id: `as_${Date.now()}`,
      afterSaleNo: `AS${Date.now()}`,
      orderId: order.id,
      orderNo: order.orderNo,
      supplierName: order.supplierName,
      applyTime: new Date().toLocaleString('zh-CN', { hour12: false }),
      reason: params.reason,
      type: params.type,
      status: 'submitted',
      refundAmount: order.payment.finalPaidAmount,
      description: params.description,
      items: order.items,
      distributorId: this.user.distributorId
    };

    order.status = 'after_sale';
    this.afterSales.unshift(newRecord);

    this.saveToStorage(STORAGE_KEYS.ORDERS, this.orders);
    this.saveToStorage(STORAGE_KEYS.AFTER_SALES, this.afterSales);

    return newRecord;
  }

  // --- Accounts & Transaction Logs ---
  public getAccountLogs(type?: 'welfare' | 'meal' | 'all'): AccountLog[] {
    if (!type || type === 'all') return [...this.logs];
    return this.logs.filter(l => l.accountType === type);
  }

  // --- Coupons ---
  public getUserCoupons(status?: 'unused' | 'used' | 'expired' | 'all'): UserCoupon[] {
    if (!status || status === 'all') return [...this.coupons];
    return this.coupons.filter(c => c.status === status);
  }

  public simulateVerifyCoupon(couponId: string): UserCoupon | undefined {
    const cpn = this.coupons.find(c => c.id === couponId);
    if (cpn && cpn.status === 'unused') {
      cpn.status = 'used';
      this.user.couponCount = this.coupons.filter(c => c.status === 'unused').length;
      this.saveUser();
      this.saveToStorage(STORAGE_KEYS.COUPONS, this.coupons);
    }
    return cpn;
  }
}

export const mallService = new MallService();
