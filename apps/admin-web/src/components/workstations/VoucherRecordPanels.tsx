import { Search } from 'lucide-react';
import { type LiveVoucher, type LiveVoucherAudit, type LiveVoucherRedemption, type LiveVoucherVoidBalanceHold, type VoucherApiStatus } from '../../services/vouchers';
import { liveCurrency, liveDate, liveVoucherStatusLabel } from './voucherOperationsModel';
import type { ModuleId } from './voucherOperationsModel';
import { LiveStateNotice, LiveVoucherStatusTag, LiveGuardedAction } from './VoucherOperationsPrimitives';
import type { VoucherWriteAction } from './voucherWriteAction';

interface VoucherRecordPanelsProps {
  activeModule: ModuleId;
  audits: LiveVoucherAudit[];
  canWrite: (permission: string) => boolean;
  error: string | null;
  loading: boolean;
  queryInput: string;
  redemptions: LiveVoucherRedemption[];
  runVoucherSearch: () => void;
  setQueryInput: (value: string) => void;
  onStatusFilterChange: (value: VoucherApiStatus | 'all') => void;
  setWriteAction: (action: VoucherWriteAction) => void;
  statusFilter: VoucherApiStatus | 'all';
  voidBalanceHolds: LiveVoucherVoidBalanceHold[];
  vouchers: LiveVoucher[];
}

/** Query, consumption, redemption, audit and reconciliation panels. */
export function VoucherRecordPanels({
  activeModule,
  audits,
  canWrite,
  error,
  loading,
  queryInput,
  redemptions,
  runVoucherSearch,
  setQueryInput,
  onStatusFilterChange,
  setWriteAction,
  statusFilter,
  voidBalanceHolds,
  vouchers,
}: VoucherRecordPanelsProps) {
  return (
    <>
      {activeModule === 'query' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runVoucherSearch();
                }}
                className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[var(--sw-brand)]"
                placeholder="搜索券码、卡号或产品名称"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as VoucherApiStatus | 'all')}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
            >
              <option value="all">全部状态</option>
              {Object.entries(liveVoucherStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" onClick={runVoucherSearch} className="h-9 rounded-xl bg-[var(--sw-brand)] px-4 text-xs font-semibold text-white">
              查询
            </button>
          </div>
          <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && vouchers.length === 0 ? '没有符合条件的正式卡券数据。' : undefined} />
          {!loading && !error && vouchers.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['券码', '卡号', '产品', '状态', '初始面值', '剩余余额', '有效期', '更新时间', ...(canWrite('voucher.status.manage') ? ['操作'] : [])].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono">{item.voucherCode}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{item.cardNo ?? '电子券'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.programName}</td>
                      <td className="px-4 py-3">
                        <LiveVoucherStatusTag status={item.status} />
                      </td>
                      <td className="px-4 py-3 font-mono">{liveCurrency(item.initialCents)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{liveCurrency(item.remainingCents)}</td>
                      <td className="px-4 py-3 text-slate-500">{liveDate(item.expiresAt)}</td>
                      <td className="px-4 py-3 text-slate-500">{liveDate(item.updatedAt)}</td>
                      {canWrite('voucher.status.manage') && (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setWriteAction({ kind: 'status', voucher: item })}
                            disabled={item.status === 'redeemed' || item.status === 'expired' || item.status === 'void'}
                            className="rounded-lg border border-[var(--sw-brand)]/30 bg-[var(--sw-brand-light)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--sw-brand-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            状态操作
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeModule === 'consumption' && (
        <div>
          <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && redemptions.length === 0 ? '正式数据库中暂未有可查看的核销流水。' : undefined} />
          {!loading && !error && redemptions.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['流水号', '券码', '核销金额', '核销前余额', '核销后余额', '商户流水号', '时间', ...(canWrite('voucher.redemption.reverse') ? ['操作'] : [])].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono">{item.redemptionNo}</td>
                      <td className="px-4 py-3 font-mono">{item.voucherCode}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{liveCurrency(item.amountCents)}</td>
                      <td className="px-4 py-3 font-mono">{liveCurrency(item.remainingBeforeCents)}</td>
                      <td className="px-4 py-3 font-mono">{liveCurrency(item.remainingAfterCents)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{item.merchantReference}</td>
                      <td className="px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                      {canWrite('voucher.redemption.reverse') && (
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setWriteAction({ kind: 'reverse', redemption: item })} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                            申请冲正
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeModule === 'audit' && (
        <div>
          <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && audits.length === 0 ? '当前数据范围内暂未有卡券审计记录。' : undefined} />
          {!loading && !error && audits.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['时间', '操作', '资源', '操作者', '请求 ID', '授权证据'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audits.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-slate-800">{item.action}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-600">{item.resourceType}</span>
                        {item.resourceId && <span className="ml-1 font-mono text-slate-400">· {item.resourceId}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{item.actorUserId ?? '系统'}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{item.requestId}</td>
                      <td className="px-4 py-3 text-slate-600">{typeof item.grantedVia?.permission === 'string' ? item.grantedVia.permission : '已记录'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">审计记录仅追加；该列表按服务端 Membership 数据范围过滤，并保留请求 ID、操作者和授权证据用于追溯。</p>
        </div>
      )}

      {activeModule === 'reconciliation' && (
        <div>
          <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && voidBalanceHolds.length === 0 ? '当前数据范围内没有待处理或已完成的作废余额对账项。' : undefined} />
          {!loading && !error && voidBalanceHolds.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['券码', '冻结余额', '作废原因', '状态', '对账参考号', '作废时间', ...(canWrite('voucher.reconcile') ? ['操作'] : [])].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {voidBalanceHolds.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono">{item.voucherCode}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-amber-800">{liveCurrency(item.amountCents)}</td>
                      <td className="max-w-56 truncate px-4 py-3 text-slate-600" title={item.voidReason}>
                        {item.voidReason}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${item.status === 'open' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
                        >
                          {item.status === 'open' ? '待人工对账' : '已对账'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{item.reconciliationReference ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                      {canWrite('voucher.reconcile') && (
                        <td className="px-4 py-3">
                          {item.status === 'open' ? (
                            <button type="button" onClick={() => setWriteAction({ kind: 'reconcile', voidHold: item })} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                              处理对账
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">已完成</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">作废只冻结未使用余额。完成对账只写入财务处置凭据、操作者和审计记录；不会自动入账、退回企业余额或恢复卡券。</p>
          {!canWrite('voucher.reconcile') && (
            <div className="mt-4">
              <LiveGuardedAction title="作废余额对账写操作尚未开放" description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
            </div>
          )}
        </div>
      )}

      {activeModule === 'verify' && (
        <div>
          {canWrite('voucher.redeem') ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">门店券码核销</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">核销必须提供券码、金额和门店交易参考号；服务器会锁定单券、校验余额并写入不可变流水。</p>
                </div>
                <button type="button" onClick={() => setWriteAction({ kind: 'redeem' })} className="rounded-xl bg-[var(--sw-brand)] px-4 py-2.5 text-xs font-semibold text-white">
                  发起核销
                </button>
              </div>
            </div>
          ) : (
            <LiveGuardedAction title="门店核销尚未开放" description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
          )}
        </div>
      )}
    </>
  );
}
