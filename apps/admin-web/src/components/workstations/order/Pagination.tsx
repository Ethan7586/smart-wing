import React from 'react';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (nextOffset: number, nextLimit: number) => void;
}

export function Pagination({ total, limit, offset, onChange }: PaginationProps) {
  const { page, pageCount, first, last } = pageWindow(total, limit, offset);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
      <span>
        显示 {first}–{last} 条，共 {total} 条
      </span>
      <div className="flex items-center gap-2">
        <select value={limit} onChange={(event) => onChange(0, Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
          {[20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
        <button type="button" disabled={page === 1} onClick={() => onChange(Math.max(0, offset - limit), limit)} className="rounded-lg border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">
          上一页
        </button>
        <span className="font-medium text-slate-700">
          {page} / {pageCount}
        </span>
        <button type="button" disabled={page >= pageCount} onClick={() => onChange(offset + limit, limit)} className="rounded-lg border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">
          下一页
        </button>
      </div>
    </div>
  );
}

export function pageWindow(total: number, limit: number, offset: number) {
  const safeLimit = Math.max(1, limit);
  const safeOffset = Math.max(0, offset);
  const page = Math.floor(safeOffset / safeLimit) + 1;
  return {
    page,
    pageCount: Math.max(1, Math.ceil(Math.max(0, total) / safeLimit)),
    first: total === 0 ? 0 : safeOffset + 1,
    last: Math.min(safeOffset + safeLimit, Math.max(0, total)),
  };
}
