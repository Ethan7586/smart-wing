/**
 * 智慧翼企业福利商城 - 商品详情页 ProductDetailPage screen
 * 包含图片画廊、福利价格算式、规格数量选择、四大Tab (详情/参数/评价/售后) 与推荐商品
 * 技术服务方：雍彻科技
 */

import React, { useState } from 'react';
import { useMall } from '../context/MallContext';
import { mallService } from '../services/mallService';
import { ProductCard } from '../components/common/ProductCard';
import {
  ShoppingCart,
  Heart,
  Truck,
  ShieldCheck,
  CreditCard,
  Utensils,
  ChevronRight,
  Building2,
  Check,
  Star,
  MessageSquare,
  FileText,
  MapPin,
  Store
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const { routeParams, navigateTo, addToCart, user, addresses, favorites, toggleFavorite, showToast, currentMall } = useMall();

  const productId = routeParams.productId || 'p_101';
  const product = mallService.getProductById(productId) || mallService.getProducts()[0];

  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (product.specs) {
      product.specs.forEach(s => {
        initial[s.name] = s.options[0];
      });
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'detail' | 'params' | 'reviews' | 'aftersale'>('detail');
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || 'addr_01');

  const isFav = favorites.includes(product.id);

  // Similar products
  const similarProducts = mallService
    .getProducts({ categoryId: product.categoryId })
    .filter(p => p.id !== product.id)
    .slice(0, 5);

  const handleBuyNow = () => {
    addToCart(product, quantity, selectedSpecs);
    navigateTo('checkout');
  };

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedSpecs);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-6 font-sans">
      {/* 1. 面包屑导航 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <button onClick={() => navigateTo('home')} className="hover:text-[#1F5EFF]">
          首页
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <button
          onClick={() => navigateTo('category', { categoryId: product.categoryId })}
          className="hover:text-[#1F5EFF]"
        >
          {product.categoryName}
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="font-semibold text-gray-900 truncate max-w-xs">{product.title}</span>
      </div>

      {/* 2. 商品主图与核心购买区 */}
      <div className="bg-white border border-gray-200 rounded-md p-6 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* 左侧：画廊展示 (Col 5) */}
        <div className="col-span-12 md:col-span-5 space-y-3">
          <div className="aspect-square bg-gray-50 rounded-md overflow-hidden border border-gray-200 relative">
            <img
              src={product.images[selectedImgIndex] || product.images[0]}
              alt={product.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 bg-[#1F5EFF] text-white text-xs font-bold px-2 py-0.5 rounded shadow-xs">
              {product.supplierName}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImgIndex(idx)}
                className={`w-16 h-16 rounded border-2 overflow-hidden flex-shrink-0 cursor-pointer transition-all ${
                  selectedImgIndex === idx ? 'border-[#1F5EFF]' : 'border-gray-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* 右侧：商品详情与福利结算控制 (Col 7) */}
        <div className="col-span-12 md:col-span-7 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[#143A8F] text-white text-xs font-bold px-2 py-0.5 rounded">
                {product.brand}
              </span>
              <span className="text-xs text-gray-500">累计销量 {product.salesCount} 件</span>
              <span className="text-xs text-amber-500 font-bold flex items-center gap-0.5 ml-auto">
                <Star className="w-3.5 h-3.5 fill-current" /> {product.rating} ({product.reviewCount}条好评)
              </span>
            </div>

            <h1 className="text-lg font-black text-gray-900 leading-snug">
              {product.title}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{product.subtitle}</p>

            {/* 福利补贴算式卡片 */}
            <div className="bg-[#EAF1FF] border border-blue-200 rounded-md p-4 mt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-[#FF7A00] font-bold">企业福利专享价：</span>
                  <span className="text-3xl font-black text-[#FF7A00] ml-1">
                    ¥{product.priceWelfare.toFixed(2)}
                  </span>
                </div>
                <div className="text-right text-xs text-gray-500 space-y-0.5">
                  <div>市场划线价: <span className="line-through">¥{product.priceMarket.toFixed(2)}</span></div>
                  <div>商城日常价: ¥{product.priceMall.toFixed(2)}</div>
                </div>
              </div>

              {/* Welfare Accounts Notice */}
              <div className="pt-2 border-t border-blue-200/60 flex items-center gap-3 text-xs text-blue-900">
                <span className="font-bold flex-shrink-0">可用福利：</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {product.allowedAccounts.includes('welfare') && (
                    <span className="bg-white border border-blue-300 text-[#1F5EFF] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                      <CreditCard className="w-3.5 h-3.5" />
                      福利卡全额/混合抵扣 (余额: ¥{user.welfareBalance.toFixed(2)})
                    </span>
                  )}
                  {product.allowedAccounts.includes('meal') && (
                    <span className="bg-white border border-orange-300 text-[#FF7A00] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                      <Utensils className="w-3.5 h-3.5" />
                      餐卡可用 (余额: ¥{user.mealBalance.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 配送地址与库存 SLA */}
            <div className="mt-4 text-xs space-y-2 border-t border-b border-gray-100 py-3">
              <div className="flex items-center gap-3 text-gray-700">
                <span className="w-20 text-gray-500 font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  配送至：
                </span>
                <select
                  value={selectedAddressId}
                  onChange={e => setSelectedAddressId(e.target.value)}
                  className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none max-w-md"
                >
                  {addresses.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.province}{a.city}{a.district}{a.detail} ({a.name} 收)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 text-gray-700">
                <span className="w-20 text-gray-500 font-bold flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-green-600" />
                  履约服务：
                </span>
                <span className="font-bold text-gray-900">{product.deliverySla}</span>
                <span className="text-gray-400">|</span>
                <span className="text-green-700 font-semibold">
                  {product.stock > 0 ? `现货 (库存 ${product.stock} 件)` : '需调拨发货'}
                </span>
              </div>

              {product.nearbyStoreInfo && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900 mt-2">
                  <div className="font-bold flex items-center gap-1">
                    <Store className="w-4 h-4 text-amber-600" /> 核销门店：{product.nearbyStoreInfo.storeName}
                  </div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    地址：{product.nearbyStoreInfo.address} (距您{product.nearbyStoreInfo.distance}) · 营业时间：{product.nearbyStoreInfo.businessHours}
                  </div>
                </div>
              )}
            </div>

            {/* 规格选择 */}
            {product.specs && product.specs.length > 0 && (
              <div className="mt-4 space-y-3">
                {product.specs.map(spec => (
                  <div key={spec.name} className="flex items-start gap-3 text-xs">
                    <span className="w-20 text-gray-500 font-bold pt-1">{spec.name}：</span>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {spec.options.map(opt => {
                        const isSelected = selectedSpecs[spec.name] === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => setSelectedSpecs(prev => ({ ...prev, [spec.name]: opt }))}
                            className={`px-3 py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50 border-[#1F5EFF] text-[#1F5EFF] font-bold shadow-2xs'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 数量选择器 */}
            <div className="mt-4 flex items-center gap-3 text-xs">
              <span className="w-20 text-gray-500 font-bold">采购数量：</span>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 font-bold"
                >
                  -
                </button>
                <span className="px-4 py-1 font-bold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 font-bold"
                >
                  +
                </button>
              </div>
              <span className="text-gray-400">
                (小计金额：<strong className="text-[#FF7A00]">¥{(product.priceWelfare * quantity).toFixed(2)}</strong>)
              </span>
            </div>
          </div>

          {/* 底部购买与加购按钮 */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleAddToCart}
              className="flex-1 bg-blue-50 hover:bg-blue-100 text-[#1F5EFF] border border-blue-300 font-black py-3 rounded text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              加入购物车
            </button>

            <button
              onClick={handleBuyNow}
              className="flex-1 bg-[#1F5EFF] hover:bg-blue-700 text-white font-black py-3 rounded text-sm transition-colors cursor-pointer shadow-md"
            >
              立即兑换 / 确认提交
            </button>

            <button
              onClick={() => toggleFavorite(product.id)}
              className={`p-3 rounded border transition-colors cursor-pointer ${
                isFav ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
              title={isFav ? '已收藏' : '加入收藏'}
            >
              <Heart className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. 详情四大 Tab 选项卡 */}
      <div className="bg-white border border-gray-200 rounded-md shadow-xs overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50 text-xs font-bold text-gray-700">
          {[
            { id: 'detail', label: '商品详情与介绍', icon: FileText },
            { id: 'params', label: '规格参数', icon: Building2 },
            { id: 'reviews', label: `累计评价 (${product.reviewCount})`, icon: MessageSquare },
            { id: 'aftersale', label: '国企售后与履约承诺', icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 cursor-pointer transition-colors ${
                  isActive
                    ? 'border-[#1F5EFF] bg-white text-[#1F5EFF]'
                    : 'border-transparent text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6 text-xs text-gray-800 leading-relaxed">
          {activeTab === 'detail' && (
            <div className="space-y-6">
              <div className="bg-blue-50/50 p-4 rounded border border-blue-100 text-gray-700">
                <h4 className="font-bold text-gray-900 mb-1">【{currentMall.enterpriseName} 福利采购选品说明】</h4>
                <p>
                  本商品已通过央企/国企商品合规集采认证，正品保证。使用福利卡或餐卡付款享受官方协议价，并开具对公增值税发票。
                </p>
              </div>

              {product.descriptionDetailText && (
                <div className="space-y-3 text-sm">
                  {product.descriptionDetailText.map((p, i) => (
                    <p key={i} className="text-gray-700">
                      {p}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-4 pt-4">
                <div className="font-bold text-sm text-gray-900 border-l-4 border-[#1F5EFF] pl-2">
                  实物图赏与包装细节
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {product.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt=""
                      className="w-full rounded border border-gray-200 object-cover"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'params' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-gray-900 border-l-4 border-[#1F5EFF] pl-2">
                详细规格参数清单
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 bg-gray-50 p-4 rounded border border-gray-200">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">商品名称</span>
                  <span className="font-medium text-gray-900">{product.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">所属品牌</span>
                  <span className="font-medium text-gray-900">{product.brand}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">供应渠道</span>
                  <span className="font-medium text-gray-900">{product.supplierName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">履约时效</span>
                  <span className="font-medium text-gray-900">{product.deliverySla}</span>
                </div>

                {product.params &&
                  product.params.map((pm, i) => (
                    <div key={i} className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-500">{pm.key}</span>
                      <span className="font-medium text-gray-900">{pm.value}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center gap-6 bg-gray-50 p-4 rounded border border-gray-200">
                <div className="text-center border-r border-gray-200 pr-6">
                  <div className="text-3xl font-black text-[#FF7A00]">{product.rating}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">综合满意度</div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-gray-800">99.8% 的员工推荐此商品</div>
                  <div className="text-gray-500 text-xs">“发货迅速，质量好，福利卡抵扣顺畅。”</div>
                </div>
              </div>

              {/* Sample Reviews */}
              <div className="divide-y divide-gray-100">
                {[
                  { name: '李*平 (国家电网员工)', date: '2026-07-20', text: '福利卡直接全额抵扣，第二天就顺丰寄到了，品质非常高，感谢单位好福利！', star: 5 },
                  { name: '王* (中航工业员工)', date: '2026-07-18', text: '包装完好无损，正品验货没问题，餐卡余额正好花掉，物超所值。', star: 5 }
                ].map((rev, i) => (
                  <div key={i} className="py-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800">{rev.name}</span>
                      <span className="text-gray-400">{rev.date}</span>
                    </div>
                    <div className="flex text-amber-400">
                      {Array.from({ length: rev.star }).map((_, s) => (
                        <Star key={s} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <p className="text-gray-700">{rev.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'aftersale' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-gray-900 border-l-4 border-[#1F5EFF] pl-2">
                国企采买售后服务保障
              </h4>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                <li><strong>开具正规发票：</strong>订单完成后可在线申请开具增值税普通/专用发票，支持个人与企业抬头。</li>
                <li><strong>无忧退换：</strong>7天无理由退换货（虚拟卡券及已核销商品除外）。</li>
                <li><strong>福利余额原路退回：</strong>若发生退款，福利卡或餐卡扣减部分将原路实时退回您的个人账户。</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 4. 相似商品推荐 */}
      {similarProducts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
          <div className="font-bold text-base text-gray-900 border-b border-gray-100 pb-2">
            同类福利选购推荐
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {similarProducts.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
