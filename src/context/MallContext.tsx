import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UserProfile, EnterpriseMall, Product, CartItem, Order, DeliveryAddress, AccountLog } from '../types';
import { mallService } from '../services/mallService';
import { productionApi, ProductionApiError } from '../services/productionApi';
import { MOCK_CATEGORIES, toFrontendOrders, toFrontendProducts } from '../adapters/frontendData';
import type { AndroidAppPage, AppMode, LaptopPage, MallContextType, MiniProgramPage, PageRoute, PendingFeatureInfo, RouteParams, SessionStatus, TabletOrientation, TabletPage, ToastMessage, ViewportMode } from './MallContext.types';
import { useDeviceNavigation } from './useDeviceNavigation';
import { checkoutSelectedCartRequest } from './checkoutSelectedCart';
import { useProductionSync } from './useProductionSync';
export type * from './MallContext.types';
const MallContext = createContext<MallContextType | undefined>(undefined);
export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigation = useDeviceNavigation();

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
  const presentationProducts = useMemo(() => toFrontendProducts(products), [products]);
  const presentationOrders = useMemo(() => toFrontendOrders(orders, presentationProducts), [orders, presentationProducts]);

  const refreshServerCart = useCallback(async () => {
    const response = await productionApi.listCart();
    const nextCart = response.items.flatMap((item) => {
      const product = products.find((candidate) => candidate.id === item.productId && candidate.skuId === item.skuId);
      return product ? [{ id: item.id, productId: item.productId, product, quantity: item.quantity, selectedSpec: {}, selected: item.selected }] : [];
    });
    setCart(nextCart);
  }, [products]);
  const refreshServerAddresses = useCallback(async () => setAddresses((await productionApi.listAddresses()).items), []);
  const removeToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const showToast = useCallback(
    (text: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
  );

  const { refreshProductionData } = useProductionSync({
    setProducts,
    setUser,
    setCurrentMall,
    setOrders,
    setAccountLogs,
    setSessionStatus,
  });
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    void refreshServerCart().catch(() => showToast('购物车同步失败，请稍后重试', 'error'));
    void refreshServerAddresses().catch(() => showToast('地址簿同步失败，请稍后重试', 'error'));
  }, [sessionStatus, refreshServerCart, refreshServerAddresses, showToast]);
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
      const message = error instanceof ProductionApiError ? error.message : '登录服务暂时不可用';
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
    navigation.navigateTo('home');
    showToast(`已切换至【${newMall.mallName}】`, 'info');
  };

  const handleAddToCart = async (product: Product, quantity = 1, selectedSpec: Record<string, string> = {}) => {
    if (product.isTest) {
      showToast('测试商品仅用于系统验证，不能加入购物车', 'warning');
      return;
    }
    if (sessionStatus === 'authenticated' && product.skuId) {
      try {
        await productionApi.upsertCartItem({ skuId: product.skuId, quantity, selected: true });
        await refreshServerCart();
        showToast(`已将“${product.title.slice(0, 16)}...”加入购物车`, 'success');
      } catch {
        showToast('购物车保存失败，请稍后重试', 'error');
      }
      return;
    }
    setCart(mallService.addToCart(product, quantity, selectedSpec));
    showToast(`已将“${product.title.slice(0, 16)}...”加入购物车`, 'success');
  };

  const handleUpdateCartQuantity = (cartItemId: string, quantity: number) => {
    if (sessionStatus === 'authenticated') {
      const item = cart.find((candidate) => candidate.id === cartItemId);
      if (!item?.product.skuId) return;
      if (quantity <= 0) {
        void productionApi
          .deleteCartItem(cartItemId)
          .then(refreshServerCart)
          .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
      } else {
        void productionApi
          .upsertCartItem({ skuId: item.product.skuId, quantity, selected: item.selected })
          .then(refreshServerCart)
          .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
      }
      return;
    }
    const updatedCart = mallService.updateCartQuantity(cartItemId, quantity);
    setCart(updatedCart);
  };

  const handleToggleCartItemSelected = (cartItemId: string) => {
    if (sessionStatus === 'authenticated') {
      const item = cart.find((candidate) => candidate.id === cartItemId);
      if (!item?.product.skuId) return;
      void productionApi
        .upsertCartItem({ skuId: item.product.skuId, quantity: item.quantity, selected: !item.selected })
        .then(refreshServerCart)
        .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
      return;
    }
    const updatedCart = mallService.toggleCartItemSelected(cartItemId);
    setCart(updatedCart);
  };

  const handleToggleSelectAllCart = (selected: boolean) => {
    if (sessionStatus === 'authenticated') {
      const updates = cart.filter((item) => item.product.skuId).map((item) => productionApi.upsertCartItem({ skuId: item.product.skuId!, quantity: item.quantity, selected }));
      void Promise.all(updates)
        .then(refreshServerCart)
        .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
      return;
    }
    const updatedCart = mallService.toggleSelectAllCart(selected);
    setCart(updatedCart);
  };

  const handleRemoveCartItem = async (cartItemId: string) => {
    if (sessionStatus === 'authenticated') {
      await productionApi
        .deleteCartItem(cartItemId)
        .then(refreshServerCart)
        .then(() => showToast('已从购物车移除该商品', 'info'))
        .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
      return;
    }
    const updatedCart = mallService.removeCartItem(cartItemId);
    setCart(updatedCart);
    showToast('已从购物车移除该商品', 'info');
  };

  const checkoutSelectedCart = async (): Promise<boolean> => {
    if (sessionStatus !== 'authenticated') {
      showToast('请先登录生产型MVP账户，再提交订单', 'warning');
      return false;
    }
    setIsSubmittingOrder(true);
    try {
      const { selectedItems } = await checkoutSelectedCartRequest(cart, addresses, user);
      if (sessionStatus === 'authenticated') {
        await Promise.all(selectedItems.map((item) => productionApi.deleteCartItem(item.id)));
        await refreshServerCart();
      } else {
        selectedItems.forEach((item) => mallService.removeCartItem(item.id));
        setCart(mallService.getCart());
      }
      await refreshProductionData();
      showToast('订单已安全写入数据库并完成福利账户支付', 'success');
      return true;
    } catch (error) {
      const message = error instanceof ProductionApiError ? error.message : '订单服务暂时不可用';
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
      void productionApi
        .upsertAddress({ ...address, id: '' })
        .then(refreshServerAddresses)
        .then(() => showToast('收货地址已加密保存', 'success'))
        .catch((error) => showToast(error instanceof ProductionApiError ? error.message : '地址簿保存失败，请稍后重试', 'error'));
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
        ...navigation,
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
        setQuickViewProduct,
      }}
    >
      {children}
    </MallContext.Provider>
  );
};

export const useMall = () => {
  const context = useContext(MallContext);
  if (!context) throw new Error('useMall must be used within a MallProvider');
  return context;
};
