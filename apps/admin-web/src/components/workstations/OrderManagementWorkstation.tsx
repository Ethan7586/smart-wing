import React, { useState } from 'react';
import { refuseDemoDataWrite } from '../../services/writeAvailability';
import type { Order } from '../../types';
import { orderStatusLabel } from '@smart-wing/api-contract';
import { executeAfterSaleRefund, type AfterSaleListItem, type OrderListItem } from '../../services/orders';
import { OrderFulfillmentWorkstation } from './OrderFulfillmentWorkstation';
import { AfterSaleListPanel } from './order/AfterSaleListPanel';
import { OrderListPanel } from './order/OrderListPanel';
import { PlanOrderPanel } from './order/PlanOrderPanel';

type ManagementTab = 'orders' | 'afterSales' | 'exceptions' | 'plans' | 'fulfillment';

interface OrderManagementWorkstationProps {
  orders: Order[];
  onUpdateOrders: (updatedOrders: Order[]) => void;
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string, evidence: string) => void) => void;
  initialProblemType?: string;
  isLiveOrders?: boolean;
  onShipOrder?: (orderId: string) => Promise<void>;
  sessionPermissions: string[];
}

const TABS: Array<{ id: ManagementTab; label: string }> = [
  { id: 'orders', label: '商品订单' },
  { id: 'afterSales', label: '售后订单' },
  { id: 'exceptions', label: '异常订单' },
  { id: 'plans', label: '下单计划订单' },
  { id: 'fulfillment', label: '订单履约台' },
];

