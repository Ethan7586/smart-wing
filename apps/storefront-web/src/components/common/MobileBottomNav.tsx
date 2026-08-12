import React from 'react';
import { Home, Grid2X2, ShoppingCart, ClipboardList, User } from 'lucide-react';
import { PageRoute, useMall } from '../../context/MallContext';

const items: Array<{
  page: PageRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { page: 'home', label: '首页', icon: Home },
  { page: 'category', label: '分类', icon: Grid2X2 },
  { page: 'cart', label: '购物车', icon: ShoppingCart },
  { page: 'orders', label: '订单', icon: ClipboardList },
  { page: 'user-center', label: '我的', icon: User },
];

export const MobileBottomNav: React.FC = () => {
  const { currentPage, cartCount, navigateTo } = useMall();

  return (
    <nav aria-label="移动端主导航" className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-4px_18px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.page;
          return (
            <button key={item.page} type="button" onClick={() => navigateTo(item.page)} className={`relative flex flex-col items-center justify-center gap-1 text-[11px] ${active ? 'text-[var(--sw-brand)] font-bold' : 'text-gray-500'}`}>
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.page === 'cart' && cartCount > 0 && <span className="absolute top-1.5 left-1/2 ml-1 rounded-full bg-[#FF7A00] px-1.5 text-[9px] leading-4 text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
