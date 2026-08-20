import { Ban, CircleDollarSign, ClipboardCheck, TicketCheck } from 'lucide-react';
import { type LiveVoucher, type LiveVoucherBatch, type LiveVoucherOverview, type LiveVoucherProgram, type LiveVoucherReserve } from '../../services/vouchers';
import { liveCurrency, liveDate, recordStatusLabel } from './voucherOperationsModel';
import type { ModuleId } from './voucherOperationsModel';
import { MetricCard, LiveStateNotice, LiveVoucherStatusTag, LiveGuardedAction } from './VoucherOperationsPrimitives';
import type { VoucherWriteAction } from './voucherWriteAction';

interface VoucherIssuancePanelsProps {
  activeModule: ModuleId;
  batches: LiveVoucherBatch[];
  canWrite: (permission: string) => boolean;
  error: string | null;
  loading: boolean;
  overview: LiveVoucherOverview | null;
  programs: LiveVoucherProgram[];
  reserves: LiveVoucherReserve[];
  setWriteAction: (action: VoucherWriteAction) => void;
  switchModule: (module: ModuleId) => void;
  vouchers: LiveVoucher[];
}

/** Overview, product, reserve, approval and issuing-centre panels. */
export function VoucherIssuancePanels({ activeModule, batches, canWrite, error, loading, overview, programs, reserves, setWriteAction, switchModule, vouchers }: VoucherIssuancePanelsProps) {
  return (
    <>
      {activeModule === 'overview' && (
        <div className="space-y-4">
          <LiveStateNotice loading={loading} error={error} />
          {!loading && !error && overview && (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="可使用卡券" value={overview.activeVoucherCount.toLocaleString('zh-CN')} note="正式数据" icon={TicketCheck} />
                <MetricCard label="未激活卡券" value={overview.inactiveVoucherCount.toLocaleString('zh-CN')} note="正式数据" icon={ClipboardCheck} tone="amber" />
                <MetricCard label="已禁用卡券" value={overview.disabledVoucherCount.toLocaleString('zh-CN')} note="正式数据" icon={Ban} tone="rose" />
                <MetricCard label="未核销有效券余额" value={liveCurrency(overview.remainingValueCents)} note="含未激活和禁用券；不含到期及作废券" icon={CircleDollarSign} tone="green" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">卡券生命周期</h3>
                    <p className="mt-1 text-[11px] text-slate-400">最后更新：{liveDate(overview.updatedAt)}</p>
                  </div>
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">已核销：{overview.redeemedVoucherCount.toLocaleString('zh-CN')} 张</span>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
                  {[
                    ['foundation', '产品档案'],
                    ['reserve', '备券申请'],
                    ['approval', '审批'],
                    ['center', '发行批次'],
                    ['query', '会员券资产'],
                    ['verify', '券码核销'],
                    ['consumption', '消费明细'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => switchModule(id as ModuleId)}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold text-slate-700 hover:border-[var(--sw-brand)] hover:bg-[var(--sw-brand-light)]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeModule === 'foundation' && (
        <div>
          <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && programs.length === 0 ? '正式数据库中暂未创建可查看的卡券产品档案。' : undefined} />
          {!loading && !error && programs.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['产品编码', '产品名称', '面额', '默认有效期', '核销规则', '状态'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {programs.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono">{item.programCode}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 font-mono">{liveCurrency(item.denominationCents)}</td>
                      <td className="px-4 py-3">{item.defaultValidDays} 天</td>
                      <td className="px-4 py-3 text-slate-500">{item.redemptionPolicy}</td>
                      <td className="px-4 py-3">{recordStatusLabel(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(activeModule === 'reserve' || activeModule === 'approval') && (
        <div>
          <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && reserves.length === 0 ? '正式数据库中暂未有可查看的备券申请。' : undefined} />
          {!loading && !error && reserves.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['申请单号', '产品', '申请数量', '申请面值', '状态', '创建时间', ...(activeModule === 'approval' && canWrite('voucher.reserve.approve') ? ['操作'] : [])].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reserves.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono">{item.requestNo}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.programName}</td>
                      <td className="px-4 py-3 font-mono">{item.requestedQuantity.toLocaleString('zh-CN')}</td>
                      <td className="px-4 py-3 font-mono">{liveCurrency(item.requestedValueCents)}</td>
                      <td className="px-4 py-3">{recordStatusLabel(item.status)}</td>
                      <td className="px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                      {activeModule === 'approval' && canWrite('voucher.reserve.approve') && (
                        <td className="px-4 py-3">
                          {item.status === 'submitted' ? (
                            <button
                              type="button"
                              onClick={() => setWriteAction({ kind: 'approval', reserve: item })}
                              className="rounded-lg border border-[var(--sw-brand)]/30 bg-[var(--sw-brand-light)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--sw-brand-dark)]"
                            >
                              审批
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">已处理</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4">
            {activeModule === 'reserve' && canWrite('voucher.reserve.create') ? (
              <button type="button" onClick={() => setWriteAction({ kind: 'reserve' })} className="rounded-xl bg-[var(--sw-brand)] px-4 py-2.5 text-xs font-semibold text-white">
                创建备券申请
              </button>
            ) : activeModule === 'approval' && canWrite('voucher.reserve.approve') ? (
              <p className="text-xs text-slate-500">只允许审批“待审批”记录；每次审批均需二次认证。</p>
            ) : (
              <LiveGuardedAction title={activeModule === 'approval' ? '审批写操作尚未开放' : '备券申请写操作尚未开放'} description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
            )}
          </div>
        </div>
      )}

      {activeModule === 'center' && (
        <div>
          <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && batches.length === 0 ? '正式数据库中暂未有可查看的发行批次。' : undefined} />
          {!loading && !error && batches.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['批次号', '发行数量', '发行面值', '状态', '发行时间', '创建时间'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono">{item.batchNo}</td>
                      <td className="px-4 py-3 font-mono">{item.issuedQuantity.toLocaleString('zh-CN')}</td>
                      <td className="px-4 py-3 font-mono">{liveCurrency(item.issuedValueCents)}</td>
                      <td className="px-4 py-3">{recordStatusLabel(item.status)}</td>
                      <td className="px-4 py-3 text-slate-500">{liveDate(item.issuedAt)}</td>
                      <td className="px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4">
            {canWrite('voucher.issue') ? (
              <button
                type="button"
                onClick={() => setWriteAction({ kind: 'issue' })}
                disabled={!reserves.some((item) => item.status === 'approved')}
                className="rounded-xl bg-[var(--sw-brand)] px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                发行电子券批次
              </button>
            ) : (
              <LiveGuardedAction title="发行写操作尚未开放" description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
            )}
          </div>
        </div>
      )}

      {activeModule === 'operations' && (
        <div>
          <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && vouchers.length === 0 ? '正式数据库中暂未有可管理的卡券。' : undefined} />
          {!loading && !error && vouchers.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['券码', '产品', '状态', '剩余余额', '版本', ...(canWrite('voucher.status.manage') ? ['操作'] : [])].map((head) => (
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
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.programName}</td>
                      <td className="px-4 py-3">
                        <LiveVoucherStatusTag status={item.status} />
                      </td>
                      <td className="px-4 py-3 font-mono">{liveCurrency(item.remainingCents)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{item.version}</td>
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
          <div className="mt-4">
            {canWrite('voucher.status.manage') ? (
              <p className="text-xs text-slate-500">每次操作带服务端版本校验和二次认证；作废将冻结未使用余额并生成财务人工对账项，不会自动退回企业余额。</p>
            ) : (
              <LiveGuardedAction title="卡券状态操作尚未开放" description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
