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

// Pages
import { HomePage } from './screens/HomePage';
import { CategoryPage } from './screens/CategoryPage';
import { ProductDetailPage } from './screens/ProductDetailPage';
import { CartPage } from './screens/CartPage';
import { CheckoutPage } from './screens/CheckoutPage';
import { PaymentResultPage } from './screens/PaymentResultPage';
import { UserCenterPage } from './screens/UserCenterPage';
import { OrdersPage } from './screens/OrdersPage';
import { OrderDetailPage } from './screens/OrderDetailPage';
import { AfterSalePage } from './screens/AfterSalePage';
import { CouponsPage } from './screens/CouponsPage';
import { BalancePage } from './screens/BalancePage';
import { MvpConsolePage } from './screens/MvpConsolePage';

const AppContent: React.FC = () => {
  const { currentPage } = useMall();

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
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-gray-800 flex flex-col justify-between pb-16 md:pb-0 font-sans antialiased selection:bg-[#1F5EFF] selection:text-white">
      {/* 顶部企业导航栏 */}
      <HeaderBar />
      <MvpSessionBar />

      {/* 主视图渲染区 */}
      <main className="flex-1 w-full">
        {renderPage()}
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
