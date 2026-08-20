/** Small presentational parts shared by every voucher module panel. */
import React from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { type VoucherApiStatus } from '../../services/vouchers';
import { liveVoucherStatusLabel, liveVoucherStatusStyle } from './voucherOperationsModel';

export function MetricCard({ label, value, note, icon: Icon, tone = 'blue' }: { label: string; value: string; note: string; icon: React.ElementType; tone?: 'blue' | 'green' | 'amber' | 'rose' }) {
  const toneMap = {
    blue: 'bg-blue-50 text-[var(--sw-brand)] border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 min-w-0 shadow-sm shadow-slate-200/30">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
        <span className={`w-8 h-8 rounded-xl border flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="mt-3 text-[22px] leading-none font-bold text-slate-900 font-mono">{value}</div>
      <div className="mt-2 text-[11px] text-slate-400">{note}</div>
    </div>
  );
}

export function DataToolbar({ query, setQuery, placeholder }: { query: string; setQuery: (value: string) => void; placeholder: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-[var(--sw-brand)]" placeholder={placeholder} />
      </div>
      <button className="h-9 px-4 rounded-xl bg-[var(--sw-brand)] text-white text-xs font-semibold">搜索</button>
      <button onClick={() => setQuery('')} className="h-9 px-4 rounded-xl border border-slate-200 text-xs text-slate-600">
        重置
      </button>
    </div>
  );
}

export function LiveStateNotice({ loading, error, emptyLabel }: { loading: boolean; error: string | null; emptyLabel?: string }) {
  if (loading)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500" aria-live="polite">
        正在从正式服务读取卡券数据…
      </div>
    );
  if (error)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700" role="alert">
        <strong>未能获取正式卡券数据。</strong>
        <span className="block mt-1 text-xs">未展示任何测试样例；请检查正式身份、权限、服务和数据迁移状态后重试。</span>
      </div>
    );
  if (emptyLabel) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{emptyLabel}</div>;
  return null;
}

export function LiveVoucherStatusTag({ status }: { status: VoucherApiStatus }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${liveVoucherStatusStyle[status]}`}>{liveVoucherStatusLabel[status]}</span>;
}

export function LiveGuardedAction({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
          <p className="mt-3 text-[11px] font-medium text-amber-800">当前不会向服务器发出写请求，也不会显示测试数据。</p>
        </div>
      </div>
    </div>
  );
}
