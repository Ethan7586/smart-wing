/**
 * 智慧翼企业福利商城 - 分类与搜索列表页 CategoryPage screen
 * 支持多维筛选 (品牌/价格/账户/履约)、多重排序、网格与列表视图切换及分页
 * 技术服务方：雍彻科技
 */

import React, { useState, useMemo } from 'react';
import { useMall } from '../context/MallContext';
import { ProductCard } from '../components/common/ProductCard';
import { mallService } from '../services/mallService';
import { MOCK_CATEGORIES } from '../mock/data';
import { ProductItemType, Product } from '../types';
import {
  Search,
  SlidersHorizontal,
  Grid,
  List,
  ChevronRight,
  CreditCard,
  Utensils,
  Truck,
  Check,
  X,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Store,
  Ticket
} from 'lucide-react';

export const CategoryPage: React.FC = () => {
  const { routeParams, navigateTo, addToCart } = useMall();

  // Local state for filters
  const [selectedCategory, setSelectedCategory] = useState<string>(routeParams.categoryId || 'all');
  const [selectedItemType, setSelectedItemType] = useState<ProductItemType | 'all'>(
    (routeParams.itemType as any) || 'all'
  );
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [keyword, setKeyword] = useState<string>(routeParams.keyword || '');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  // View & Sort
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'default' | 'sales' | 'priceAsc' | 'priceDesc' | 'newest'>('default');

  // Compare List
  const [compareList, setCompareList] = useState<Product[]>([]);

  // Pagination
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const pageSize = 15;

  // Filter products via mallService
  const filteredProducts = useMemo(() => {
    return mallService.getProducts({
      keyword: keyword || routeParams.keyword,
      categoryId: selectedCategory,
      itemType: selectedItemType,
      supplierType: selectedSupplier,
      accountType: selectedAccount,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      inStockOnly,
      sortBy
    });
  }, [
    keyword,
    routeParams.keyword,
    selectedCategory,
    selectedItemType,
    selectedSupplier,
    selectedAccount,
    minPrice,
    maxPrice,
    inStockOnly,
    sortBy
  ]);

  // Available brands derived from result set
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    filteredProducts.forEach(p => brands.add(p.brand));
    return Array.from(brands);
  }, [filteredProducts]);

  const finalProducts = useMemo(() => {
    if (selectedBrand === 'all') return filteredProducts;
    return filteredProducts.filter(p => p.brand === selectedBrand);
  }, [filteredProducts, selectedBrand]);

  const totalPages = Math.ceil(finalProducts.length / pageSize) || 1;
  const paginatedProducts = finalProducts.slice(
    (currentPageNum - 1) * pageSize,
    currentPageNum * pageSize
  );

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedItemType('all');
    setSelectedSupplier('all');
    setSelectedAccount('all');
    setKeyword('');
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSelectedBrand('all');
    setSortBy('default');
    setCurrentPageNum(1);
  };

  const toggleCompare = (product: Product) => {
    if (compareList.some(p => p.id === product.id)) {
      setCompareList(prev => prev.filter(p => p.id !== product.id));
    } else {
      if (compareList.length >= 3) {
        alert('最多支持对比3件商品');
        return;
      }
      setCompareList(prev => [...prev, product]);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-4 font-sans">
      {/* 1. 面包屑导航 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <button
          onClick={() => navigateTo('home')}
          className="hover:text-[#1F5EFF] transition-colors"
        >
          首页
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="font-semibold text-gray-900">商品选购与搜索</span>
        {routeParams.keyword && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-blue-600 font-bold">“{routeParams.keyword}”的检索结果</span>
          </>
        )}
      </div>

      {/* 2. 综合多维筛选卡片 */}
      <div className="bg-white border border-gray-200 rounded-md p-4 shadow-xs space-y-3 text-xs">
        {/* 全部分类 */}
        <div className="flex items-start gap-4 pb-2.5 border-b border-gray-100">
          <span className="w-20 font-bold text-gray-700 flex-shrink-0 pt-1">全部分类：</span>
          <div className="flex-1 flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setSelectedCategory('all');
                setCurrentPageNum(1);
              }}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#1F5EFF] text-white font-bold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部品类
            </button>
            {MOCK_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setCurrentPageNum(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#1F5EFF] text-white font-bold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* 商品类型筛选 */}
        <div className="flex items-start gap-4 pb-2.5 border-b border-gray-100">
          <span className="w-20 font-bold text-gray-700 flex-shrink-0 pt-1">商品类型：</span>
          <div className="flex-1 flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: '全部形态' },
              { id: 'physical', label: '实物快递' },
              { id: 'movie_ticket', label: '电影票通兑' },
              { id: 'virtual_coupon', label: '虚拟卡券' },
              { id: 'supermarket', label: '商超好卡' },
              { id: 'nearby_store', label: '附近门店核销' },
              { id: 'life_service', label: '生活服务' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedItemType(t.id as any);
                  setCurrentPageNum(1);
                }}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  selectedItemType === t.id
                    ? 'bg-[#143A8F] text-white font-bold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 允许扣减账户与供应渠道 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2.5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <span className="w-20 font-bold text-gray-700 flex-shrink-0">支持账户：</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedAccount('all')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  selectedAccount === 'all' ? 'bg-blue-50 border border-blue-300 font-bold text-[#1F5EFF]' : 'bg-gray-100 text-gray-700'
                }`}
              >
                不限账户
              </button>
              <button
                onClick={() => setSelectedAccount('welfare')}
                className={`px-2.5 py-1 rounded cursor-pointer flex items-center gap-1 ${
                  selectedAccount === 'welfare' ? 'bg-blue-100 border border-blue-400 font-bold text-[#1F5EFF]' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Welfare Balance
              </button>
              <button
                onClick={() => setSelectedAccount('meal')}
                className={`px-2.5 py-1 rounded cursor-pointer flex items-center gap-1 ${
                  selectedAccount === 'meal' ? 'bg-orange-100 border border-orange-400 font-bold text-orange-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" /> Meal Card
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="w-20 font-bold text-gray-700 flex-shrink-0">供应渠道：</span>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: '全部渠道' },
                { id: 'self_operated', label: '平台自营仓' },
                { id: 'third_party', label: '京东/第三方API' },
                { id: 'group_owned', label: '集团特选供应' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSupplier(s.id)}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    selectedSupplier === s.id ? 'bg-gray-900 text-white font-bold' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 品牌与价格区间 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700">品牌：</span>
              <select
                value={selectedBrand}
                onChange={e => setSelectedBrand(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="all">不限品牌 ({availableBrands.length})</option>
                {availableBrands.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-700">福利价格区间：</span>
              <input
                type="number"
                placeholder="最低价"
                value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder="最高价"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 font-medium">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={e => setInStockOnly(e.target.checked)}
                className="rounded text-[#1F5EFF]"
              />
              <span>仅看有货</span>
            </label>
          </div>

          <button
            onClick={resetFilters}
            className="text-gray-500 hover:text-red-600 text-xs flex items-center gap-1 font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置所有条件
          </button>
        </div>
      </div>

      {/* 3. 排序控制与视图切换工具栏 */}
      <div className="bg-white border border-gray-200 rounded-md p-3 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-500">排序：</span>
          <button
            onClick={() => setSortBy('default')}
            className={`px-3 py-1 rounded cursor-pointer font-medium ${
              sortBy === 'default' ? 'bg-[#1F5EFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            综合
          </button>
          <button
            onClick={() => setSortBy('sales')}
            className={`px-3 py-1 rounded cursor-pointer font-medium ${
              sortBy === 'sales' ? 'bg-[#1F5EFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            按销量
          </button>
          <button
            onClick={() => setSortBy(sortBy === 'priceAsc' ? 'priceDesc' : 'priceAsc')}
            className={`px-3 py-1 rounded cursor-pointer font-medium ${
              sortBy.startsWith('price') ? 'bg-[#1F5EFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            价格 {sortBy === 'priceAsc' ? '↑' : sortBy === 'priceDesc' ? '↓' : ''}
          </button>
          <button
            onClick={() => setSortBy('newest')}
            className={`px-3 py-1 rounded cursor-pointer font-medium ${
              sortBy === 'newest' ? 'bg-[#1F5EFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            新品上架
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-gray-500">
            共找到 <strong className="text-[#1F5EFF]">{finalProducts.length}</strong> 件符合福利采购条件的商品
          </span>

          <div className="flex items-center border border-gray-300 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#1F5EFF] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              title="网格平铺 (5列)"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-[#1F5EFF] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              title="列表展示"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. 商品展示区域 (网格 vs 列表) */}
      {paginatedProducts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-12 text-center space-y-3">
          <Search className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-700">暂无匹配的商品</h3>
          <p className="text-xs text-gray-400">请尝试调整筛选条件或重置搜索词。</p>
          <button
            onClick={resetFilters}
            className="bg-[#1F5EFF] text-white font-bold text-xs px-4 py-2 rounded"
          >
            重置所有条件
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {paginatedProducts.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedProducts.map(p => {
            const inCompare = compareList.some(c => c.id === p.id);
            return (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-md p-4 flex flex-col sm:flex-row items-center gap-4 hover:border-blue-400 shadow-xs transition-all"
              >
                <img
                  src={p.images[0]}
                  alt={p.title}
                  className="w-28 h-28 object-cover rounded border border-gray-100 cursor-pointer"
                  onClick={() => navigateTo('detail', { productId: p.id })}
                />

                <div className="flex-1 space-y-1.5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#1F5EFF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {p.supplierName}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">品牌: {p.brand}</span>
                  </div>

                  <h3
                    onClick={() => navigateTo('detail', { productId: p.id })}
                    className="text-sm font-bold text-gray-900 cursor-pointer hover:text-[#1F5EFF]"
                  >
                    {p.title}
                  </h3>

                  <p className="text-xs text-gray-500 line-clamp-1">{p.subtitle}</p>

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>月销 {p.salesCount}</span>
                    <span>·</span>
                    <span className="text-green-700 font-medium">履约: {p.deliverySla}</span>
                    <span>·</span>
                    <span>库存 {p.stock} 件</span>
                  </div>
                </div>

                <div className="text-right space-y-2 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4 min-w-[180px]">
                  <div>
                    <span className="text-xs text-[#FF7A00] font-bold">福利特惠价</span>
                    <div className="text-2xl font-black text-[#FF7A00]">
                      ¥{p.priceWelfare.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-gray-400 line-through">
                      市场价 ¥{p.priceMarket.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => toggleCompare(p)}
                      className={`text-xs px-2 py-1 rounded border ${
                        inCompare ? 'bg-blue-50 border-blue-400 text-blue-600 font-bold' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {inCompare ? '已加入对比' : '+对比'}
                    </button>
                    <button
                      onClick={() => addToCart(p, 1, p.specs?.[0] ? { [p.specs[0].name]: p.specs[0].options[0] } : {})}
                      className="bg-[#1F5EFF] hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer"
                    >
                      加入购物车
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. 分页器 (Pagination) */}
      {totalPages > 1 && (
        <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between text-xs">
          <div className="text-gray-500">
            显示第 {(currentPageNum - 1) * pageSize + 1} - {Math.min(currentPageNum * pageSize, finalProducts.length)} 条，共 {finalProducts.length} 条
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPageNum === 1}
              onClick={() => setCurrentPageNum(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
            >
              上一页
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPageNum(page)}
                className={`w-7 h-7 rounded font-bold cursor-pointer ${
                  currentPageNum === page ? 'bg-[#1F5EFF] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              disabled={currentPageNum === totalPages}
              onClick={() => setCurrentPageNum(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 6. 底部固定对比栏 (若添加了商品对比) */}
      {compareList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#1F5EFF] shadow-2xl p-4 z-40 animate-in slide-in-from-bottom duration-200">
          <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">商品对比 ({compareList.length}/3)：</span>
              <div className="flex items-center gap-3">
                {compareList.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-2 py-1 rounded">
                    <img src={item.images[0]} alt="" className="w-6 h-6 rounded object-cover" />
                    <span className="font-medium truncate max-w-[120px]">{item.title}</span>
                    <span className="text-[#FF7A00] font-bold">¥{item.priceWelfare}</span>
                    <button onClick={() => toggleCompare(item)} className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompareList([])}
                className="text-gray-500 hover:underline"
              >
                清空对比
              </button>
              <button
                onClick={() => alert(`已生成商品对比矩阵：\n` + compareList.map(c => `· ${c.title}: 福利价¥${c.priceWelfare}, 市场价¥${c.priceMarket}, 履约:${c.deliverySla}`).join('\n'))}
                className="bg-[#1F5EFF] text-white font-bold px-4 py-2 rounded"
              >
                开始对比参数
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