export function OrderManagementWorkstation({ orders, onUpdateOrders, onOpenGuardrail, initialProblemType, isLiveOrders = false, onShipOrder, sessionPermissions }: OrderManagementWorkstationProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>('orders');
  const [focusedOrderId, setFocusedOrderId] = useState<string | undefined>();
  const canShip = sessionPermissions.includes('order.ship');
  const canRefund = sessionPermissions.includes('order.refund');
  const metrics = orderMetrics(orders);
  const requestShip = (order: OrderListItem, refresh: () => void) => {
    onOpenGuardrail(`确认订单发货：${order.orderNo}`, '订单发货', order.supplierNames.join('、') || '订单供应商', order.id, order.paidCents / 100, () => {
      if (!onShipOrder) return;
      void onShipOrder(order.id)
        .then(() => {
          onUpdateOrders(orders.map((item) => (item.id === order.id ? { ...item, status: 'shipped' } : item)));
          refresh();
        })
        .catch(() => window.alert('订单发货未成功，请刷新后重试。'));
    });
  };
  const requestRefund = (afterSale: AfterSaleListItem, refresh: () => void) => {
    onOpenGuardrail(`确认原路退款：${afterSale.afterSaleNo}`, '售后退款', afterSale.orderNo, afterSale.id, afterSale.requestedAmountCents / 100, () => {
      if (!isLiveOrders) return refuseDemoDataWrite('退款');
      void executeAfterSaleRefund(afterSale.id, afterSale.requestedAmountCents)
        .then(refresh)
        .catch(() => window.alert('退款未成功。请确认已完成二次认证且该售后可退款。'));
    });
  };
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-6">
      <section className="rounded-[14px] border border-slate-200/90 bg-white px-6 pt-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">订单管理系统 (Order Management System)</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[var(--sw-brand)]">当前授权订单范围</span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${isLiveOrders ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {isLiveOrders ? '生产订单实时读取' : '演示订单数据 · 尚未连接生产库'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">查单、售后、异常处理与全生命周期履约统一在同一工作台完成；统计仅反映当前已载入的授权范围。</p>
          </div>
          <button type="button" onClick={() => setActiveTab('exceptions')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 transition-colors hover:bg-rose-100">
            风险待处理 <span className="ml-1 font-semibold">{metrics.risk}</span> 单 <span className="ml-1">查看队列 →</span>
          </button>
        </div>
        <section className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="当前订单运营概览">
          <MetricCard label="当前范围订单" value={metrics.total} note="已载入订单" tone="blue" onClick={() => setActiveTab('orders')} />
          <MetricCard label="待履约" value={metrics.pendingFulfillment} note="已支付或待发货" tone="violet" onClick={() => setActiveTab('fulfillment')} />
          <MetricCard label="售后待办" value={metrics.afterSales} note="退款申请处理中" tone="amber" onClick={() => setActiveTab('afterSales')} />
          <MetricCard label="风险待处理" value={metrics.risk} note="库存、SLA 与退款风险" tone="rose" onClick={() => setActiveTab('exceptions')} />
        </section>
        <div className="flex overflow-x-auto">
          <div className="flex min-w-max items-center gap-1 pt-3">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-colors ${activeTab === tab.id ? 'bg-[var(--sw-brand)] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                {tab.label}
                {tab.id === 'orders' && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{metrics.total}</span>}
                {tab.id === 'afterSales' && metrics.afterSales > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'}`}>{metrics.afterSales}</span>
                )}
                {tab.id === 'exceptions' && metrics.risk > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700'}`}>{metrics.risk}</span>}
              </button>
            ))}
          </div>
        </div>
      </section>
      {activeTab === 'orders' && <OrderListPanel isLiveData={isLiveOrders} legacyOrders={orders} canShip={canShip} onRequestShip={requestShip} />}
      {activeTab === 'afterSales' && <AfterSaleListPanel isLiveData={isLiveOrders} legacyOrders={orders} canRefund={canRefund} onRequestRefund={requestRefund} />}
      {activeTab === 'exceptions' && (
        <ExceptionSummary
          orders={orders}
          onOpen={(orderId) => {
            setFocusedOrderId(orderId);
            setActiveTab('fulfillment');
          }}
        />
      )}
      {activeTab === 'plans' && <PlanOrderPanel />}
      {activeTab === 'fulfillment' && (
        <OrderFulfillmentWorkstation
          orders={orders}
          onUpdateOrders={onUpdateOrders}
          onOpenGuardrail={onOpenGuardrail}
          initialProblemType={initialProblemType}
          initialOrderId={focusedOrderId}
          isLiveOrders={isLiveOrders}
          onShipOrder={onShipOrder}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, note, tone, onClick }: { label: string; value: number; note: string; tone: 'blue' | 'violet' | 'amber' | 'rose'; onClick: () => void }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50/50 text-[var(--sw-brand)]',
    violet: 'border-violet-100 bg-violet-50/50 text-violet-700',
    amber: 'border-amber-100 bg-amber-50/50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50/50 text-rose-700',
  };
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-3 text-left transition-transform hover:-translate-y-0.5 hover:shadow-sm ${tones[tone]}`}>
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <span className="mt-1 block text-2xl font-bold tabular-nums">{value}</span>
      <span className="mt-1 block text-[11px] text-slate-500">{note}</span>
    </button>
  );
}

function orderMetrics(orders: Order[]) {
  const afterSales = orders.filter((order) => order.status === 'refund_pending').length;
  const risk = orders.filter((order) => order.isProblematic || order.status === 'refund_pending').length;
  return {
    total: orders.length,
    pendingFulfillment: orders.filter((order) => ['paid', 'processing', 'pending_shipment'].includes(order.status)).length,
    afterSales,
    risk,
  };
}

function ExceptionSummary({ orders, onOpen }: { orders: Order[]; onOpen: (orderId: string) => void }) {
  const exceptions = orders.filter((order) => order.isProblematic || order.status === 'refund_pending');
  return (
    <section className="overflow-hidden rounded-[14px] border border-slate-200/90 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">异常订单队列</h3>
          <p className="mt-1 text-xs text-slate-500">异常处置会在订单履约台保留全生命周期时间线、资金分摊与重试记录。</p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(exceptions[0]?.id ?? '')}
          disabled={!exceptions.length}
          className="rounded-lg bg-[var(--sw-brand)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          处理首个异常
        </button>
      </div>
      {exceptions.length ? (
        <div className="divide-y divide-slate-100">
          {exceptions.map((order) => (
            <div key={order.id} className="grid gap-3 px-5 py-4 text-xs md:grid-cols-[180px_1fr_160px_84px]">
              <span className="font-mono font-semibold text-[var(--sw-brand)]">{order.orderNo}</span>
              <span>
                <span className="block font-medium text-slate-700">{order.problemSummary ?? '订单履约异常待处理'}</span>
                <span className="mt-1 block text-slate-400">
                  {order.enterpriseName} · 截止 {order.slaDeadline}
                </span>
              </span>
              <span className="self-center">
                <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">{order.problemType ?? orderStatusLabel(order.status)}</span>
              </span>
              <button type="button" onClick={() => onOpen(order.id)} className="self-center font-semibold text-[var(--sw-brand)] hover:underline">
                去处置
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-16 text-center text-sm text-slate-500">当前没有待处理异常订单。</div>
      )}
    </section>
  );
}
