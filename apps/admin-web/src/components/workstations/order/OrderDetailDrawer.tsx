import React from 'react';
import { X } from 'lucide-react';
import { AFTER_SALE_STATUS_OPTIONS, ORDER_STATUS_OPTIONS, formatCents, formatDate, statusLabel, type AfterSaleListItem, type OrderListItem } from '../../../services/orders';

interface OrderDetailDrawerProps {
  item: OrderListItem | AfterSaleListItem | null;
  kind: 'order' | 'afterSale';
  onClose: () => void;
}

export function OrderDetailDrawer({ item, kind, onClose }: OrderDetailDrawerProps) {
  if (!item) return null;
  const isOrder = kind === 'order';
  const title = isOrder ? (item as OrderListItem).orderNo : (item as AfterSaleListItem).afterSaleNo;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/25" role="dialog" aria-modal="true" aria-label="订单详情">
      <section className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs text-slate-400">{isOrder ? '订单详情' : '售后单详情'}</p>
            <h3 className="mt-1 font-mono text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </header>
        {isOrder ? <OrderDetail item={item as OrderListItem} /> : <AfterSaleDetail item={item as AfterSaleListItem} />}
      </section>
    </div>
  );
}

function OrderDetail({ item }: { item: OrderListItem }) {
  return (
    <div className="space-y-5 p-6 text-sm">
      <DetailGrid
        rows={[
          ['商品', item.firstProductName],
          ['数量', `${item.itemCount} 件`],
          ['订单状态', statusLabel(item.status, ORDER_STATUS_OPTIONS)],
          ['下单时间', formatDate(item.createdAt)],
          ['应付金额', formatCents(item.payableCents)],
          ['实付金额', formatCents(item.paidCents)],
          ['福利支付', formatCents(item.welfarePaidCents)],
          ['餐补支付', formatCents(item.mealPaidCents)],
          ['供应商', item.supplierNames.join('、') || '未标注'],
        ]}
      />
      <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">收货人、电话及地址属于个人信息，仅在具备相应授权的履约链路中按最小必要原则展示。</p>
    </div>
  );
}
function AfterSaleDetail({ item }: { item: AfterSaleListItem }) {
  return (
    <div className="space-y-5 p-6 text-sm">
      <DetailGrid
        rows={[
          ['关联订单', item.orderNo],
          ['商品', item.firstProductName],
          ['售后类型', typeLabel(item.type)],
          ['售后状态', statusLabel(item.status, AFTER_SALE_STATUS_OPTIONS)],
          ['申请金额', formatCents(item.requestedAmountCents)],
          ['申请时间', formatDate(item.createdAt)],
          ['售后原因', item.reason],
        ]}
      />
    </div>
  );
}
function DetailGrid({ rows }: { rows: string[][] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[96px_1fr] gap-3 py-3">
          <dt className="text-xs text-slate-400">{label}</dt>
          <dd className="break-words text-sm font-medium text-slate-700">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function typeLabel(type: string) {
  return ({ refund_only: '仅退款', return_refund: '退货退款', exchange: '换货' } as Record<string, string>)[type] ?? type;
}
