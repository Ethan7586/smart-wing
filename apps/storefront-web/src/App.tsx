'use client';

/**
 * 智慧翼企业福利商城 - 主入口组件 App.tsx
 * 桌面端优先，12列栅格高密度架构，路由切换与全局上下文关联
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { MallProvider, useMall } from './context/MallContext';
import { HeaderBar } from './components/common/HeaderBar';
import { QuickViewModal } from './components/common/QuickViewModal';
import { ToastContainer } from './components/common/ToastContainer';
import { Footer } from './components/common/Footer';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { MvpSessionBar } from './components/common/MvpSessionBar';
import { HomePage } from './screens/HomePage';

const MobileFrame = React.lazy(() => import('./components/mobile/MobileFrame').then(({ MobileFrame }) => ({ default: MobileFrame })));
const TabletFrame = React.lazy(() => import('./components/mobile/TabletFrame').then(({ TabletFrame }) => ({ default: TabletFrame })));
const LaptopFrame = React.lazy(() => import('./components/laptop/LaptopFrame').then(({ LaptopFrame }) => ({ default: LaptopFrame })));
const CategoryPage = React.lazy(() => import('./screens/CategoryPage').then(({ CategoryPage }) => ({ default: CategoryPage })));
const ProductDetailPage = React.lazy(() => import('./screens/ProductDetailPage').then(({ ProductDetailPage }) => ({ default: ProductDetailPage })));
const CartPage = React.lazy(() => import('./screens/CartPage').then(({ CartPage }) => ({ default: CartPage })));
const CheckoutPage = React.lazy(() => import('./screens/CheckoutPage').then(({ CheckoutPage }) => ({ default: CheckoutPage })));
const PaymentResultPage = React.lazy(() => import('./screens/PaymentResultPage').then(({ PaymentResultPage }) => ({ default: PaymentResultPage })));
const loadUserCenterPage = () => import('./screens/UserCenterPage').then(({ UserCenterPage }) => ({ default: UserCenterPage }));
const UserCenterPage = React.lazy(loadUserCenterPage);
const OrdersPage = React.lazy(() => import('./screens/OrdersPage').then(({ OrdersPage }) => ({ default: OrdersPage })));
const OrderDetailPage = React.lazy(() => import('./screens/OrderDetailPage').then(({ OrderDetailPage }) => ({ default: OrderDetailPage })));
const AfterSalePage = React.lazy(() => import('./screens/AfterSalePage').then(({ AfterSalePage }) => ({ default: AfterSalePage })));
const CouponsPage = React.lazy(() => import('./screens/CouponsPage').then(({ CouponsPage }) => ({ default: CouponsPage })));
const BalancePage = React.lazy(() => import('./screens/BalancePage').then(({ BalancePage }) => ({ default: BalancePage })));
const MvpConsolePage = React.lazy(() => import('./screens/MvpConsolePage').then(({ MvpConsolePage }) => ({ default: MvpConsolePage })));
const MvpDeliveryPage = React.lazy(() => import('./screens/MvpDeliveryPage').then(({ MvpDeliveryPage }) => ({ default: MvpDeliveryPage })));
const ArchitecturePage = React.lazy(() => import('./screens/ArchitecturePage').then(({ ArchitecturePage }) => ({ default: ArchitecturePage })));

const PageLoadingFallback = () => <div className="min-h-[360px] bg-[#F5F7FA]" aria-busy="true" aria-label="正在加载页面" />;

const AppContent: React.FC = () => {
  const { currentPage, appMode } = useMall();

  React.useEffect(() => {
    // The account page contains the security center and is one of the first
    // destinations after login. Warm its code chunk once the home shell has
    // settled so the first click does not wait on another network round trip.
    const timer = window.setTimeout(() => void loadUserCenterPage(), 1_200);
    return () => window.clearTimeout(timer);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'category':
        return <CategoryPage />;
      case 'detail':
        return <ProductDetailPage />;
      case 'cart':
        return <CartPage />;
      case 'checkout':
        return <CheckoutPage />;
      case 'payment-result':
        return <PaymentResultPage />;
      case 'user-center':
        return <UserCenterPage />;
      case 'orders':
        return <OrdersPage />;
      case 'order-detail':
        return <OrderDetailPage />;
      case 'after-sale':
        return <AfterSalePage />;
      case 'coupons':
        return <CouponsPage />;
      case 'balance':
        return <BalancePage />;
      case 'mvp-console':
        return <MvpConsolePage />;
      case 'mvp-delivery':
        return <MvpDeliveryPage />;
      case 'architecture':
        return <ArchitecturePage />;
      default:
        return <HomePage />;
    }
  };

  if (appMode === 'mini-program' || appMode === 'android-app') {
    return (
      <React.Suspense fallback={<PageLoadingFallback />}>
        <MobileFrame />
      </React.Suspense>
    );
  }

  if (appMode === 'tablet-app') {
    return (
      <React.Suspense fallback={<PageLoadingFallback />}>
        <TabletFrame />
      </React.Suspense>
    );
  }

  if (appMode === 'laptop-web') {
    return (
      <React.Suspense fallback={<PageLoadingFallback />}>
        <LaptopFrame />
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-gray-800 flex flex-col justify-between pb-16 md:pb-0 font-sans antialiased selection:bg-[var(--sw-brand)] selection:text-white">
      {/* 顶部企业导航栏 */}
      <HeaderBar />
      <MvpSessionBar />

      {/* 主视图渲染区 */}
      <main className="flex-1 w-full">
        <React.Suspense fallback={<PageLoadingFallback />}>{renderPage()}</React.Suspense>
      </main>

      {/* 快速预览 Modal */}
      <QuickViewModal />

      {/* 全局通知 Toast */}
      <ToastContainer />
      <MobileBottomNav />

      {/* 底部 Footer (带雍彻科技服务方标识) */}
      <Footer />
    </div>
  );
};

export function App() {
  return (
    <MallProvider>
      <AppContent />
    </MallProvider>
  );
}

export default App;
