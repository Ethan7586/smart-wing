import { FormEvent, useEffect, useState } from 'react';
import { CirclePlus, GitBranch, RefreshCw, ShieldAlert } from 'lucide-react';
import { createDistributionChannel, loadDistributionHub, type DistributionHubData } from '../../services/operationsMvp';

export function DistributionWorkstation() {
  const [data, setData] = useState<DistributionHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ code: '', name: '', distributorId: '', sourceReference: '' });
  const [saving, setSaving] = useState(false);
  const refresh = async () => {
    setLoading(true); setError('');
    try { setData(await loadDistributionHub()); } catch (cause) { setError(cause instanceof Error ? cause.message : '渠道与分销数据暂时无法读取'); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const channel = await createDistributionChannel(form);
      setData((current) => current ? { ...current, channels: [channel, ...current.channels] } : current);
      setForm({ code: '', name: '', distributorId: '', sourceReference: '' });
      setNotice('渠道资料已保存为待配置状态；不会产生佣金或结算。');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '渠道资料保存失败'); } finally { setSaving(false); }
  };
  return <section className="mx-auto max-w-[1600px] space-y-5 p-6">
    <header className="rounded-2xl bg-gradient-to-r from-[#10233e] to-[#16655b] px-6 py-5 text-white shadow-lg"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Channel & Distribution</p><h1 className="mt-1 text-xl font-black">渠道与分销系统</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">展示服务端登记的渠道资料、实际订单归因与佣金处理状态。结算写入未开放，任何未接入数据均保持空状态。</p></div><button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />刷新真实数据</button></div></header>
    {error && <Message tone="error">{error}</Message>}{notice && <Message tone="success">{notice}</Message>}
    {loading ? <Loading /> : data ? <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><GitBranch className="h-4 w-4 text-emerald-600" />渠道资料</h2><p className="mt-1 text-xs text-slate-500">渠道与分销商范围以服务器记录为准，不根据前端权限标签虚构渠道数据。</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{data.channels.length} 个真实记录</span></div>
        {data.channels.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="border-b text-xs text-slate-500"><tr><th className="px-3 py-3">渠道</th><th className="px-3 py-3">编码</th><th className="px-3 py-3">分销范围</th><th className="px-3 py-3">状态</th><th className="px-3 py-3">来源参考</th></tr></thead><tbody className="divide-y">{data.channels.map((channel) => <tr key={channel.id}><td className="px-3 py-3 font-semibold text-slate-800">{channel.name}</td><td className="px-3 py-3 font-mono text-xs text-slate-600">{channel.code}</td><td className="px-3 py-3 text-slate-600">{channel.distributorId ?? '未绑定分销范围'}</td><td className="px-3 py-3"><Status value={channel.status} /></td><td className="px-3 py-3 text-slate-600">{channel.sourceReference || '未登记'}</td></tr>)}</tbody></table></div> : <Empty label="尚未登记渠道资料。不会以示例渠道替代真实数据。" />}
        {data.capabilities.canManageChannels && <form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-3 border-t pt-5 md:grid-cols-2 xl:grid-cols-5"><Field label="渠道编码" value={form.code} onChange={(value) => setForm({ ...form, code: value })} placeholder="例如 NORTH_01" required /><Field label="渠道名称" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="已确认的渠道名称" required /><Field label="分销范围 ID（可选）" value={form.distributorId} onChange={(value) => setForm({ ...form, distributorId: value })} placeholder="服务器已有分销范围" /><Field label="来源参考（可选）" value={form.sourceReference} onChange={(value) => setForm({ ...form, sourceReference: value })} placeholder="合同或接入单号" /><button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50"><CirclePlus className="h-4 w-4" />{saving ? '正在保存' : '登记渠道'}</button></form>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-bold text-slate-900">渠道订单与佣金状态</h2><p className="mt-1 text-xs text-slate-500">仅显示已写入服务端的订单归因和处理状态；不展示或生成分佣金额，也不提供结算操作。</p>{data.orderAttributions.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-[700px] w-full text-left text-sm"><thead className="border-b text-xs text-slate-500"><tr><th className="px-3 py-3">订单</th><th className="px-3 py-3">渠道</th><th className="px-3 py-3">订单状态</th><th className="px-3 py-3">佣金状态</th><th className="px-3 py-3">记录时间</th></tr></thead><tbody className="divide-y">{data.orderAttributions.map((item) => <tr key={item.id}><td className="px-3 py-3 font-mono text-xs text-slate-700">{item.orderNo}</td><td className="px-3 py-3 text-slate-700">{item.channelName}</td><td className="px-3 py-3 text-slate-600">{item.orderStatus}</td><td className="px-3 py-3"><Status value={item.commissionStatus} /></td><td className="px-3 py-3 text-slate-500">{formatDate(item.recordedAt)}</td></tr>)}</tbody></table></div> : <Empty label="暂无服务端订单归因记录；佣金数据未接入，暂不可操作。" />}</section>
    </> : <Empty label="未取得渠道与分销数据。请确认当前账号的订单或租户管理权限。" />}
  </section>;
}
function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) { return <label className="text-xs font-semibold text-slate-700">{label}<input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-emerald-500" /></label>; }
function Status({ value }: { value: string }) { return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{({ pending_setup: '待配置', active: '已启用', paused: '已暂停', disabled: '已停用', not_ready: '未具备条件', pending_source: '待来源确认', calculated: '已计算待复核', locked: '已锁定' } as Record<string, string>)[value] ?? value}</span>; }
function Message({ tone, children }: { tone: 'error' | 'success'; children: string }) { return <p className={`rounded-xl border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</p>; }
function Loading() { return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">正在读取服务端渠道数据…</div>; }
function Empty({ label }: { label: string }) { return <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500"><ShieldAlert className="mx-auto mb-2 h-5 w-5 text-slate-400" />{label}</div>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN'); }
