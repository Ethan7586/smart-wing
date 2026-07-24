import React, { useState } from 'react';
import { useMall } from '../../context/MallContext';
import {
  Search,
  Scan,
  Gift,
  Building2,
  CreditCard,
  Utensils,
  ChevronRight,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle,
  Plus,
  ArrowRight,
  SlidersHorizontal,
  Flame,
  Coffee,
  Laptop
} from 'lucide-react';

export const TabletHomePage: React.FC = () => {
  const {
    user,
    currentMall,
    tabletOrientation,
    setTabletPage,
    addToCart,
    cart,
    cartCount,
    triggerPendingFeature,
    presentationProducts: MOCK_PRODUCTS,
    presentationCategories: MOCK_CATEGORIES,
  } = useMall();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchKey, setSearchKey] = useState('');

  const filteredProducts = activeCategory === 'all'
    ? MOCK_PRODUCTS
    : MOCK_PRODUCTS.filter(p => p.categoryId === activeCategory);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.priceMall * item.quantity, 0);

  if (tabletOrientation === 'portrait') {
    // Tablet Portrait View (800x1280)
    return (
      <div className="bg-[#F5F7FA] min-h-full flex flex-col font-sans text-gray-800 pb-20 overflow-y-auto">
        {/* Top Header Section */}
        <div className="bg-[#143A8F] text-white p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#1F5EFF] flex items-center justify-center font-black text-white text-lg">
                翼
              </div>
              <div>
                <div className="text-sm font-black tracking-wide flex items-center gap-2">
                  <span>智慧翼企业福利商城</span>
                  <span className="bg-yellow-400 text-gray-900 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                    平板竖屏端
                  </span>
                </div>
                <div className="text-xs text-blue-200 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>{user.enterpriseName}</span>
                </div>
              </div>
            </div>

            {/* Quick Balances Chips */}
            <div className="flex items-center gap-2">
              <div
                onClick={() => triggerPendingFeature('平板福利卡账单', '查看企业福利卡实时扣款历史。')}
                className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 text-right cursor-pointer"
              >
                <div className="text-[10px] text-blue-200">福利卡</div>
                <div className="text-xs font-black font-mono text-yellow-300">
                  ¥{user.welfareBalance.toFixed(0)}
                </div>
              </div>
              <div
                onClick={() => triggerPendingFeature('平板餐卡账单', '查看餐卡消费明细。')}
                className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 text-right cursor-pointer"
              >
                <div className="text-[10px] text-blue-200">餐卡</div>
                <div className="text-xs font-black font-mono text-amber-300">
                  ¥{user.mealBalance.toFixed(0)}
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-gray-800 shadow-inner">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索企采福利、办公室咖啡、礼品卡券..."
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                className="w-full text-xs bg-transparent outline-none font-medium"
              />
            </div>
            <button
              onClick={() => triggerPendingFeature('平板扫码核销', '调起相机扫描企业兑换码。')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1 cursor-pointer min-h-[44px]"
            >
              <Scan className="w-4 h-4" />
              <span>扫码</span>
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="bg-white border-b border-gray-200 p-2.5 px-4 flex items-center gap-2 overflow-x-auto shadow-2xs">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer min-h-[40px] ${
              activeCategory === 'all'
                ? 'bg-[#1F5EFF] text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部推荐
          </button>
          {MOCK_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer min-h-[40px] ${
                activeCategory === cat.id
                  ? 'bg-[#1F5EFF] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="p-4 space-y-4">
          {/* Banner Hero */}
          <div className="bg-gradient-to-r from-[#143A8F] to-[#1F5EFF] rounded-3xl p-5 text-white shadow-md relative overflow-hidden flex items-center justify-between">
            <div className="space-y-2 max-w-[65%] z-10">
              <span className="bg-amber-400 text-gray-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                企业员工专属福利日
              </span>
              <h2 className="text-xl font-black leading-tight">
                全场正品好物 企采补贴立省 30%
              </h2>
              <p className="text-xs text-blue-100 leading-relaxed">
                支持企业福利卡与餐卡余额无缝全额冲抵，开具增值税专用发票。
              </p>
              <button
                onClick={() => setTabletPage('category')}
                className="bg-white text-[#143A8F] hover:bg-yellow-300 transition-colors font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer min-h-[40px]"
              >
                <span>进入福利专区</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <Gift className="w-28 h-28 text-white/20 absolute -right-2 -bottom-2" />
          </div>

          {/* Product Grid (3 Columns in Portrait Tablet) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>热门企业兑换商品 ({filteredProducts.length})</span>
              </h3>
              <span className="text-xs text-gray-400">触控放大查看</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => setTabletPage('detail', p.id)}
                  className="bg-white rounded-2xl p-3 border border-gray-100 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between cursor-pointer space-y-2"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 relative">
                    <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                    {p.enterpriseSubsidyAmount > 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-[#E5484D] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                        补贴 ¥{p.enterpriseSubsidyAmount}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug">
                      {p.title}
                    </div>
                    <div className="flex items-baseline gap-1 font-mono text-xs">
                      <span className="text-[#E5484D] font-extrabold">¥{p.price}</span>
                      <span className="text-[10px] text-gray-400 line-through">¥{p.originalPrice}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(p, 1);
                    }}
                    className="w-full bg-blue-50 hover:bg-[#1F5EFF] hover:text-white text-[#1F5EFF] font-bold text-xs py-2 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer min-h-[40px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>加购物车</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Persistent Quick Cart Bar */}
        {cartCount > 0 && (
          <div className="fixed bottom-14 left-0 right-0 max-w-[800px] mx-auto bg-gray-900 text-white p-3 px-5 z-20 flex items-center justify-between shadow-2xl border-t border-gray-800">
            <div className="flex items-center gap-3">
              <div className="relative bg-[#1F5EFF] p-2.5 rounded-2xl">
                <ShoppingCart className="w-5 h-5 text-white" />
                <span className="absolute -top-1.5 -right-1.5 bg-[#E5484D] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-300">购物车小计</div>
                <div className="text-base font-black font-mono text-amber-300">
                  ¥{cartTotal.toFixed(2)}
                </div>
              </div>
            </div>

            <button
              onClick={() => setTabletPage('cart')}
              className="bg-[#1F5EFF] hover:bg-blue-600 text-white font-bold text-xs px-6 py-2.5 rounded-2xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5 min-h-[44px]"
            >
              <span>立即去结算</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Tablet Landscape View (1280x800 - 3-Pane Structure)
  return (
    <div className="bg-[#F5F7FA] h-full flex font-sans text-gray-800 overflow-hidden">
      {/* LEFT PANE: Categories, Perks, Nearby (~220px) */}
      <div className="w-56 bg-white border-r border-gray-200 p-3 flex flex-col justify-between overflow-y-auto shrink-0 shadow-2xs space-y-4">
        <div className="space-y-3">
          <div className="text-xs font-black text-gray-400 uppercase tracking-wider px-2">
            一级企采分类
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer min-h-[44px] ${
                activeCategory === 'all'
                  ? 'bg-blue-50 text-[#1F5EFF] border-l-4 border-[#1F5EFF]'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>🔥 全部推荐</span>
              <span className="text-[10px] font-mono text-gray-400">{MOCK_PRODUCTS.length}</span>
            </button>

            {MOCK_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer min-h-[44px] ${
                  activeCategory === cat.id
                    ? 'bg-blue-50 text-[#1F5EFF] border-l-4 border-[#1F5EFF]'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{cat.name}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="text-xs font-black text-gray-400 uppercase tracking-wider px-2">
              企采专区保障
            </div>
            <div className="bg-blue-50/60 rounded-2xl p-2.5 text-[11px] space-y-2 border border-blue-100">
              <div className="flex items-center gap-2 text-[#143A8F] font-bold">
                <ShieldCheck className="w-4 h-4 text-[#1F5EFF]" />
                <span>100% 正品开票</span>
              </div>
              <div className="flex items-center gap-2 text-[#143A8F] font-bold">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>企采统仓极速直邮</span>
              </div>
              <div className="flex items-center gap-2 text-[#143A8F] font-bold">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span>福利卡/餐卡全额冲抵</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nearby Services Entry */}
        <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200 space-y-1.5">
          <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-600" />
            <span>园区本地生活服务</span>
          </div>
          <p className="text-[10px] text-amber-800 leading-snug">
            扫码即享园区食堂、咖啡洗车、高德打车企业月结。
          </p>
          <button
            onClick={() => triggerPendingFeature('平板园区服务地图', '加载高德 SDK 园区合作商户与餐卡核销点。')}
            className="w-full bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold text-[11px] py-1.5 rounded-xl transition-colors cursor-pointer min-h-[36px]"
          >
            查看附近核销点
          </button>
        </div>
      </div>

      {/* MIDDLE PANE: Search, Banner, 4-Column Grid (flex-1) */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Search Bar & Scanner */}
        <div className="bg-white rounded-2xl p-2.5 shadow-2xs border border-gray-200 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索企业福利商品、电子礼券、办公设备..."
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="w-full text-xs font-medium outline-none bg-transparent"
            />
          </div>
          <button
            onClick={() => triggerPendingFeature('平板扫码核销', '调起硬件或后置摄像头扫描商品条形码。')}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer min-h-[40px]"
          >
            <Scan className="w-4 h-4 text-[#1F5EFF]" />
            <span>扫码购</span>
          </button>
        </div>

        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-[#143A8F] via-[#1F5EFF] to-blue-600 rounded-3xl p-5 text-white shadow-md relative overflow-hidden flex items-center justify-between">
          <div className="space-y-2 z-10 max-w-[70%]">
            <div className="inline-flex items-center gap-1.5 bg-amber-400 text-gray-900 text-[10px] font-black px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span>TABLET COMMERCE UI · 智慧翼企业福利</span>
            </div>
            <h1 className="text-xl font-black leading-tight">
              中国建筑大厦 员工福利专享月
            </h1>
            <p className="text-xs text-blue-100">
              企采直发、福利卡全额扣减、支持开具电子发票与专票。
            </p>
          </div>
          <div className="flex items-center gap-2 z-10">
            <button
              onClick={() => setTabletPage('category')}
              className="bg-white text-[#143A8F] hover:bg-yellow-300 font-bold text-xs px-4 py-2.5 rounded-2xl shadow-sm transition-colors cursor-pointer min-h-[44px]"
            >
              浏览全部分类
            </button>
          </div>
        </div>

        {/* 4-Column Product Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-sm text-gray-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>推荐福利商品 ({filteredProducts.length})</span>
            </h2>
            <span className="text-xs text-gray-400 font-medium">双击卡片快速加入</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onClick={() => setTabletPage('detail', p.id)}
                className="bg-white rounded-2xl p-3 border border-gray-100 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between cursor-pointer space-y-2 group"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 relative">
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  {p.enterpriseSubsidyAmount > 0 && (
                    <span className="absolute top-1.5 left-1.5 bg-[#E5484D] text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                      企采立省 ¥{p.enterpriseSubsidyAmount}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug">
                    {p.title}
                  </div>
                  <div className="flex items-baseline gap-1 font-mono text-xs">
                    <span className="text-[#E5484D] font-extrabold">¥{p.price}</span>
                    <span className="text-[10px] text-gray-400 line-through">¥{p.originalPrice}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(p, 1);
                  }}
                  className="w-full bg-blue-50 hover:bg-[#1F5EFF] hover:text-white text-[#1F5EFF] font-bold text-xs py-2 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer min-h-[40px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>加入购物车</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANE: Employee Info, Balances, Orders, Cart Summary (~280px) */}
      <div className="w-72 bg-white border-l border-gray-200 p-3.5 flex flex-col justify-between overflow-y-auto shrink-0 space-y-4 shadow-2xs">
        {/* User Card */}
        <div className="bg-gradient-to-br from-[#143A8F] to-[#1F5EFF] text-white rounded-2xl p-3.5 shadow-sm space-y-2">
          <div className="flex items-center gap-3">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-11 h-11 rounded-2xl object-cover border-2 border-white/80 flex-shrink-0"
            />
            <div className="overflow-hidden space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm">{user.name}</span>
                <span className="bg-amber-400 text-gray-900 text-[8px] font-extrabold px-1.5 py-0.2 rounded">
                  {user.jobTitle}
                </span>
              </div>
              <div className="text-[10px] text-blue-100 truncate">{user.enterpriseName}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20">
            <div
              onClick={() => triggerPendingFeature('平板福利卡充值与扣费记录', '调起福利卡账户详情')}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-xl cursor-pointer"
            >
              <div className="text-[9px] text-blue-200 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-yellow-300" />
                <span>福利卡余额</span>
              </div>
              <div className="text-sm font-black font-mono text-yellow-300 mt-0.5">
                ¥{user.welfareBalance.toFixed(0)}
              </div>
            </div>

            <div
              onClick={() => triggerPendingFeature('平板餐卡记录', '调起餐卡详情')}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-xl cursor-pointer"
            >
              <div className="text-[9px] text-blue-200 flex items-center gap-1">
                <Utensils className="w-3 h-3 text-amber-300" />
                <span>餐卡余额</span>
              </div>
              <div className="text-sm font-black font-mono text-amber-300 mt-0.5">
                ¥{user.mealBalance.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Orders Status */}
        <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-900">企采订单流程</span>
            <button
              onClick={() => setTabletPage('orders')}
              className="text-[10px] text-[#1F5EFF] hover:underline font-bold"
            >
              全部订单 &gt;
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
            <div
              onClick={() => setTabletPage('orders')}
              className="p-1.5 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-blue-50"
            >
              <Clock className="w-4 h-4 text-blue-600 mx-auto" />
              <span className="text-gray-600 mt-1 block">待付款 (1)</span>
            </div>
            <div
              onClick={() => setTabletPage('orders')}
              className="p-1.5 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-blue-50"
            >
              <Truck className="w-4 h-4 text-amber-600 mx-auto" />
              <span className="text-gray-600 mt-1 block">待发货 (2)</span>
            </div>
            <div
              onClick={() => setTabletPage('orders')}
              className="p-1.5 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-blue-50"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" />
              <span className="text-gray-600 mt-1 block">已完成</span>
            </div>
          </div>
        </div>

        {/* Persistent Cart Summary List */}
        <div className="flex-1 flex flex-col justify-between bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-[#1F5EFF]" />
              <span>当前购物车</span>
            </span>
            <span className="text-[10px] text-gray-400 font-mono">共 {cartCount} 件</span>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              购物车暂无福利商品
            </div>
          ) : (
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs gap-2 border-b border-gray-50 pb-1.5">
                  <div className="truncate flex-1">
                    <div className="font-bold text-gray-800 truncate">{item.product.title}</div>
                    <div className="text-[10px] text-gray-400">数量: x{item.quantity}</div>
                  </div>
                  <div className="font-mono font-bold text-[#E5484D] text-right">
                    ¥{(item.product.priceMall * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">应付小计</span>
              <span className="text-base font-black font-mono text-[#E5484D]">
                ¥{cartTotal.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => setTabletPage('cart')}
              disabled={cartCount === 0}
              className={`w-full font-bold text-xs py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
                cartCount > 0
                  ? 'bg-gradient-to-r from-[#1F5EFF] to-[#143A8F] text-white hover:opacity-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span>快速福利结算</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
