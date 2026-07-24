import React from 'react';
import { ChevronRight, CreditCard, Flame, ShoppingBag, Store, Ticket, Zap } from 'lucide-react';
import { useMall } from '../../context/MallContext';
import { ProductCard } from '../common/ProductCard';

export const HomeProductSections: React.FC = () => {
  const { navigateTo, products } = useMall();
  const enterpriseExclusives = products.filter(p => p.isEnterpriseExclusive).slice(0, 5);
  const dailySpecials = products.filter(p => p.isDailySpecial || p.priceMarket - p.priceWelfare > 50).slice(0, 5);
  const hotRedeems = products.filter(p => p.isHotRedeem || p.stock > 0).slice(0, 5);
  const movieTickets = products.filter(p => p.itemType === 'movie_ticket').slice(0, 4);
  const virtualCoupons = products.filter(p => p.itemType === 'virtual_coupon').slice(0, 4);
  const nearbyStores = products.filter(p => p.itemType === 'nearby_store' || p.itemType === 'life_service').slice(0, 4);
  const foodGrains = products.filter(p => p.categoryId === 'cat_food').slice(0, 5);
  const appliances = products.filter(p => p.categoryId === 'cat_appliance' || p.categoryId === 'cat_digital').slice(0, 5);
  return (
    <>
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

    </>
  );
};
