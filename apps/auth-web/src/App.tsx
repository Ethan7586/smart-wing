/**
 * 智慧翼企业福利商城 - 应用入口 App.tsx
 * 包含 MallProvider 及页面路由与域名模拟控制器
 * 技术服务方：雍彻科技
 */

import React from 'react';
import { MallProvider, useMallContext } from './context/MallContext';
import { LoginPage } from './screens/LoginPage';

// Most visitors arrive to authenticate. The post-login transition screens are
// independent and should not enlarge the password-entry page for every visit.
const StorefrontHomeScreen = React.lazy(() => import('./screens/StorefrontHomeScreen').then(({ StorefrontHomeScreen }) => ({ default: StorefrontHomeScreen })));
const AdminDashboardScreen = React.lazy(() => import('./screens/AdminDashboardScreen').then(({ AdminDashboardScreen }) => ({ default: AdminDashboardScreen })));
const AuthCallbackScreen = React.lazy(() => import('./screens/AuthCallbackScreen').then(({ AuthCallbackScreen }) => ({ default: AuthCallbackScreen })));

const RouteLoadingFallback = () => <div className="min-h-screen bg-slate-950" aria-busy="true" aria-label="正在切换安全工作区" />;

const MainRouter: React.FC = () => {
  const { currentScreen } = useMallContext();

  switch (currentScreen) {
    case 'login':
      return <LoginPage />;
    case 'storefront_home':
      return (
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <StorefrontHomeScreen />
        </React.Suspense>
      );
    case 'admin_dashboard':
      return (
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AdminDashboardScreen />
        </React.Suspense>
      );
    case 'auth_callback':
      return (
        <React.Suspense fallback={<RouteLoadingFallback />}>
          <AuthCallbackScreen />
        </React.Suspense>
      );
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
