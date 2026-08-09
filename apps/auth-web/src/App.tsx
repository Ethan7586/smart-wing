/**
 * 智慧翼企业福利商城 - 应用入口 App.tsx
 * 包含 MallProvider 及页面路由与域名模拟控制器
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { MallProvider, useMallContext } from './context/MallContext';
import { LoginPage } from './screens/LoginPage';
import { StorefrontHomeScreen } from './screens/StorefrontHomeScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { AuthCallbackScreen } from './screens/AuthCallbackScreen';

const MainRouter: React.FC = () => {
  const { currentScreen } = useMallContext();

  switch (currentScreen) {
    case 'login':
      return <LoginPage />;
    case 'storefront_home':
      return <StorefrontHomeScreen />;
    case 'admin_dashboard':
      return <AdminDashboardScreen />;
    case 'auth_callback':
      return <AuthCallbackScreen />;
    default:
      return <LoginPage />;
  }
};

export default function App() {
  return (
    <MallProvider>
      <MainRouter />
    </MallProvider>
  );
}
