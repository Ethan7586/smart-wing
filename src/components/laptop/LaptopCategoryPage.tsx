import React, { useState } from 'react';
import { useMall, LaptopPage } from '../../context/MallContext';
import type { FrontendProduct } from '../../adapters/frontendData';
import {
  Filter,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Zap,
  CheckCircle2,
  Search,
  Tag,
  Sparkles,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';

interface LaptopCategoryPageProps {
  onSelectTab: (tab: LaptopPage) => void;
}

export const LaptopCategoryPage: React.FC<LaptopCategoryPageProps> = ({ onSelectTab }) => {
  const {
    addToCart,
    showToast,
    presentationProducts: MOCK_PRODUCTS,
  } = useMall();

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [allowMealCardOnly, setAllowMealCardOnly] = useState<boolean>(false);
  const [subsidyOnly, setSubsidyOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'default' | 'sales' | 'price-asc' | 'price-desc'>('default');
  const [isFilterCollapsed, setIsFilterCollapsed] = useState<boolean>(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);

  // Filter products
  let filtered = MOCK_PRODUCTS.filter(p => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (allowMealCardOnly && !p.allowMealCard) return false;
    if (subsidyOnly && !p.isEnterpriseSubsidized) return false;
    if (p.welfarePrice < priceRange[0] || p.welfarePrice > priceRange[1]) return false;
    return true;
  });

  // Sort products
  if (sortBy === 'sales') {
    filtered = [...filtered].sort((a, b) => b.salesVolume - a.salesVolume);
  } else if (sortBy === 'price-asc') {
    filtered = [...filtered].sort((a, b) => a.welfarePrice - b.welfarePrice);
  } else if (sortBy === 'price-desc') {
    filtered = [...filtered].sort((a, b) => b.welfarePrice - a.welfarePrice);
  }

  const handleAddToCart = (product: any, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
    showToast(`已成功将「${product.title}」加入购物车`, 'success');
  };

  return (
    <div className="w-full bg-[#F5F7FA] min-h-[80vh] pb-8 font-sans">
      <div className="max-w-[1240px] mx-auto pt-3 px-3">
        {/* 面包屑与搜索统计 */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span
              onClick={() => onSelectTab('home-1366')}
              className="hover:text-[#1F5EFF] cursor-pointer"
            >
              首页
            </span>
            <span>&gt;</span>
            <span className="font-bold text-gray-800">商品分类与企采搜索结果</span>
          </div>
          <div className="text-[11px] text-gray-400">
            共找到 <span className="font-bold text-[#1F5EFF]">{filtered.length}</span> 件企采符合件
          </div>
        </div>

        {/* 主体两栏：折叠式筛选栏 (200px) + 右侧排序与商品网格 */}
        <div className="flex gap-3 items-start">
          {/* 左侧筛选栏 */}
          <div
            className={`transition-all duration-300 flex-shrink-0 bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden ${
              isFilterCollapsed ? 'w-[48px]' : 'w-[200px]'
            }`}
          >
            {/* 筛选栏头部 */}
            <div className="bg-[#143A8F] text-white p-2.5 flex items-center justify-between text-xs font-bold">
              {!isFilterCollapsed && (
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-yellow-300" />
                  <span>多维筛选条件</span>
                </div>
              )}
              <button
                onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                className="hover:bg-white/20 rounded p-1 transition-colors cursor-pointer text-white"
                title={isFilterCollapsed ? '展开筛选' : '折叠筛选'}
              >
                {isFilterCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {!isFilterCollapsed && (
              <div className="p-3 space-y-3.5 text-xs">
                {/* 1. 分类筛选 */}
                <div>
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center justify-between">
                    <span>商品类别</span>
                    <span className="text-[9px] text-gray-400">全库</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { id: 'all', label: '全部商品' },
                      { id: 'office', label: '办公设备' },
                      { id: 'food', label: '米面粮油与生鲜' },
                      { id: 'appliance', label: '居家防暑电器' },
                      { id: 'virtual', label: '虚拟卡券' },
                      { id: 'cinema', label: '电影票务' }
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => setFilterCategory(item.id)}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                          filterCategory === item.id
                            ? 'bg-[#1F5EFF] text-white font-bold'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2.5">
                  <div className="font-bold text-gray-800 mb-1.5">账户可抵扣范围</div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-700">
                      <input
                        type="checkbox"
                        checked={allowMealCardOnly}
                        onChange={e => setAllowMealCardOnly(e.target.checked)}
                        className="rounded text-[#1F5EFF] focus:ring-[#1F5EFF]"
                      />
                      <span>仅看支持餐卡商品</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-700">
                      <input
                        type="checkbox"
                        checked={subsidyOnly}
                        onChange={e => setSubsidyOnly(e.target.checked)}
                        className="rounded text-[#1F5EFF] focus:ring-[#1F5EFF]"
                      />
                      <span>仅看企业专项补贴</span>
                    </label>
                  </div>
                </div>

                {/* 价格区间 */}
                <div className="border-t border-gray-100 pt-2.5">
                  <div className="font-bold text-gray-800 mb-1.5">福利价区间 (元)</div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <input
                      type="number"
                      value={priceRange[0]}
                      onChange={e => setPriceRange([Number(e.target.value), priceRange[1]])}
                      className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-center outline-none focus:border-[#1F5EFF]"
                      placeholder="0"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={e => setPriceRange([priceRange[0], Number(e.target.value)])}
                      className="w-full border border-gray-300 rounded px-1.5 py-0.5 text-center outline-none focus:border-[#1F5EFF]"
                      placeholder="5000"
                    />
                  </div>
                </div>

                {/* 重置筛选 */}
                <button
                  onClick={() => {
                    setFilterCategory('all');
                    setAllowMealCardOnly(false);
                    setSubsidyOnly(false);
                    setPriceRange([0, 5000]);
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重置所有筛选</span>
                </button>
              </div>
            )}
          </div>

          {/* 右侧：排序工具条与商品列表网格 */}
          <div className="flex-1 min-w-0 space-y-2.5">
            {/* 顶部排序与工具栏 */}
            <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-2xs flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-gray-500 mr-1">排序规则:</span>
                <button
                  onClick={() => setSortBy('default')}
                  className={`px-3 py-1 rounded font-bold cursor-pointer transition-colors ${
                    sortBy === 'default' ? 'bg-[#1F5EFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  综合排序
                </button>

                <button
                  onClick={() => setSortBy('sales')}
                  className={`px-3 py-1 rounded font-bold cursor-pointer transition-colors ${
                    sortBy === 'sales' ? 'bg-[#1F5EFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  销量优先
                </button>

                <button
                  onClick={() => setSortBy(sortBy === 'price-asc' ? 'price-desc' : 'price-asc')}
                  className={`px-3 py-1 rounded font-bold cursor-pointer transition-colors ${
                    sortBy.startsWith('price') ? 'bg-[#1F5EFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  价格 {sortBy === 'price-asc' ? '↑' : sortBy === 'price-desc' ? '↓' : ''}
                </button>
              </div>

              <div className="text-[11px] text-gray-500 flex items-center gap-2">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                  全场企采开具增值税专票
                </span>
              </div>
            </div>

            {/* 高密度商品网格 (根据视口展示 3-4 列) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(product => (
                <div
                  key={product.id}
                  onClick={() => onSelectTab('detail')}
                  className="bg-white border border-gray-200 hover:border-[#1F5EFF] rounded-lg p-2.5 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                >
                  {/* 标签 */}
                  <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                    <span className="bg-[#E5484D] text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-2xs">
                      福利价
                    </span>
                    {product.allowMealCard && (
                      <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-2xs">
                        餐卡支持
                      </span>
                    )}
                  </div>

                  <div>
                    {/* 图片 */}
                    <div className="w-full h-[125px] rounded-md overflow-hidden bg-gray-50 mb-2 flex items-center justify-center p-1">
                      <img
                        src={product.image}
                        alt={product.title}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                      <span className="bg-gray-100 text-gray-600 px-1 py-0.2 rounded font-medium">
                        {product.supplierName || '自营仓'}
                      </span>
                      <span>·</span>
                      <span className="text-blue-600 font-medium">现货速发</span>
                    </div>

                    <h3 className="font-bold text-xs text-gray-800 group-hover:text-[#1F5EFF] line-clamp-2 leading-tight min-h-[32px]">
                      {product.title}
                    </h3>
                  </div>

                  {/* 价格与加入购物车 (必须不可被截断) */}
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-bold text-[#E5484D]">¥</span>
                        <span className="text-base font-black text-[#E5484D] leading-none">
                          {product.welfarePrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 line-through mt-0.5">
                        官网价 ¥{product.marketPrice.toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={e => handleAddToCart(product, e)}
                      className="bg-[#1F5EFF] hover:bg-blue-700 text-white font-bold text-xs px-2.5 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-2xs flex-shrink-0"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>加购物车</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
