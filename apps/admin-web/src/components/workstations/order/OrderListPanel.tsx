import React, { useCallback, useEffect, useState } from 'react';
import { refuseDemoDataWrite } from '../../../services/writeAvailability';
import type { Order } from '../../../types';
import { DEFAULT_ORDER_FILTERS, ORDER_STATUS_OPTIONS, exportOrderPage, legacyOrderPage, loadOrderPage, type OrderFilters, type OrderListItem, type Page } from '../../../services/orders';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { OrderFilterBar } from './OrderFilterBar';
import { OrderTable } from './OrderTable';
import { Pagination } from './Pagination';

interface OrderListPanelProps {
  isLiveData: boolean;
  legacyOrders: Order[];
  canShip: boolean;
  onRequestShip: (order: OrderListItem, refresh: () => void) => void;
}

export function OrderListPanel({ isLiveData, legacyOrders, canShip, onRequestShip }: OrderListPanelProps) {
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS);
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS);
  const [page, setPage] = useState<Page<OrderListItem>>({ items: [], total: 0, limit: 20, offset: 0 });
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setPage(isLiveData ? await loadOrderPage(filters) : legacyOrderPage(legacyOrders, filters));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, isLiveData, legacyOrders]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const changePage = (offset: number, limit: number) => {
    const next = { ...filters, offset, limit };
    setDraftFilters(next);
    setFilters(next);
  };
  const reset = () => {
    setDraftFilters(DEFAULT_ORDER_FILTERS);
    setFilters(DEFAULT_ORDER_FILTERS);
  };
  const exportRows = async () => {
    if (!isLiveData) return refuseDemoDataWrite('订单导出');
    try {
      await exportOrderPage('orders', filters);
    } catch {
      window.alert('订单导出失败，请稍后重试。');
    }
  };

  return (
    <section className="overflow-hidden rounded-[14px] border border-slate-200/90 bg-white shadow-xs">
      <OrderFilterBar
        filters={draftFilters}
        statuses={ORDER_STATUS_OPTIONS}
        placeholder="搜索订单号、商品名称"
        onChange={setDraftFilters}
        onSearch={() => setFilters(draftFilters)}
        onReset={reset}
        onExport={() => void exportRows()}
        loading={loading}
      />
      {loading ? (
        <State text="正在加载商品订单…" />
      ) : error ? (
        <State text="订单加载失败，请检查网络或稍后重试。" retry={() => void refresh()} />
      ) : page.total === 0 && hasFilters(filters) ? (
        <State text="没有符合当前筛选条件的商品订单。" reset={reset} />
      ) : page.total === 0 ? (
        <State text="当前授权范围内暂无商品订单。" />
      ) : (
        <>
          <OrderTable orders={page.items} canShip={canShip} onSelect={setSelected} onShip={(order) => onRequestShip(order, () => void refresh())} />
          <Pagination total={page.total} limit={page.limit} offset={page.offset} onChange={changePage} />
        </>
      )}
      <OrderDetailDrawer item={selected} kind="order" onClose={() => setSelected(null)} />
    </section>
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
function hasFilters(filters: OrderFilters) {
  return Boolean(filters.keyword || filters.status || filters.createdFrom || filters.createdTo);
}
