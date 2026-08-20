import React, { useCallback, useEffect, useState } from 'react';
import { refuseDemoDataWrite } from '../../../services/writeAvailability';
import type { Order } from '../../../types';
import {
  AFTER_SALE_STATUS_OPTIONS,
  DEFAULT_ORDER_FILTERS,
  exportOrderPage,
  formatCents,
  formatDate,
  legacyAfterSalePage,
  loadAfterSalePage,
  statusLabel,
  type AfterSaleListItem,
  type OrderFilters,
  type Page,
} from '../../../services/orders';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { OrderFilterBar } from './OrderFilterBar';
import { Pagination } from './Pagination';

interface AfterSaleListPanelProps {
  isLiveData: boolean;
  legacyOrders: Order[];
  canRefund: boolean;
  onRequestRefund: (afterSale: AfterSaleListItem, refresh: () => void) => void;
}

export function AfterSaleListPanel({ isLiveData, legacyOrders, canRefund, onRequestRefund }: AfterSaleListPanelProps) {
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS);
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS);
  const [page, setPage] = useState<Page<AfterSaleListItem>>({ items: [], total: 0, limit: 20, offset: 0 });
  const [selected, setSelected] = useState<AfterSaleListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setPage(isLiveData ? await loadAfterSalePage(filters) : legacyAfterSalePage(legacyOrders, filters));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, isLiveData, legacyOrders]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const reset = () => {
    setDraftFilters(DEFAULT_ORDER_FILTERS);
    setFilters(DEFAULT_ORDER_FILTERS);
  };
  const changePage = (offset: number, limit: number) => {
    const next = { ...filters, offset, limit };
    setDraftFilters(next);
    setFilters(next);
  };
  const exportRows = async () => {
    if (!isLiveData) return refuseDemoDataWrite('售后订单导出');
    try {
      await exportOrderPage('after-sales', filters);
    } catch {
      window.alert('售后订单导出失败，请稍后重试。');
    }
  };
  return (
    <section className="overflow-hidden rounded-[14px] border border-slate-200/90 bg-white shadow-xs">
      <OrderFilterBar
        filters={draftFilters}
        statuses={AFTER_SALE_STATUS_OPTIONS}
        placeholder="搜索售后单号、订单号"
        onChange={setDraftFilters}
        onSearch={() => setFilters(draftFilters)}
        onReset={reset}
        onExport={() => void exportRows()}
        loading={loading}
      />
      {loading ? (
        <State text="正在加载售后订单…" />
      ) : error ? (
        <State text="售后订单加载失败，请检查网络或稍后重试。" retry={() => void refresh()} />
      ) : page.total === 0 && hasFilters(filters) ? (
        <State text="没有符合当前筛选条件的售后订单。" reset={reset} />
      ) : page.total === 0 ? (
        <State text="当前授权范围内暂无售后订单。" />
      ) : (
        <>
          <AfterSaleTable items={page.items} canRefund={canRefund} onSelect={setSelected} onRefund={(item) => onRequestRefund(item, () => void refresh())} />
          <Pagination total={page.total} limit={page.limit} offset={page.offset} onChange={changePage} />
        </>
      )}
      <OrderDetailDrawer item={selected} kind="afterSale" onClose={() => setSelected(null)} />
    </section>
  );
}

function AfterSaleTable({ items, canRefund, onSelect, onRefund }: { items: AfterSaleListItem[]; canRefund: boolean; onSelect: (item: AfterSaleListItem) => void; onRefund: (item: AfterSaleListItem) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {['售后单号', '关联订单', '商品', '售后类型', '申请金额', '售后状态', '申请时间', '操作'].map((head) => (
              <th key={head} className="whitespace-nowrap px-4 py-3 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-blue-50/30">
              <td className="px-4 py-3">
                <button type="button" onClick={() => onSelect(item)} className="font-mono font-semibold text-[var(--sw-brand)] hover:underline">
                  {item.afterSaleNo}
                </button>
              </td>
              <td className="px-4 py-3 font-mono text-slate-600">{item.orderNo}</td>
              <td className="max-w-56 px-4 py-3">
                <span className="block truncate font-medium text-slate-700">{item.firstProductName}</span>
              </td>
              <td className="px-4 py-3 text-slate-600">{typeLabel(item.type)}</td>
              <td className="px-4 py-3 font-mono font-medium tabular-nums text-slate-700">{formatCents(item.requestedAmountCents)}</td>
              <td className="px-4 py-3">
                <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">{statusLabel(item.status, AFTER_SALE_STATUS_OPTIONS)}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <button type="button" onClick={() => onSelect(item)} className="font-medium text-[var(--sw-brand)] hover:underline">
                  详情
                </button>
                {canRefund && item.status === 'approved' && (
                  <button type="button" onClick={() => onRefund(item)} className="ml-3 font-medium text-rose-700 hover:underline">
                    退款
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
function State({ text, retry, reset }: { text: string; retry?: () => void; reset?: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-slate-600">{text}</p>
      {retry && (
        <button type="button" onClick={retry} className="rounded-lg bg-[var(--sw-brand)] px-3 py-2 text-xs font-semibold text-white">
          重新加载
        </button>
      )}
      {reset && (
        <button type="button" onClick={reset} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
          重置筛选
        </button>
      )}
    </div>
  );
}
function typeLabel(type: string) {
  return ({ refund_only: '仅退款', return_refund: '退货退款', exchange: '换货' } as Record<string, string>)[type] ?? type;
}
function hasFilters(filters: OrderFilters) {
  return Boolean(filters.keyword || filters.status || filters.createdFrom || filters.createdTo);
}
