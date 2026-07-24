/**
 * 智慧翼企业福利商城 - 商城首页 HomePage screen
 * 12列栅格高密度设计，包含轮播图、用户福利卡片、快捷入口与10大运营特色模块
 * 技术服务方：雍彻科技
 */

import React, { useState } from 'react';
import { useMall } from '../context/MallContext';
import { CategoryMegaMenu } from '../components/common/CategoryMegaMenu';
import { ProductCard } from '../components/common/ProductCard';
import {
  CreditCard,
  Utensils,
  Ticket,
  ShoppingBag,
  Zap,
  Store,
  Sparkles,
  Gift,
  Building2,
  ChevronRight,
  Flame,
  Award,
  Truck,
  ArrowRight,
  User,
  Clock,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { user, currentMall, navigateTo, orders, products } = useMall();
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  const banners = [
    {
      id: 1,
      title: `${currentMall.enterpriseName} 专享补贴专场`,
      subtitle: '2026年二季度员工关怀特惠，福利卡与餐卡通兑尊享折上折',
      bgColor: 'from-[#143A8F] via-[#1F5EFF] to-blue-900',
      badge: '央企国企福利专享',
      btnText: '立即选购特惠商品'
    },
    {
      id: 2,
      title: '电影娱乐与影城全国通兑季',
      subtitle: '猫眼/万达/博纳全国通兑，电子发码即时生效，餐卡全额抵扣',
      bgColor: 'from-amber-700 via-orange-600 to-red-800',
      badge: '员工文化休闲',
      btnText: '兑换电影票'
    },
    {
      id: 3,
      title: '品牌商超与星巴克卡包特惠',
      subtitle: '盒马鲜生、永辉超市、星巴克100元电子卡包即时到账',
      bgColor: 'from-emerald-800 via-teal-700 to-blue-900',
      badge: '便利卡包首选',
      btnText: '查看商超卡包'
    }
  ];

  // Pending orders for user quick card
  const pendingCount = orders.filter(o => o.status === 'pending_shipment' || o.status === 'pending_receipt').length;
  const afterSaleCount = orders.filter(o => o.status === 'after_sale').length;

  // Filter products for various sections
  const enterpriseExclusives = products.filter(p => p.isEnterpriseExclusive).slice(0, 5);
  const dailySpecials = products.filter(p => p.isDailySpecial || p.priceMarket - p.priceWelfare > 50).slice(0, 5);
  const hotRedeems = products.filter(p => p.isHotRedeem || p.stock > 0).slice(0, 5);
  const movieTickets = products.filter(p => p.itemType === 'movie_ticket').slice(0, 4);
  const virtualCoupons = products.filter(p => p.itemType === 'virtual_coupon').slice(0, 4);
  const nearbyStores = products.filter(p => p.itemType === 'nearby_store' || p.itemType === 'life_service').slice(0, 4);
  const foodGrains = products.filter(p => p.categoryId === 'cat_food').slice(0, 5);
  const appliances = products.filter(p => p.categoryId === 'cat_appliance' || p.categoryId === 'cat_digital').slice(0, 5);

  return (
    <div className="space-y-8 pb-8 font-sans">
      {/* 首屏：分类菜单 + 活动轮播图 + 用户福利账户卡片 */}
      <div className="max-w-[1280px] mx-auto px-4 pt-4 grid grid-cols-12 gap-4">
        {/* 左侧：多级分类菜单 (Col 3) */}
        <div className="hidden lg:block lg:col-span-3">
          <CategoryMegaMenu isAlwaysOpen={true} />
        </div>

        {/* 中间：活动轮播图与公告栏 (Col 6) */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
          <div className="relative rounded-md overflow-hidden shadow-md aspect-[16/8] bg-gray-900 group">
            <div
              className={`w-full h-full bg-gradient-to-r ${banners[activeBannerIndex].bgColor} p-8 text-white flex flex-col justify-between transition-all duration-500`}
            >
              <div>
                <span className="inline-block bg-white/20 backdrop-blur-xs text-yellow-300 text-xs px-2.5 py-1 rounded-full font-bold mb-3 border border-white/20">
                  {banners[activeBannerIndex].badge}
                </span>
                <h1 className="text-2xl font-black leading-tight tracking-tight drop-shadow-sm">
                  {banners[activeBannerIndex].title}
                </h1>
                <p className="text-xs text-blue-100 mt-2 line-clamp-2 max-w-md">
                  {banners[activeBannerIndex].subtitle}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  onClick={() => navigateTo('category', { categoryId: 'cat_welfare_zone' })}
                  className="bg-white text-[#143A8F] hover:bg-yellow-300 font-bold text-xs px-5 py-2.5 rounded transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{banners[activeBannerIndex].btnText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveBannerIndex(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        activeBannerIndex === idx ? 'w-6 bg-yellow-300' : 'w-2 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Slider controls */}
            <button
              onClick={() => setActiveBannerIndex((activeBannerIndex - 1 + banners.length) % banners.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveBannerIndex((activeBannerIndex + 1) % banners.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 实时动态与企业通知跑马灯 */}
          <div className="bg-[#EAF1FF] border border-blue-200 rounded-md p-3 flex items-center justify-between text-xs text-blue-900 shadow-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="bg-[#1F5EFF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                福利快讯
              </span>
              <span className="truncate font-medium">
                {currentMall.welcomeBanner}
              </span>
            </div>
            <button
              onClick={() => navigateTo('balance')}
              className="text-[#1F5EFF] font-bold hover:underline flex-shrink-0 ml-2"
            >
              查看我的补贴 &gt;
            </button>
          </div>
        </div>

        {/* 右侧：用户福利账户卡片 (Col 3) */}
        <div className="col-span-12 lg:col-span-3 bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            {/* 用户身份 header */}
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-100 shadow-xs"
              />
              <div className="overflow-hidden">
                <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  <span>{user.name}</span>
                  <span className="bg-[#143A8F] text-white text-[10px] px-1.5 py-0.2 rounded font-normal">
                    {user.jobTitle}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 truncate mt-0.5">
                  {user.enterpriseName}
                </div>
              </div>
            </div>

            {/* 福利余额与餐卡卡片 */}
            <div className="space-y-2">
              <div
                onClick={() => navigateTo('balance', { accountTab: 'welfare' })}
                className="bg-gradient-to-r from-[#1F5EFF] to-blue-700 text-white p-3 rounded-md cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between text-xs opacity-90">
                  <span className="flex items-center gap-1 font-medium">
                    <CreditCard className="w-3.5 h-3.5" />
                    福利卡账户余额
                  </span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">明细 &gt;</span>
                </div>
                <div className="text-xl font-black mt-1 font-mono">
                  ¥{user.welfareBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div
                onClick={() => navigateTo('balance', { accountTab: 'meal' })}
                className="bg-gradient-to-r from-[#FF7A00] to-amber-600 text-white p-3 rounded-md cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between text-xs opacity-90">
                  <span className="flex items-center gap-1 font-medium">
                    <Utensils className="w-3.5 h-3.5" />
                    餐卡专享余额
                  </span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">明细 &gt;</span>
                </div>
                <div className="text-xl font-black mt-1 font-mono">
                  ¥{user.mealBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* 订单状态快捷入口 */}
            <div className="grid grid-cols-4 gap-1 text-center pt-2 text-xs border-t border-gray-100">
              <button
                onClick={() => navigateTo('orders', { statusFilter: 'pending_payment' })}
                className="p-1.5 hover:bg-gray-50 rounded transition-colors cursor-pointer"
              >
                <div className="font-bold text-gray-800">0</div>
                <div className="text-[11px] text-gray-500 mt-0.5">待付款</div>
              </button>
              <button
                onClick={() => navigateTo('orders', { statusFilter: 'pending_shipment' })}
                className="p-1.5 hover:bg-gray-50 rounded transition-colors cursor-pointer relative"
              >
                <div className="font-bold text-blue-600">{pendingCount}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">待处理</div>
              </button>
              <button
                onClick={() => navigateTo('coupons')}
                className="p-1.5 hover:bg-gray-50 rounded transition-colors cursor-pointer"
              >
                <div className="font-bold text-orange-600">{user.couponCount}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">卡券包</div>
              </button>
              <button
                onClick={() => navigateTo('orders', { statusFilter: 'after_sale' })}
                className="p-1.5 hover:bg-gray-50 rounded transition-colors cursor-pointer"
              >
                <div className="font-bold text-gray-800">{afterSaleCount}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">售后记录</div>
              </button>
            </div>
          </div>

          <button
            onClick={() => navigateTo('user-center')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded text-xs transition-colors cursor-pointer text-center mt-3"
          >
            进入个人中心
          </button>
        </div>
      </div>

      {/* 福利快捷入口金刚区 (8大金刚位) */}
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-xs grid grid-cols-4 md:grid-cols-8 gap-4 text-center">
          {[
            { name: '福利卡专区', icon: CreditCard, color: 'text-blue-600 bg-blue-50', param: { categoryId: 'cat_welfare_zone' } },
            { name: '餐卡专区', icon: Utensils, color: 'text-orange-600 bg-orange-50', param: { categoryId: 'cat_food' } },
            { name: '电影票通兑', icon: Ticket, color: 'text-purple-600 bg-purple-50', param: { itemType: 'movie_ticket' as const } },
            { name: '商超卡包', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50', param: { itemType: 'supermarket' as const } },
            { name: '生活服务', icon: Zap, color: 'text-[#1F5EFF] bg-blue-50', param: { itemType: 'life_service' as const } },
            { name: '附近门店', icon: Store, color: 'text-amber-600 bg-amber-50', param: { itemType: 'nearby_store' as const } },
            { name: '虚拟会员', icon: Sparkles, color: 'text-indigo-600 bg-indigo-50', param: { itemType: 'virtual_coupon' as const } },
            { name: '企业专享礼包', icon: Gift, color: 'text-red-600 bg-red-50', param: { categoryId: 'cat_welfare_zone' } }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                onClick={() => navigateTo('category', item.param)}
                className="flex flex-col items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-transform duration-200 hover:-translate-y-1"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-gray-800">{item.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 模块 1：企业专享价 & 今日特惠双侧碰撞栏 */}
      <div className="max-w-[1280px] mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 企业专享价 */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#143A8F] text-white flex items-center justify-center font-bold text-xs">
                企
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">企业专享价专区</h2>
                <p className="text-[11px] text-gray-400">集团大客户采购协议价补贴</p>
              </div>
            </div>
            <button
              onClick={() => navigateTo('category', { categoryId: 'cat_welfare_zone' })}
              className="text-xs text-[#1F5EFF] font-semibold hover:underline flex items-center gap-0.5"
            >
              更多专享 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {enterpriseExclusives.slice(0, 2).map(p => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </div>

        {/* 今日特惠 */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#FF7A00] text-white flex items-center justify-center font-bold text-xs">
                惠
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">今日特惠限时限额</h2>
                <p className="text-[11px] text-gray-400">福利卡全额抵扣 · 限时补贴</p>
              </div>
            </div>
            <button
              onClick={() => navigateTo('category')}
              className="text-xs text-[#FF7A00] font-semibold hover:underline flex items-center gap-0.5"
            >
              抢购更多 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {dailySpecials.slice(0, 2).map(p => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </div>
      </div>

      {/* 模块 2：热门兑换 (Hot Redeem Grid - 5 列高密度) */}
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              <h2 className="text-base font-black text-gray-900">热门兑换榜</h2>
              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">
                集团员工兑换热度 TOP
              </span>
            </div>
            <button
              onClick={() => navigateTo('category')}
              className="text-xs text-gray-500 hover:text-[#1F5EFF] flex items-center gap-0.5"
            >
              查看完整热榜 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {hotRedeems.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>

      {/* 模块 3：电影娱乐 & 虚拟卡券 */}
      <div className="max-w-[1280px] mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 电影娱乐 */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">电影影音专区</h2>
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">
                猫眼/淘票票/万达通兑
              </span>
            </div>
            <button
              onClick={() => navigateTo('category', { itemType: 'movie_ticket' })}
              className="text-xs text-purple-600 font-semibold hover:underline"
            >
              全部影票 &gt;
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {movieTickets.map(p => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </div>

        {/* 虚拟卡券包 */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">虚拟卡券与星巴克卡包</h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
                即时发码免运费
              </span>
            </div>
            <button
              onClick={() => navigateTo('category', { itemType: 'virtual_coupon' })}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              全部卡券 &gt;
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {virtualCoupons.map(p => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </div>
      </div>

      {/* 模块 4：附近门店与生活服务 (核销场景) */}
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[#1F5EFF]" />
              <h2 className="text-base font-bold text-gray-900">附近门店与本地服务 (凭码核销)</h2>
              <span className="text-xs bg-blue-50 text-[#1F5EFF] px-2 py-0.5 rounded font-medium">
                烘焙甜品 · 精致洗车 · 3小时保洁 · 健身房
              </span>
            </div>
            <button
              onClick={() => navigateTo('category', { itemType: 'nearby_store' })}
              className="text-xs text-[#1F5EFF] font-semibold hover:underline"
            >
              查看附近服务 &gt;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {nearbyStores.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>

      {/* 模块 5：米面粮油 & 品牌大采 */}
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-gray-900">米面粮油与劳保关怀</h2>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                有机五常米 · 橄榄油 · 坚果大礼包
              </span>
            </div>
            <button
              onClick={() => navigateTo('category', { categoryId: 'cat_food' })}
              className="text-xs text-emerald-600 font-semibold hover:underline"
            >
              进入粮油馆 &gt;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {foodGrains.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>

      {/* 模块 6：数码家电 (Digital & Appliances) */}
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">数码家电与智能办公</h2>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                戴森 · 罗技 · 索尼 · 飞利浦联保正品
              </span>
            </div>
            <button
              onClick={() => navigateTo('category', { categoryId: 'cat_appliance' })}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              全部家电 &gt;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {appliances.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
