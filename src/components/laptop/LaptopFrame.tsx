import React from 'react';
import { useMall, LaptopPage } from '../../context/MallContext';
import { LaptopTopSwitcher } from './LaptopTopSwitcher';
import { LaptopHeader } from './LaptopHeader';
import { LaptopHomePage1366 } from './LaptopHomePage1366';
import { LaptopHomePage1440 } from './LaptopHomePage1440';
import { LaptopCategoryPage } from './LaptopCategoryPage';
import { LaptopDetailPage } from './LaptopDetailPage';
import { LaptopCartCheckoutPage } from './LaptopCartCheckoutPage';
import { LaptopOrdersPage } from './LaptopOrdersPage';
import { QuickViewModal } from '../common/QuickViewModal';
import { ToastContainer } from '../common/ToastContainer';
import { Footer } from '../common/Footer';

export const LaptopFrame: React.FC = () => {
  const { laptopPage, setLaptopPage } = useMall();

  const handleSelectTab = (tab: LaptopPage) => {
    setLaptopPage(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderLaptopContent = () => {
    switch (laptopPage) {
      case 'home-1366':
        return <LaptopHomePage1366 onSelectTab={handleSelectTab} />;
      case 'home-1440':
        return <LaptopHomePage1440 onSelectTab={handleSelectTab} />;
      case 'category':
        return <LaptopCategoryPage onSelectTab={handleSelectTab} />;
      case 'detail':
        return <LaptopDetailPage onSelectTab={handleSelectTab} />;
      case 'cart':
        return <LaptopCartCheckoutPage onSelectTab={handleSelectTab} />;
      case 'orders':
        return <LaptopOrdersPage onSelectTab={handleSelectTab} />;
      default:
        return <LaptopHomePage1366 onSelectTab={handleSelectTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-gray-800 flex flex-col justify-between font-sans overflow-x-hidden selection:bg-[#1F5EFF] selection:text-white">
      {/* 1. 多端多视口顶栏切换器 */}
      <LaptopTopSwitcher />

      {/* 2. 13/14" 笔记本专属紧凑页头 (<= 110px 高度) */}
      <LaptopHeader activeTab={laptopPage} onSelectTab={handleSelectTab} />

      {/* 3. 笔记本端核心 6 页面视图渲染区 */}
      <main className="flex-1 w-full overflow-x-hidden">
        {renderLaptopContent()}
      </main>

      {/* 4. 快速预览 Modal 与 Toast 提示框 */}
      <QuickViewModal />
      <ToastContainer />

      {/* 5. 底部版权与服务商标识 (雍彻科技) */}
      <Footer />
    </div>
  );
};
