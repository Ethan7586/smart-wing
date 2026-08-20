import React, { useEffect, useState } from 'react';
import { Database, TicketCheck } from 'lucide-react';
import {
  loadLiveVoucherBatches,
  loadLiveVoucherAudit,
  loadLiveVoucherOverview,
  loadLiveVoucherPrograms,
  loadLiveVoucherRedemptions,
  loadLiveVoucherReserves,
  loadLiveVoucherVoidBalanceHolds,
  loadLiveVouchers,
  type LiveVoucher,
  type LiveVoucherAudit,
  type LiveVoucherBatch,
  type LiveVoucherOverview,
  type LiveVoucherProgram,
  type LiveVoucherRedemption,
  type LiveVoucherReserve,
  type LiveVoucherVoidBalanceHold,
  type VoucherApiStatus,
} from '../../services/vouchers';
import { formalModuleItems } from './voucherOperationsModel';
import type { ModuleId } from './voucherOperationsModel';
import { VoucherIssuancePanels } from './VoucherIssuancePanels';
import { VoucherRecordPanels } from './VoucherRecordPanels';
import { VoucherWriteActionDialog } from './VoucherWriteActionDialog';
import type { VoucherWriteAction } from './voucherWriteAction';

interface VoucherOperationsProps {
  /** Permissions come from the server session projection, never from a form. */
  sessionPermissions?: string[];
  /** Explicitly disabled in every normal and test build until grey approval. */
  writeEnabled?: boolean;
}

