import React from 'react';
import type { OrderFilters } from '../../../services/orders';

interface OrderFilterBarProps {
  filters: OrderFilters;
  statuses: readonly (readonly [string, string])[];
  placeholder: string;
  onChange: (filters: OrderFilters) => void;
  onSearch: () => void;
  onReset: () => void;
  onExport: () => void;
  loading: boolean;
}

export function OrderFilterBar({ filters, statuses, placeholder, onChange, onSearch, onReset, onExport, loading }: OrderFilterBarProps) {
  const set = <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) => onChange({ ...filters, [key]: value, offset: key === 'limit' ? filters.offset : 0 });
  return (
    <div className="space-y-3 border-b border-slate-100 px-5 py-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(240px,1.5fr)_minmax(140px,.7fr)_minmax(250px,1fr)_auto]">
        <label className="relative">
          <span className="sr-only">关键词</span>
          <input
            value={filters.keyword}
            onChange={(event) => set('keyword', event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && onSearch()}
            placeholder={placeholder}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none placeholder:text-slate-400 focus:border-[var(--sw-brand)] focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label>
          <span className="sr-only">订单状态</span>
          <select value={filters.status} onChange={(event) => set('status', event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-[var(--sw-brand)]">
            <option value="">全部状态</option>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2" aria-label="下单日期范围">
          <span className="shrink-0 text-xs font-medium text-slate-500">下单日期</span>
          <input
            type="date"
            lang="zh-CN"
            aria-label="下单开始日期"
            value={filters.createdFrom}
            onChange={(event) => set('createdFrom', event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 outline-none focus:border-[var(--sw-brand)]"
          />
          <span className="text-slate-300">至</span>
          <input
            type="date"
            lang="zh-CN"
            aria-label="下单结束日期"
            value={filters.createdTo}
            onChange={(event) => set('createdTo', event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 outline-none focus:border-[var(--sw-brand)]"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={loading} onClick={onSearch} className="h-9 rounded-lg bg-[var(--sw-brand)] px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
            查询
          </button>
          <button type="button" disabled={loading} onClick={onReset} className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50">
            重置
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">筛选和导出均仅限当前授权数据范围</span>
        <div className="flex items-center gap-2">
          <select value={filters.sort} onChange={(event) => set('sort', event.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600">
            <option value="created_at_desc">下单时间：最新优先</option>
            <option value="created_at_asc">下单时间：最早优先</option>
            <option value="payable_desc">应付金额：从高到低</option>
            <option value="payable_asc">应付金额：从低到高</option>
          </select>
          <button type="button" disabled={loading} onClick={onExport} className="h-8 rounded-lg border border-[#bdd5ff] bg-blue-50 px-3 text-xs font-medium text-[var(--sw-brand)] hover:bg-blue-100 disabled:opacity-50">
            导出 CSV
          </button>
        </div>
      </div>
    </div>
  );
}
