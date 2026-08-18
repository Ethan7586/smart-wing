import React from 'react';
import { ORDER_STATUS_OPTIONS, formatCents, formatDate, statusLabel, type OrderListItem } from '../../../services/orders';

interface OrderTableProps {
  orders: OrderListItem[];
  canShip: boolean;
  onSelect: (order: OrderListItem) => void;
  onShip: (order: OrderListItem) => void;
}

const STATUS_STYLE: Record<string, string> = {
  pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-violet-50 text-violet-700 border-violet-200',
  shipped: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  refund_pending: 'bg-rose-50 text-rose-700 border-rose-200',
  refunded: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
};

export function OrderTable({ orders, canShip, onSelect, onShip }: OrderTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {['订单号', '商品', '数量', '应付金额', '实付金额', '支付构成', '供应商', '订单状态', '下单时间', '操作'].map((head) => (
              <th key={head} className="whitespace-nowrap px-4 py-3 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-blue-50/30">
              <td className="px-4 py-3">
                <button type="button" onClick={() => onSelect(order)} className="font-mono font-semibold text-[#1769ff] hover:underline">
                  {order.orderNo}
                </button>
              </td>
              <td className="max-w-52 px-4 py-3">
                <span className="block truncate font-medium text-slate-700">{order.firstProductName}</span>
                {order.itemCount > 1 && <span className="mt-1 block text-[11px] text-slate-400">等 {order.itemCount} 件</span>}
              </td>
              <td className="px-4 py-3 tabular-nums text-slate-600">{order.itemCount}</td>
              <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-700">{formatCents(order.payableCents)}</td>
              <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-700">{formatCents(order.paidCents)}</td>
              <td className="max-w-48 px-4 py-3 text-slate-500">{paymentText(order)}</td>
              <td className="max-w-36 px-4 py-3">
                <span className="block truncate">{order.supplierNames.join('、') || '—'}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium ${STATUS_STYLE[order.status] ?? STATUS_STYLE.cancelled}`}>{statusLabel(order.status, ORDER_STATUS_OPTIONS)}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(order.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <button type="button" onClick={() => onSelect(order)} className="font-medium text-[#1769ff] hover:underline">
                  详情
                </button>
                {canShip && ['paid', 'processing'].includes(order.status) && (
                  <button type="button" onClick={() => onShip(order)} className="ml-3 font-medium text-emerald-700 hover:underline">
                    发货
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function paymentText(order: OrderListItem): string {
  const chunks = [];
  if (order.welfarePaidCents) chunks.push(`福利 ${formatCents(order.welfarePaidCents)}`);
  if (order.mealPaidCents) chunks.push(`餐补 ${formatCents(order.mealPaidCents)}`);
  const external = Math.max(0, order.paidCents - order.welfarePaidCents - order.mealPaidCents);
  if (external) chunks.push(`外部支付 ${formatCents(external)}`);
  return chunks.join(' · ') || '未支付';
}
