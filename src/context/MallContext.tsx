/**
 * 智慧翼企业福利商城 - 全局状态与路由 Context
 * 提供页面切换、消息 Toast、购物车更新、商城切换与福利余额实时同步
 * 技术服务方：雍彻科技
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  EnterpriseMall,
  Product,
  CartItem,
  Order,
  UserCoupon,
  DeliveryAddress,
  OrderStatus,
  ProductItemType
} from '../types';
import { mallService } from '../services/mallService';

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
  | 'balance';

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
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [routeParams, setRouteParams] = useState<RouteParams>({});
  
  const [user, setUser] = useState<UserProfile>(() => mallService.getUserProfile());
  const [currentMall, setCurrentMall] = useState<EnterpriseMall>(() => mallService.getCurrentMall());
  const [malls] = useState<EnterpriseMall[]>(() => mallService.getMalls());
  const [cart, setCart] = useState<CartItem[]>(() => mallService.getCart());
  const [favorites, setFavorites] = useState<string[]>(() => mallService.getFavorites());
  const [addresses, setAddresses] = useState<DeliveryAddress[]>(() => mallService.getAddresses());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Sync hash routing for desktop forward/back support
  useEffect(() => {
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

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
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
    setUser(mallService.getUserProfile());
    setCurrentMall(mallService.getCurrentMall());
    setCart(mallService.getCart());
  };

  const switchMall = (mallId: string) => {
    const newMall = mallService.switchMall(mallId);
    setCurrentMall(newMall);
    setUser(mallService.getUserProfile());
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

  const handleToggleFavorite = (productId: string) => {
    const isFav = mallService.toggleFavorite(productId);
    setFavorites(mallService.getFavorites());
    showToast(isFav ? '已加入收藏夹' : '已取消收藏', isFav ? 'success' : 'info');
  };

  const handleAddAddress = (address: Omit<DeliveryAddress, 'id'>) => {
    const list = mallService.addAddress(address);
    setAddresses(list);
    showToast('新增收货地址成功', 'success');
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <MallContext.Provider
      value={{
        currentPage,
        routeParams,
        navigateTo,
        user,
        currentMall,
        malls,
        switchMall,
        refreshUserData,
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

export const useMall = () => {
  const context = useContext(MallContext);
  if (!context) throw new Error('useMall must be used within a MallProvider');
  return context;
};
