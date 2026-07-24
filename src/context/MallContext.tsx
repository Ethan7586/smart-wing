/**
 * 智慧翼企业福利商城 - 全局状态与路由 Context
 * 提供页面切换、消息 Toast、购物车更新、商城切换与福利余额实时同步
 * 技术服务方：雍彻科技
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  EnterpriseMall,
  Product,
  CartItem,
  Order,
  UserCoupon,
  DeliveryAddress,
  AccountLog,
  OrderStatus,
  ProductItemType
} from '../types';
import { mallService } from '../services/mallService';
import {
  productionApi,
  ProductionApiError,
  type ApiOrder,
  type ApiProduct,
} from '../services/productionApi';
import {
  MOCK_CATEGORIES,
  toFrontendOrders,
  toFrontendProducts,
  type FrontendCategory,
  type FrontendOrder,
  type FrontendProduct,
} from '../adapters/frontendData';

export type SessionStatus = 'checking' | 'guest' | 'authenticated';

export type ViewportMode = 'auto' | 'laptop-1366' | 'desktop-1440' | 'side-by-side';
export type AppMode = 'pc' | 'mini-program' | 'android-app' | 'tablet-app' | 'laptop-web';
export type MiniProgramPage = 'home' | 'category' | 'detail' | 'cart' | 'orders' | 'profile';
export type AndroidAppPage = 'home' | 'search' | 'detail' | 'checkout' | 'orders' | 'profile';
export type TabletPage = 'home' | 'category' | 'detail' | 'cart' | 'orders' | 'profile';
export type TabletOrientation = 'landscape' | 'portrait';
export type LaptopPage = 'home-1366' | 'home-1440' | 'category' | 'detail' | 'cart' | 'orders';

export interface PendingFeatureInfo {
  isOpen: boolean;
  featureName: string;
  desc?: string;
}

export type PageRoute =
  | 'home'
  | 'category'
  | 'detail'
  | 'cart'
  | 'checkout'
  | 'payment-result'
  | 'user-center'
  | 'orders'
  | 'order-detail'
  | 'after-sale'
  | 'coupons'
  | 'balance'
  | 'mvp-console';

export interface RouteParams {
  productId?: string;
  orderId?: string;
  parentOrderNo?: string;
  keyword?: string;
  categoryId?: string;
  itemType?: ProductItemType | 'all';
  statusFilter?: OrderStatus | 'all';
  accountTab?: 'welfare' | 'meal';
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'error' | 'warning';
  text: string;
}

interface MallContextType {
  // Multi-device presentation
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  viewportMode: ViewportMode;
  setViewportMode: (mode: ViewportMode) => void;
  mpPage: MiniProgramPage;
  setMpPage: (page: MiniProgramPage, productId?: string) => void;
  androidPage: AndroidAppPage;
  setAndroidPage: (page: AndroidAppPage, productId?: string) => void;
  tabletPage: TabletPage;
  setTabletPage: (page: TabletPage, productId?: string) => void;
  tabletOrientation: TabletOrientation;
  setTabletOrientation: (orientation: TabletOrientation) => void;
  laptopPage: LaptopPage;
  setLaptopPage: (page: LaptopPage, productId?: string) => void;
  mobileProductId: string;
  setMobileProductId: (id: string) => void;
  pendingFeature: PendingFeatureInfo;
  triggerPendingFeature: (featureName: string, desc?: string) => void;
  closePendingFeatureModal: () => void;

  // Navigation State
  currentPage: PageRoute;
  routeParams: RouteParams;
  navigateTo: (page: PageRoute, params?: RouteParams) => void;
  
  // Enterprise & User State
  user: UserProfile;
  currentMall: EnterpriseMall;
  malls: EnterpriseMall[];
  switchMall: (mallId: string) => void;
  refreshUserData: () => void;
  orders: Order[];
  products: Product[];
  presentationProducts: FrontendProduct[];
  presentationOrders: FrontendOrder[];
  presentationCategories: FrontendCategory[];
  accountLogs: AccountLog[];
  sessionStatus: SessionStatus;
  sessionError: string | null;
  login: (accessCode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProductionData: () => Promise<void>;
  isSubmittingOrder: boolean;
  checkoutSelectedCart: () => Promise<boolean>;
  
  // Cart State
  cart: CartItem[];
  cartCount: number;
  addToCart: (product: Product, quantity?: number, selectedSpec?: Record<string, string>) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  toggleCartItemSelected: (cartItemId: string) => void;
  toggleSelectAllCart: (selected: boolean) => void;
  removeCartItem: (cartItemId: string) => void;
  
  // Favorites State
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  
  // Addresses
  addresses: DeliveryAddress[];
  addAddress: (address: Omit<DeliveryAddress, 'id'>) => void;
  
  // Toast Notification System
  toasts: ToastMessage[];
  showToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
  removeToast: (id: string) => void;
  
  // Quick Actions & Modals
  quickViewProduct: Product | null;
  setQuickViewProduct: (product: Product | null) => void;
}

const MallContext = createContext<MallContextType | undefined>(undefined);

export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appMode, setAppModeState] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'pc';
    const path = window.location.pathname;
    if (path.startsWith('/mini-program')) return 'mini-program';
    if (path.startsWith('/android-app')) return 'android-app';
    if (path.startsWith('/tablet-app')) return 'tablet-app';
    if (path.startsWith('/laptop-web')) return 'laptop-web';
    return 'pc';
  });
  const [viewportMode, setViewportMode] = useState<ViewportMode>('auto');
  const [mpPage, setMpPageState] = useState<MiniProgramPage>('home');
  const [androidPage, setAndroidPageState] = useState<AndroidAppPage>('home');
  const [tabletPage, setTabletPageState] = useState<TabletPage>('home');
  const [tabletOrientation, setTabletOrientation] = useState<TabletOrientation>('landscape');
  const [laptopPage, setLaptopPageState] = useState<LaptopPage>('home-1366');
  const [mobileProductId, setMobileProductId] = useState<string>('p_101');
  const [pendingFeature, setPendingFeature] = useState<PendingFeatureInfo>({
    isOpen: false,
    featureName: '',
  });
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [routeParams, setRouteParams] = useState<RouteParams>({});
  
  const [user, setUser] = useState<UserProfile>(() => mallService.getUserProfile());
  const [currentMall, setCurrentMall] = useState<EnterpriseMall>(() => mallService.getCurrentMall());
  const [malls] = useState<EnterpriseMall[]>(() => mallService.getMalls());
  const [cart, setCart] = useState<CartItem[]>(() => mallService.getCart());
  const [orders, setOrders] = useState<Order[]>(() => mallService.getOrders());
  const [products, setProducts] = useState<Product[]>(() => mallService.getProducts());
  const [accountLogs, setAccountLogs] = useState<AccountLog[]>(() => mallService.getAccountLogs());
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => mallService.getFavorites());
  const [addresses, setAddresses] = useState<DeliveryAddress[]>(() => mallService.getAddresses());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const presentationProducts = useMemo(
    () => toFrontendProducts(products),
    [products]
  );
  const presentationOrders = useMemo(
    () => toFrontendOrders(orders, presentationProducts),
    [orders, presentationProducts]
  );

  const setAppMode = (mode: AppMode) => {
    setAppModeState(mode);
    const pathByMode: Record<AppMode, string> = {
      pc: '/',
      'mini-program': '/mini-program',
      'android-app': '/android-app',
      'tablet-app': '/tablet-app',
      'laptop-web': '/laptop-web',
    };
    const targetPath = pathByMode[mode];
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const setMpPage = (page: MiniProgramPage, productId?: string) => {
    setMpPageState(page);
    if (productId) setMobileProductId(productId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setAndroidPage = (page: AndroidAppPage, productId?: string) => {
    setAndroidPageState(page);
    if (productId) setMobileProductId(productId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setTabletPage = (page: TabletPage, productId?: string) => {
    setTabletPageState(page);
    if (productId) setMobileProductId(productId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setLaptopPage = (page: LaptopPage, productId?: string) => {
    setLaptopPageState(page);
    if (productId) setMobileProductId(productId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const triggerPendingFeature = (featureName: string, desc?: string) => {
    setPendingFeature({ isOpen: true, featureName, desc });
  };

  const closePendingFeatureModal = () => {
    setPendingFeature((previous) => ({ ...previous, isOpen: false }));
  };

  const syncPublicCatalog = async () => {
    try {
      const response = await productionApi.listProducts('smart-wing-demo', { limit: 100 });
      if (response.items.length > 0) {
        setProducts(response.items.map(mapApiProduct));
      }
    } catch {
      // 商品服务不可用时保留只读演示目录，页面仍可用于需求评审。
    }
  };

  const refreshProductionData = async () => {
    const [bootstrap, accounts, orderResult, ledgerResult] = await Promise.all([
      productionApi.getBootstrap(),
      productionApi.listAccounts(),
      productionApi.listOrders(),
      productionApi.listAccountLedgers(),
    ]);
    const welfare = accounts.items.find((account) => account.type === 'welfare');
    const meal = accounts.items.find((account) => account.type === 'meal');
    setUser((previous) => ({
      ...previous,
      id: bootstrap.actor.userId,
      employeeId: bootstrap.actor.employeeNo,
      enterpriseId: bootstrap.scope.enterpriseId,
      enterpriseName: bootstrap.scope.enterpriseName,
      currentMallId: bootstrap.scope.mallId,
      welfareBalance: (welfare?.balanceCents ?? 0) / 100,
      mealBalance: (meal?.balanceCents ?? 0) / 100,
    }));
    setCurrentMall((previous) => ({
      ...previous,
      id: bootstrap.scope.mallId,
      enterpriseId: bootstrap.scope.enterpriseId,
      enterpriseName: bootstrap.scope.enterpriseName,
      mallName: bootstrap.scope.mallName,
      logoText: bootstrap.scope.brandName,
    }));
    setOrders(orderResult.items.map((order) => mapApiOrder(order, bootstrap.scope)));
    setAccountLogs(
      ledgerResult.items.map((ledger) => ({
        id: ledger.id,
        accountType: ledger.accountType,
        title:
          ledger.businessType === 'order_payment'
            ? '商城订单账户支付'
            : ledger.businessType === 'refund'
              ? '售后退款原路退回'
              : '企业福利额度发放',
        amount:
          (ledger.direction === 'credit' ? 1 : -1) * ledger.amountCents / 100,
        direction: ledger.direction === 'credit' ? 'in' : 'out',
        orderNo: ledger.orderNo ?? undefined,
        time: new Date(ledger.createdAt).toLocaleString('zh-CN', { hour12: false }),
        balanceAfter: ledger.balanceAfterCents / 100,
      }))
    );
  };

  useEffect(() => {
    let active = true;
    void syncPublicCatalog();
    void productionApi
      .getSession()
      .then(async () => {
        if (!active) return;
        setSessionStatus('authenticated');
        await refreshProductionData();
      })
      .catch(() => {
        if (active) setSessionStatus('guest');
      });
    return () => {
      active = false;
    };
  }, []);

  // Sync pathname modes and desktop hash routing for browser forward/back support.
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/mini-program')) setAppModeState('mini-program');
      else if (path.startsWith('/android-app')) setAppModeState('android-app');
      else if (path.startsWith('/tablet-app')) setAppModeState('tablet-app');
      else if (path.startsWith('/laptop-web')) setAppModeState('laptop-web');
      else setAppModeState('pc');
    };

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      if (!hash) return;
      
      const parts = hash.split('?');
      const pageName = parts[0] as PageRoute;
      const searchParams = new URLSearchParams(parts[1] || '');
      const paramsObj: RouteParams = {};

      searchParams.forEach((val, key) => {
        (paramsObj as any)[key] = val;
      });

      if (pageName) {
        setCurrentPage(pageName);
        setRouteParams(paramsObj);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigateTo = (page: PageRoute, params: RouteParams = {}) => {
    setCurrentPage(page);
    setRouteParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update URL hash
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.set(k, String(v));
    });
    const queryString = query.toString();
    window.location.hash = `#/${page}${queryString ? '?' + queryString : ''}`;
  };

  const showToast = (text: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshUserData = () => {
    if (sessionStatus === 'authenticated') {
      void refreshProductionData().catch(() => {
        showToast('账户数据同步失败，请稍后重试', 'error');
      });
      return;
    }
    setUser(mallService.getUserProfile());
    setCurrentMall(mallService.getCurrentMall());
    setCart(mallService.getCart());
    setOrders(mallService.getOrders());
  };

  const login = async (accessCode: string): Promise<boolean> => {
    setSessionError(null);
    try {
      await productionApi.login(accessCode);
      setSessionStatus('authenticated');
      await refreshProductionData();
      showToast('安全登录成功，已同步福利账户与订单', 'success');
      return true;
    } catch (error) {
      const message =
        error instanceof ProductionApiError
          ? error.message
          : '登录服务暂时不可用';
      setSessionError(message);
      return false;
    }
  };

  const logout = async () => {
    try {
      await productionApi.logout();
    } finally {
      setSessionStatus('guest');
      setSessionError(null);
      setUser(mallService.getUserProfile());
      setOrders(mallService.getOrders());
      setAccountLogs(mallService.getAccountLogs());
      showToast('已安全退出MVP会话', 'info');
    }
  };

  const switchMall = (mallId: string) => {
    if (sessionStatus === 'authenticated' && mallId !== currentMall.id) {
      showToast('当前账号未获得其他商城的数据权限', 'warning');
      return;
    }
    const newMall = mallService.switchMall(mallId);
    setCurrentMall(newMall);
    setUser(mallService.getUserProfile());
    setCart(mallService.getCart());
    setOrders(mallService.getOrders());
    setFavorites(mallService.getFavorites());
    setAddresses(mallService.getAddresses());
    setCurrentPage('home');
    setRouteParams({});
    window.location.hash = '#/home';
    showToast(`已切换至【${newMall.mallName}】`, 'info');
  };

  const handleAddToCart = (product: Product, quantity = 1, selectedSpec: Record<string, string> = {}) => {
    const updatedCart = mallService.addToCart(product, quantity, selectedSpec);
    setCart(updatedCart);
    showToast(`已将“${product.title.slice(0, 16)}...”加入购物车`, 'success');
  };

  const handleUpdateCartQuantity = (cartItemId: string, quantity: number) => {
    const updatedCart = mallService.updateCartQuantity(cartItemId, quantity);
    setCart(updatedCart);
  };

  const handleToggleCartItemSelected = (cartItemId: string) => {
    const updatedCart = mallService.toggleCartItemSelected(cartItemId);
    setCart(updatedCart);
  };

  const handleToggleSelectAllCart = (selected: boolean) => {
    const updatedCart = mallService.toggleSelectAllCart(selected);
    setCart(updatedCart);
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    const updatedCart = mallService.removeCartItem(cartItemId);
    setCart(updatedCart);
    showToast('已从购物车移除该商品', 'info');
  };

  const checkoutSelectedCart = async (): Promise<boolean> => {
    const selectedItems = cart.filter((item) => item.selected);
    const selectedAddress =
      addresses.find((address) => address.isDefault) ?? addresses[0];
    if (sessionStatus !== 'authenticated') {
      showToast('请先登录生产型MVP账户，再提交订单', 'warning');
      return false;
    }
    if (selectedItems.length === 0) {
      showToast('请先选择需要结算的商品', 'warning');
      return false;
    }
    if (!selectedAddress) {
      showToast('请先设置有效的收货地址', 'warning');
      return false;
    }
    if (selectedItems.some((item) => !item.product.skuId)) {
      showToast('购物车存在演示商品，请从在线商品目录重新加入', 'warning');
      return false;
    }

    const payableCents = selectedItems.reduce(
      (sum, item) =>
        sum + Math.round(item.product.priceWelfare * 100) * item.quantity,
      0
    );
    const welfareCents = Math.min(
      payableCents,
      Math.round(user.welfareBalance * 100)
    );
    const mealCents = Math.min(
      payableCents - welfareCents,
      Math.round(user.mealBalance * 100)
    );
    if (welfareCents + mealCents !== payableCents) {
      showToast('福利账户余额不足，外部支付接口尚未接入', 'warning');
      return false;
    }

    setIsSubmittingOrder(true);
    try {
      const idempotencyRoot = crypto.randomUUID();
      const created = await productionApi.createOrder(
        {
          items: selectedItems.map((item) => ({
            skuId: item.product.skuId!,
            quantity: item.quantity,
          })),
          recipient: {
            name: selectedAddress.name,
            mobile: selectedAddress.phone,
            province: selectedAddress.province,
            city: selectedAddress.city,
            district: selectedAddress.district,
            address: selectedAddress.detail,
          },
        },
        `order-${idempotencyRoot}`
      );
      await productionApi.payWithInternalAccounts(
        created.order.id,
        { welfareCents, mealCents },
        `payment-${idempotencyRoot}`
      );
      selectedItems.forEach((item) => {
        mallService.removeCartItem(item.id);
      });
      setCart(mallService.getCart());
      await refreshProductionData();
      showToast('订单已安全写入数据库并完成福利账户支付', 'success');
      return true;
    } catch (error) {
      const message =
        error instanceof ProductionApiError
          ? error.message
          : '订单服务暂时不可用';
      showToast(`订单提交失败：${message}`, 'error');
      return false;
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleToggleFavorite = (productId: string) => {
    const isFav = mallService.toggleFavorite(productId);
    setFavorites(mallService.getFavorites());
    showToast(isFav ? '已加入收藏夹' : '已取消收藏', isFav ? 'success' : 'info');
  };

  const handleAddAddress = (address: Omit<DeliveryAddress, 'id'>) => {
    if (sessionStatus === 'authenticated') {
      setAddresses((previous) => [
        ...previous.map((item) =>
          address.isDefault ? { ...item, isDefault: false } : item
        ),
        { ...address, id: `session-address-${crypto.randomUUID()}` },
      ]);
      showToast('地址仅保存在当前安全会话，提交订单时将加密入库', 'success');
      return;
    }
    const list = mallService.addAddress(address);
    setAddresses(list);
    showToast('新增收货地址成功', 'success');
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <MallContext.Provider
      value={{
        appMode,
        setAppMode,
        viewportMode,
        setViewportMode,
        mpPage,
        setMpPage,
        androidPage,
        setAndroidPage,
        tabletPage,
        setTabletPage,
        tabletOrientation,
        setTabletOrientation,
        laptopPage,
        setLaptopPage,
        mobileProductId,
        setMobileProductId,
        pendingFeature,
        triggerPendingFeature,
        closePendingFeatureModal,
        currentPage,
        routeParams,
        navigateTo,
        user,
        currentMall,
        malls,
        switchMall,
        refreshUserData,
        orders,
        products,
        presentationProducts,
        presentationOrders,
        presentationCategories: MOCK_CATEGORIES,
        accountLogs,
        sessionStatus,
        sessionError,
        login,
        logout,
        refreshProductionData,
        isSubmittingOrder,
        checkoutSelectedCart,
        cart,
        cartCount,
        addToCart: handleAddToCart,
        updateCartQuantity: handleUpdateCartQuantity,
        toggleCartItemSelected: handleToggleCartItemSelected,
        toggleSelectAllCart: handleToggleSelectAllCart,
        removeCartItem: handleRemoveCartItem,
        favorites,
        toggleFavorite: handleToggleFavorite,
        addresses,
        addAddress: handleAddAddress,
        toasts,
        showToast,
        removeToast,
        quickViewProduct,
        setQuickViewProduct
      }}
    >
      {children}
    </MallContext.Provider>
  );
};

function mapApiProduct(product: ApiProduct): Product {
  const categoryMap: Record<string, { id: string; name: string }> = {
    food: { id: 'cat_food', name: '食品饮料' },
    appliance: { id: 'cat_appliance', name: '家用电器' },
    digital: { id: 'cat_digital', name: '数码办公' },
    'virtual-card': { id: 'cat_virtual', name: '虚拟卡券' },
    movie: { id: 'cat_movie', name: '电影娱乐' },
    life: { id: 'cat_life', name: '生活服务' },
  };
  const category = categoryMap[product.categoryCode] ?? {
    id: 'cat_welfare_zone',
    name: '企业福利专区',
  };
  const isVirtual = product.categoryCode === 'virtual-card';
  return {
    id: product.id,
    skuId: product.skuId,
    title: product.name,
    subtitle: product.subtitle ?? '智慧翼企业福利严选商品',
    images: [
      product.coverUrl ??
        'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600&auto=format&fit=crop&q=80',
    ],
    priceMarket: (product.marketPriceCents ?? product.priceCents) / 100,
    priceMall: product.priceCents / 100,
    priceWelfare: product.priceCents / 100,
    categoryId: category.id,
    categoryName: category.name,
    brand: product.supplierName,
    tags: ['企业严选', '正品保障'],
    supplierId: `supplier-${product.supplierName}`,
    supplierName: product.supplierName,
    supplierType: product.supplierName.includes('央企') ? 'group_owned' : 'third_party',
    itemType: isVirtual ? 'virtual_coupon' : 'physical',
    allowedAccounts: isVirtual ? ['welfare', 'wechat'] : ['welfare', 'meal', 'wechat'],
    stock: product.availableStock,
    salesCount: 0,
    rating: 5,
    reviewCount: 0,
    deliverySla: isVirtual ? '支付成功后即时发放' : '供应商履约时效为准',
    isEnterpriseExclusive: true,
    specs: [{ name: '标准规格', options: ['默认规格'] }],
    descriptionDetailText: ['商品信息来自生产型商品目录，最终履约规则以供应商确认结果为准。'],
  };
}

function mapApiOrder(
  order: ApiOrder,
  scope: { enterpriseId: string; enterpriseName: string; mallId: string; mallName: string }
): Order {
  const statusMap: Record<string, OrderStatus> = {
    pending_payment: 'pending_payment',
    paid: 'pending_shipment',
    processing: 'pending_shipment',
    shipped: 'pending_receipt',
    completed: 'completed',
    cancelled: 'completed',
    refund_pending: 'after_sale',
    refunded: 'after_sale',
  };
  return {
    id: order.id,
    orderNo: order.orderNo,
    enterpriseId: scope.enterpriseId,
    enterpriseName: scope.enterpriseName,
    mallId: scope.mallId,
    mallName: scope.mallName,
    supplierId: 'multi-supplier',
    supplierName: '供应商拆单汇总',
    supplierType: 'third_party',
    status: statusMap[order.status] ?? 'pending_payment',
    createTime: order.createdAt,
    items: (order.items ?? []).map((item) => ({
      productId: item.productId,
      productTitle: item.productTitle,
      productImage:
        item.productImage ??
        'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=300&auto=format&fit=crop&q=80',
      price: item.priceCents / 100,
      quantity: item.quantity,
      specText: Object.entries(item.specs ?? {})
        .map(([key, value]) => `${key}：${value}`)
        .join('；') || '标准规格',
      itemType: item.itemType as ProductItemType,
    })),
    payment: {
      totalGoodsAmount: order.goodsAmountCents / 100,
      shippingFee: 0,
      welfareDeducted: (order.welfarePaidCents ?? order.paidCents) / 100,
      mealDeducted: (order.mealPaidCents ?? 0) / 100,
      wechatPaid: 0,
      finalPaidAmount: order.paidCents / 100,
      payMethodText: order.paidCents > 0 ? '内部福利账户支付' : '待支付',
    },
  };
}

export const useMall = () => {
  const context = useContext(MallContext);
  if (!context) throw new Error('useMall must be used within a MallProvider');
  return context;
};
