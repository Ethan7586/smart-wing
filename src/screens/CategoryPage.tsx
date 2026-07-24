/**
 * 智慧翼企业福利商城 - 分类与搜索列表页 CategoryPage screen
 * 支持多维筛选 (品牌/价格/账户/履约)、多重排序、网格与列表视图切换及分页
 * 技术服务方：雍彻科技
 */
import React from 'react';
import { MOCK_CATEGORIES } from '../mock/data';
import { CategoryResults } from '../features/catalog/CategoryResults';
import { useCategoryCatalog } from '../features/catalog/useCategoryCatalog';
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
  const model = useCategoryCatalog();
  const {
    navigateTo, routeParams, products, selectedCategory, setSelectedCategory, selectedItemType,
    setSelectedItemType, selectedSupplier, setSelectedSupplier,
    selectedAccount, setSelectedAccount, keyword, setKeyword, minPrice,
    setMinPrice, maxPrice, setMaxPrice, inStockOnly, setInStockOnly,
    selectedBrand, setSelectedBrand, viewMode, setViewMode, sortBy, setSortBy,
    compareList, setCompareList, currentPageNum, setCurrentPageNum, pageSize,
    availableBrands, finalProducts, totalPages, paginatedProducts,
    resetFilters, toggleCompare
  } = model;
  const availableCategories = MOCK_CATEGORIES.filter(category =>
    products.some(product => product.categoryId === category.id)
  );
  const itemTypeOptions = [
    { id: 'physical', label: '实物快递' },
    { id: 'movie_ticket', label: '电影票通兑' },
    { id: 'virtual_coupon', label: '虚拟卡券' },
    { id: 'supermarket', label: '商超好卡' },
    { id: 'nearby_store', label: '附近门店核销' },
    { id: 'life_service', label: '生活服务' }
  ].filter(option => products.some(product => product.itemType === option.id));
  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-4 font-sans">
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
      <div className="bg-white border border-gray-200 rounded-md p-4 shadow-xs space-y-3 text-xs">
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
            {availableCategories.map(cat => (
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
        <div className="flex items-start gap-4 pb-2.5 border-b border-gray-100">
          <span className="w-20 font-bold text-gray-700 flex-shrink-0 pt-1">商品类型：</span>
          <div className="flex-1 flex flex-wrap gap-1.5">
            {[{ id: 'all', label: '全部形态' }, ...itemTypeOptions].map(t => (
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
      <CategoryResults model={model} />
    </div>
  );
};
