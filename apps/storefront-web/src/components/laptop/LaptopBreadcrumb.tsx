import React from 'react';
import type { LaptopPage } from '../../context/MallContext';

export const LaptopBreadcrumb: React.FC<{
  productTitle: string;
  onSelectTab: (tab: LaptopPage) => void;
}> = ({ productTitle, onSelectTab }) => (
  <div className="flex items-center gap-1.5 text-xs text-gray-500">
    <button onClick={() => onSelectTab('home-1366')} className="hover:text-[var(--sw-brand)]">
      首页
    </button>
    <span>&gt;</span>
    <button onClick={() => onSelectTab('category')} className="hover:text-[var(--sw-brand)]">
      企采数码办公
    </button>
    <span>&gt;</span>
    <span className="font-bold text-gray-800 truncate">{productTitle}</span>
  </div>
);
