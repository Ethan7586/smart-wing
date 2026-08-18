import React, { useState } from 'react';
import type { Order } from '../../types';
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
  const requestShip = (order: OrderListItem, refresh: () => void) => {
    onOpenGuardrail(`确认订单发货：${order.orderNo}`, '订单发货', order.supplierNames.join('、') || '订单供应商', order.id, order.paidCents / 100, () => {
      if (!onShipOrder) return;
      void onShipOrder(order.id)
        .then(() => {
          onUpdateOrders(orders.map((item) => (item.id === order.id ? { ...item, status: '已发货' } : item)));
          refresh();
        })
        .catch(() => window.alert('订单发货未成功，请刷新后重试。'));
    });
  };
  const requestRefund = (afterSale: AfterSaleListItem, refresh: () => void) => {
    onOpenGuardrail(`确认原路退款：${afterSale.afterSaleNo}`, '售后退款', afterSale.orderNo, afterSale.id, afterSale.requestedAmountCents / 100, () => {
      if (!isLiveOrders) return window.alert('演示数据不支持真实退款。');
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
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1769ff]">当前授权订单范围</span>
              {isLiveOrders && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">生产订单实时读取</span>}
            </div>
            <p className="mt-2 text-xs text-slate-500">查单、售后、异常处理与全生命周期履约统一在同一工作台完成</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            异常待处理 <span className="ml-1 font-semibold text-rose-600">{orders.filter((order) => order.isProblematic).length}</span> 单
          </div>
        </div>
        <div className="flex overflow-x-auto">
          <div className="flex min-w-max items-center gap-1 pt-3">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-colors ${activeTab === tab.id ? 'bg-[#1769ff] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                {tab.label}
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

function ExceptionSummary({ orders, onOpen }: { orders: Order[]; onOpen: (orderId: string) => void }) {
  const exceptions = orders.filter((order) => order.isProblematic || order.status === '退款申请中');
  return (
    <section className="overflow-hidden rounded-[14px] border border-slate-200/90 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">异常订单队列</h3>
          <p className="mt-1 text-xs text-slate-500">异常处置会在订单履约台保留全生命周期时间线、资金分摊与重试记录。</p>
        </div>
        <button type="button" onClick={() => onOpen(exceptions[0]?.id ?? '')} disabled={!exceptions.length} className="rounded-lg bg-[#1769ff] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          处理首个异常
        </button>
      </div>
      {exceptions.length ? (
        <div className="divide-y divide-slate-100">
          {exceptions.map((order) => (
            <div key={order.id} className="grid gap-3 px-5 py-4 text-xs md:grid-cols-[180px_1fr_160px_84px]">
              <span className="font-mono font-semibold text-[#1769ff]">{order.orderNo}</span>
              <span>
                <span className="block font-medium text-slate-700">{order.problemSummary ?? '订单履约异常待处理'}</span>
                <span className="mt-1 block text-slate-400">
                  {order.enterpriseName} · 截止 {order.slaDeadline}
                </span>
              </span>
              <span className="self-center">
                <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">{order.problemType ?? order.status}</span>
              </span>
              <button type="button" onClick={() => onOpen(order.id)} className="self-center font-semibold text-[#1769ff] hover:underline">
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