export const VoucherOperationsWorkstation: React.FC<VoucherOperationsProps> = ({ sessionPermissions = [], writeEnabled = false }) => {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [overview, setOverview] = useState<LiveVoucherOverview | null>(null);
  const [programs, setPrograms] = useState<LiveVoucherProgram[]>([]);
  const [reserves, setReserves] = useState<LiveVoucherReserve[]>([]);
  const [batches, setBatches] = useState<LiveVoucherBatch[]>([]);
  const [vouchers, setVouchers] = useState<LiveVoucher[]>([]);
  const [redemptions, setRedemptions] = useState<LiveVoucherRedemption[]>([]);
  const [audits, setAudits] = useState<LiveVoucherAudit[]>([]);
  const [voidBalanceHolds, setVoidBalanceHolds] = useState<LiveVoucherVoidBalanceHold[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VoucherApiStatus | 'all'>('all');
  const [searchVersion, setSearchVersion] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [writeAction, setWriteAction] = useState<VoucherWriteAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleModuleItems = formalModuleItems.filter((item) => {
    if (item.id === 'audit') return sessionPermissions.includes('voucher.audit.read');
    if (item.id === 'reconciliation') return sessionPermissions.includes('voucher.reconcile');
    return true;
  });
  const activeMeta = visibleModuleItems.find((item) => item.id === activeModule) ?? visibleModuleItems[0] ?? formalModuleItems[0];

  useEffect(() => {
    if (activeModule === 'verify') {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      if (activeModule === 'overview') setOverview(await loadLiveVoucherOverview());
      if (activeModule === 'foundation') setPrograms((await loadLiveVoucherPrograms()).items);
      if (activeModule === 'reserve' || activeModule === 'approval') {
        const [reservePage, programPage] = await Promise.all([loadLiveVoucherReserves(), loadLiveVoucherPrograms()]);
        setReserves(reservePage.items);
        setPrograms(programPage.items);
      }
      if (activeModule === 'center') {
        const [batchPage, reservePage] = await Promise.all([loadLiveVoucherBatches(), loadLiveVoucherReserves()]);
        setBatches(batchPage.items);
        setReserves(reservePage.items);
      }
      if (activeModule === 'operations') setVouchers((await loadLiveVouchers()).items);
      if (activeModule === 'query') setVouchers((await loadLiveVouchers({ query: submittedQuery, status: statusFilter === 'all' ? undefined : statusFilter })).items);
      if (activeModule === 'consumption') setRedemptions((await loadLiveVoucherRedemptions()).items);
      if (activeModule === 'audit') setAudits((await loadLiveVoucherAudit()).items);
      if (activeModule === 'reconciliation') setVoidBalanceHolds((await loadLiveVoucherVoidBalanceHolds()).items);
    };
    void load()
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'VOUCHER_API_REQUEST_FAILED');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeModule, refreshVersion, searchVersion, statusFilter, submittedQuery]);

  const pendingReserveCount = reserves.filter((item) => item.status === 'submitted').length;
  const switchModule = (module: ModuleId) => setActiveModule(module);
  const runVoucherSearch = () => {
    setSubmittedQuery(queryInput);
    setSearchVersion((current) => current + 1);
  };
  const canWrite = (permission: string) => writeEnabled && sessionPermissions.includes(permission);
  const completedWrite = () => setRefreshVersion((current) => current + 1);

  return (
    <div className="min-h-full space-y-4 bg-[#F5F7FB] p-5 lg:p-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--sw-brand-ink)] via-[#102E61] to-[var(--sw-brand-dark)] p-5 text-white shadow-lg shadow-blue-950/10">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--sw-brand)]/25 blur-2xl" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sw-brand)] shadow-lg shadow-blue-900/40">
              <TicketCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">卡券运营台</h1>
                <span className="rounded-full border border-emerald-200/30 bg-emerald-300/15 px-2 py-0.5 font-mono text-[10px] text-emerald-100">正式受控数据</span>
              </div>
              <p className="mt-0.5 text-xs text-blue-100/80">只读数据链路已启用；写操作仍受二次认证、审计与灰度控制。</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-blue-100/80 xl:flex">
            <Database className="h-4 w-4 text-emerald-300" />
            <span>来源：服务端 API，不回退为测试样例</span>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="sticky top-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="px-3 pb-2 pt-2 text-[10px] font-semibold tracking-wider text-slate-400">卡券管理模块</div>
          <div className="space-y-1">
            {visibleModuleItems.map(({ id, label, owner, icon: Icon }) => {
              const active = activeModule === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchModule(id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-[var(--sw-brand-light)] text-[var(--sw-brand-dark)] ring-1 ring-[var(--sw-brand)]/20' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--sw-brand)]' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">{owner}</span>
                  </span>
                  {id === 'approval' && pendingReserveCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{pendingReserveCount}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
            <strong className="mb-1 block text-slate-700">凭证边界</strong>门店只核销券码；会员码仅识别会员身份。
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{activeMeta.label}</h2>
                <span className="rounded-full bg-[var(--sw-brand-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sw-brand-dark)]">{activeMeta.owner}</span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-700">仅显示通过正式权限校验的服务端数据。</p>
            </div>
            <span className="text-[11px] text-slate-400">{loading ? '读取中…' : '只读模式'}</span>
          </div>

          <VoucherIssuancePanels
            activeModule={activeModule}
            overview={overview}
            programs={programs}
            reserves={reserves}
            batches={batches}
            vouchers={vouchers}
            loading={loading}
            error={error}
            canWrite={canWrite}
            switchModule={switchModule}
            setWriteAction={setWriteAction}
          />
          <VoucherRecordPanels
            activeModule={activeModule}
            vouchers={vouchers}
            redemptions={redemptions}
            audits={audits}
            voidBalanceHolds={voidBalanceHolds}
            queryInput={queryInput}
            setQueryInput={setQueryInput}
            statusFilter={statusFilter}
            onStatusFilterChange={(value) => {
              setStatusFilter(value);
              setSearchVersion((current) => current + 1);
            }}
            runVoucherSearch={runVoucherSearch}
            loading={loading}
            error={error}
            canWrite={canWrite}
            setWriteAction={setWriteAction}
          />
        </div>
      </section>
      <VoucherWriteActionDialog
        key={
          writeAction
            ? `${writeAction.kind}:${writeAction.kind === 'status' ? writeAction.voucher.id : writeAction.kind === 'approval' ? writeAction.reserve.id : writeAction.kind === 'reverse' ? writeAction.redemption.id : writeAction.kind === 'reconcile' ? writeAction.voidHold.id : 'new'}`
            : 'closed'
        }
        action={writeAction}
        programs={programs}
        reserves={reserves}
        onClose={() => setWriteAction(null)}
        onCompleted={completedWrite}
      />
    </div>
  );
};
