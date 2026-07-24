/**
 * 智慧翼企业福利商城 - 确认订单页 CheckoutPage screen
 * 处理配送地址、发票抬头发起、福利卡/餐卡精准扣费、微信补差模拟与订单提交拆单
 * 技术服务方：雍彻科技
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useMall } from '../context/MallContext';
import { mallService } from '../services/mallService';
import { productionApi, ProductionApiError } from '../services/productionApi';
import { DeliveryAddress } from '../types';
import { calculatePaymentAllocation } from '../utils/finance';
import {
  MapPin,
  Plus,
  CreditCard,
  Utensils,
  Building2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    user,
    addresses,
    addAddress,
    navigateTo,
    refreshUserData,
    showToast,
    sessionStatus,
    refreshProductionData,
    removeCartItem
  } = useMall();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItems = useMemo(() => cart.filter(i => i.selected), [cart]);

  // Address state
  const [selectedAddrId, setSelectedAddrId] = useState<string>(
    addresses.find(a => a.isDefault)?.id || addresses[0]?.id || ''
  );
  const [showAddAddrModal, setShowAddAddrModal] = useState(false);
  const [newAddrForm, setNewAddrForm] = useState({
    name: user.name,
    phone: '13812349281',
    province: '北京市',
    city: '北京市',
    district: '西城区',
    detail: '',
    isDefault: false,
    tag: '公司'
  });

  // Calculate Total Order Amount
  const totalGoodsAmount = useMemo(() => {
    return selectedItems.reduce((sum, i) => sum + i.product.priceWelfare * i.quantity, 0);
  }, [selectedItems]);

  // Payment deduction state
  const [useWelfare, setUseWelfare] = useState(true);
  const [welfareInput, setWelfareInput] = useState<number>(() =>
    Math.min(totalGoodsAmount, user.welfareBalance)
  );

  const effectiveWelfareInput = useWelfare
    ? Math.min(totalGoodsAmount, user.welfareBalance, Math.max(0, welfareInput))
    : 0;
  const remAfterWelfare = Math.max(0, totalGoodsAmount - effectiveWelfareInput);

  const [useMeal, setUseMeal] = useState(true);
  const [mealInput, setMealInput] = useState<number>(() =>
    Math.min(remAfterWelfare, user.mealBalance)
  );

  useEffect(() => {
    setMealInput(previous => Math.min(previous, remAfterWelfare, user.mealBalance));
  }, [remAfterWelfare, user.mealBalance]);

  const paymentAllocation = calculatePaymentAllocation(
    totalGoodsAmount,
    effectiveWelfareInput,
    useMeal ? mealInput : 0,
    user.welfareBalance,
    user.mealBalance
  );
  const finalWechatTopUp = paymentAllocation.external;

  // Invoice state
  const [invoiceType, setInvoiceType] = useState<'none' | 'personal' | 'company'>('company');
  const [invoiceTitle, setInvoiceTitle] = useState(user.enterpriseName);
  const [invoiceTaxNo, setInvoiceTaxNo] = useState('91110000100011889X');

  // User Remark
  const [userRemark, setUserRemark] = useState('');

  // Grouped items by supplier for order split preview
  const groupedItems = useMemo(() => {
    const map = new Map<string, typeof selectedItems>();
    selectedItems.forEach(i => {
      const k = i.product.supplierName;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    });
    return Array.from(map.entries());
  }, [selectedItems]);

  const handleAddNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrForm.detail) {
      showToast('请填写详细收货地址', 'warning');
      return;
    }
    addAddress(newAddrForm);
    setShowAddAddrModal(false);
  };

  const handleSubmitOrder = async () => {
    const selectedAddr = addresses.find(a => a.id === selectedAddrId);
    if (!selectedAddr) {
      showToast('请选择有效的收货地址', 'warning');
      return;
    }

    if (sessionStatus !== 'authenticated') {
      showToast('请先点击页面顶部“登录MVP”，再提交测试订单', 'warning');
      return;
    }
    if (finalWechatTopUp > 0) {
      showToast('尚未接入真实微信支付，请将福利卡与餐卡调整为全额抵扣', 'warning');
      return;
    }
    if (selectedItems.some(item => !item.product.skuId)) {
      showToast('购物车存在旧版演示商品，请清空后从最新商品目录重新加入', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyRoot = crypto.randomUUID();
      const created = await productionApi.createOrder({
        items: selectedItems.map(item => ({
          skuId: item.product.skuId!,
          quantity: item.quantity
        })),
        recipient: {
          name: selectedAddr.name,
          mobile: selectedAddr.phone,
          province: selectedAddr.province,
          city: selectedAddr.city,
          district: selectedAddr.district,
          address: selectedAddr.detail
        }
      }, `order-${idempotencyRoot}`);
      await productionApi.payWithInternalAccounts(created.order.id, {
        welfareCents: Math.round(paymentAllocation.welfare * 100),
        mealCents: Math.round(paymentAllocation.meal * 100)
      }, `payment-${idempotencyRoot}`);
      selectedItems.forEach(item => removeCartItem(item.id));
      await refreshProductionData();
      showToast('订单已写入生产型数据库并完成福利账户支付', 'success');
      navigateTo('orders');
    } catch (error) {
      const message = error instanceof ProductionApiError
        ? error.message
        : '服务暂时不可用';
      showToast(`提交订单失败：${message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (selectedItems.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-12 text-center font-sans space-y-3">
        <h2 className="text-base font-bold text-gray-800">暂无已勾选的待结算商品</h2>
        <button
          onClick={() => navigateTo('cart')}
          className="bg-[#1F5EFF] text-white text-xs font-bold px-4 py-2 rounded"
        >
          返回购物车勾选商品
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-6 font-sans">
      <div className="font-bold text-lg text-gray-900 border-b border-gray-200 pb-3 flex items-center justify-between">
        <span>确认福利采购订单</span>
        <span className="text-xs font-normal text-gray-500">
          包含 {groupedItems.length} 个供应商直发子订单
        </span>
      </div>

      {/* 1. 收货地址选择器 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#1F5EFF]" />
            <span>选择收货地址 / 配送地点</span>
          </div>
          <button
            onClick={() => setShowAddAddrModal(true)}
            className="text-xs text-[#1F5EFF] font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> 新增收货地址
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {addresses.map(addr => {
            const isSelected = selectedAddrId === addr.id;
            return (
              <div
                key={addr.id}
                onClick={() => setSelectedAddrId(addr.id)}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#1F5EFF] bg-blue-50/60 ring-2 ring-blue-500/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-900">{addr.name} ({addr.phone})</span>
                  {addr.tag && (
                    <span className="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.2 rounded font-medium">
                      {addr.tag}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 leading-relaxed">
                  {addr.province}{addr.city}{addr.district}{addr.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 商品按供应商拆单清单预览 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
        <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
          订购商品与拆单明细
        </div>

        {groupedItems.map(([supplierName, items]) => (
          <div key={supplierName} className="border border-gray-200 rounded p-4 space-y-3 bg-gray-50/40">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 border-b border-gray-100 pb-2">
              <span className="bg-[#1F5EFF] text-white text-[10px] px-1.5 py-0.5 rounded">
                子订单
              </span>
              <span>{supplierName} 直发仓</span>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map(item => (
                <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <img src={item.product.images[0]} alt="" className="w-12 h-12 rounded object-cover border border-gray-200" />
                    <div>
                      <div className="font-bold text-gray-900">{item.product.title}</div>
                      <div className="text-gray-400 text-[11px]">
                        规格：{Object.entries(item.selectedSpec).map(([k,v])=>`${k}:${v}`).join(' ')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-gray-900">
                      ¥{item.product.priceWelfare.toFixed(2)} × {item.quantity}
                    </div>
                    <div className="text-[#FF7A00] font-bold">
                      ¥{(item.product.priceWelfare * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 3. 福利卡/餐卡与微信补差精准算式 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-4">
        <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#1F5EFF]" />
          <span>选择福利账户扣减与补差方式</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* 福利卡扣减 */}
          <div className="bg-[#EAF1FF] border border-blue-200 rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-blue-900">
                <input
                  type="checkbox"
                  checked={useWelfare}
                  onChange={e => setUseWelfare(e.target.checked)}
                  className="w-4 h-4 text-[#1F5EFF] rounded"
                />
                <span>使用福利卡余额抵扣</span>
              </label>
              <span className="text-blue-700 font-bold">
                个人可用余额: ¥{user.welfareBalance.toFixed(2)}
              </span>
            </div>

            {useWelfare && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-gray-600 font-medium">抵扣金额：¥</span>
                <input
                  type="number"
                  value={welfareInput}
                  onChange={e => setWelfareInput(Math.min(totalGoodsAmount, user.welfareBalance, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-32 bg-white border border-blue-300 rounded px-2 py-1 text-xs font-bold text-[#1F5EFF]"
                />
                <button
                  onClick={() => setWelfareInput(Math.min(totalGoodsAmount, user.welfareBalance))}
                  className="text-[11px] text-[#1F5EFF] underline font-bold"
                >
                  最大化使用
                </button>
              </div>
            )}
          </div>

          {/* 餐卡扣减 */}
          <div className="bg-orange-50 border border-orange-200 rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-orange-900">
                <input
                  type="checkbox"
                  checked={useMeal}
                  onChange={e => setUseMeal(e.target.checked)}
                  className="w-4 h-4 text-[#FF7A00] rounded"
                />
                <span>使用餐卡专享余额抵扣</span>
              </label>
              <span className="text-orange-700 font-bold">
                餐卡可用余额: ¥{user.mealBalance.toFixed(2)}
              </span>
            </div>

            {useMeal && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-gray-600 font-medium">抵扣金额：¥</span>
                <input
                  type="number"
                  value={mealInput}
                  onChange={e => setMealInput(Math.min(remAfterWelfare, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-32 bg-white border border-orange-300 rounded px-2 py-1 text-xs font-bold text-[#FF7A00]"
                />
                <button
                  onClick={() => setMealInput(Math.min(remAfterWelfare, user.mealBalance))}
                  className="text-[11px] text-[#FF7A00] underline font-bold"
                >
                  最大化使用
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 微信补差试算 */}
        {finalWechatTopUp > 0 ? (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded p-3 text-xs flex items-center justify-between">
            <span className="font-bold">
              福利卡与餐卡扣减后仍有差额，需要使用微信支付在线补差：
            </span>
            <span className="text-base font-black text-red-600">
              需补差金额：¥{finalWechatTopUp.toFixed(2)}
            </span>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 text-green-900 rounded p-3 text-xs flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>福利卡/餐卡余额充足，本次采购享受 100% 账户余额全额抵扣，无需额外掏钱！</span>
          </div>
        )}
      </div>

      {/* 4. 发票与备注 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        <div className="space-y-3">
          <div className="font-bold text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <FileText className="w-4 h-4 text-[#1F5EFF]" /> 发票开具选项
          </div>

          <div className="flex items-center gap-3">
            {[
              { id: 'company', label: '企业增值税发票' },
              { id: 'personal', label: '个人抬头' },
              { id: 'none', label: '暂不开票' }
            ].map(inv => (
              <label key={inv.id} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="invType"
                  checked={invoiceType === inv.id}
                  onChange={() => setInvoiceType(inv.id as any)}
                  className="text-[#1F5EFF]"
                />
                <span>{inv.label}</span>
              </label>
            ))}
          </div>

          {invoiceType === 'company' && (
            <div className="space-y-2 pt-1">
              <input
                type="text"
                placeholder="企业发票抬头"
                value={invoiceTitle}
                onChange={e => setInvoiceTitle(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 bg-gray-50 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="纳税人识别号"
                value={invoiceTaxNo}
                onChange={e => setInvoiceTaxNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 bg-gray-50 text-xs font-mono"
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="font-bold text-gray-900 border-b border-gray-100 pb-2">
            买家留言 / 订单特别说明
          </div>
          <textarea
            rows={3}
            value={userRemark}
            onChange={e => setUserRemark(e.target.value)}
            placeholder="填写对发货物流、卡券兑换或公司行政核销的特殊要求..."
            className="w-full border border-gray-300 rounded p-2 text-xs bg-gray-50 focus:outline-none"
          />
        </div>
      </div>

      {/* 5. 结算按钮与费用汇总 */}
      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="text-gray-500 space-y-1">
          <div>提交后将自动在后台扣减福利卡与餐卡，并生成子订单</div>
          <div className="text-blue-600 font-medium">
            技术服务保障方：雍彻科技 企业集采安全校验机制已开启
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right space-y-1">
            <div className="text-gray-600 font-bold">
              应付金额：<strong className="text-2xl font-black text-[#FF7A00]">¥{totalGoodsAmount.toFixed(2)}</strong>
            </div>
            <div className="text-[11px] text-gray-500">
              福利卡扣: ¥{(useWelfare ? welfareInput : 0).toFixed(2)} | 餐卡扣: ¥{(useMeal ? mealInput : 0).toFixed(2)} | 微信补: ¥{finalWechatTopUp.toFixed(2)}
            </div>
          </div>

          <button
            onClick={() => void handleSubmitOrder()}
            disabled={isSubmitting}
            className="bg-[#1F5EFF] disabled:bg-blue-300 hover:bg-blue-700 text-white font-black px-8 py-3 rounded text-sm shadow-md transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>{isSubmitting ? '正在安全提交…' : '立即提交订单'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal: 新增收货地址 */}
      {showAddAddrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-md p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-gray-900 border-b pb-2">新增个人/公司收货地址</h3>
            <form onSubmit={handleAddNewAddress} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 font-bold mb-1">收货人姓名</label>
                <input
                  type="text"
                  required
                  value={newAddrForm.name}
                  onChange={e => setNewAddrForm({ ...newAddrForm, name: e.target.value })}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-gray-600 font-bold mb-1">联系电话</label>
                <input
                  type="text"
                  required
                  value={newAddrForm.phone}
                  onChange={e => setNewAddrForm({ ...newAddrForm, phone: e.target.value })}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newAddrForm.province}
                  onChange={e => setNewAddrForm({ ...newAddrForm, province: e.target.value })}
                  className="border p-2 rounded"
                  placeholder="省"
                />
                <input
                  type="text"
                  value={newAddrForm.city}
                  onChange={e => setNewAddrForm({ ...newAddrForm, city: e.target.value })}
                  className="border p-2 rounded"
                  placeholder="市"
                />
                <input
                  type="text"
                  value={newAddrForm.district}
                  onChange={e => setNewAddrForm({ ...newAddrForm, district: e.target.value })}
                  className="border p-2 rounded"
                  placeholder="区"
                />
              </div>
              <div>
                <label className="block text-gray-600 font-bold mb-1">详细门牌地址</label>
                <input
                  type="text"
                  required
                  value={newAddrForm.detail}
                  onChange={e => setNewAddrForm({ ...newAddrForm, detail: e.target.value })}
                  placeholder="例如：金融大街1号大厦1208"
                  className="w-full border p-2 rounded"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAddrModal(false)}
                  className="px-4 py-1.5 border rounded text-gray-600"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1F5EFF] text-white font-bold rounded"
                >
                  保存地址
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
