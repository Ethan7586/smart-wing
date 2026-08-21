import { FormEvent, useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, Save, Settings2, ShieldCheck } from 'lucide-react';
import { loadControlCenter, saveControlSettings, type ControlCenterData } from '../../services/operationsMvp';

export function ControlCenterWorkstation() {
  const [data, setData] = useState<ControlCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [operationsNotice, setOperationsNotice] = useState('');
  const [threshold, setThreshold] = useState('0');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await loadControlCenter();
      setData(next);
      setOperationsNotice(next.settings.operationsNotice ?? '');
      setThreshold(String(next.settings.orderAttentionThreshold ?? 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '中控数据暂时无法读取');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!data) return;
    const number = Number(threshold);
    if (!Number.isSafeInteger(number) || number < 0 || number > 100000) {
      setError('订单关注阈值必须是 0 到 100000 之间的整数。');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const settings = await saveControlSettings({ expectedVersion: data.settings.version, operationsNotice, orderAttentionThreshold: number });
      setData({ ...data, settings });
      setNotice('配置已由服务端持久化。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '中控配置保存失败');
    } finally {
      setSaving(false);
    }
  };

  const sales = data?.sales ?? {};
  return (
    <section className="mx-auto max-w-[1600px] space-y-5 p-6">
      <header className="rounded-2xl bg-gradient-to-r from-slate-950 to-[#16418e] px-6 py-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200">Smart Wing Control Center</p>
            <h1 className="mt-1 text-xl font-black">智慧翼中控台</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">读取当前授权范围内的订单与商品经营汇总；配置只有在服务端确认写入后才会显示为已保存。</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 刷新真实数据
          </button>
        </div>
      </header>

      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="success">{notice}</Message>}
      {loading ? <Loading /> : data ? <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="累计净交易额" value={currency(sales.cumulativeSalesCents)} note="当前授权范围的已支付订单扣除成功退款" icon={Activity} />
          <Metric label="已支付订单" value={integer(sales.paidOrderCount)} note="数据由订单读取模型返回" icon={Database} />
          <Metric label="近 30 日交易额" value={currency(sales.periodSalesCents)} note="按支付日期汇总" icon={Activity} />
          <Metric label="有效商品" value={integer(sales.activeProductCount)} note="当前商城已发布商品" icon={Database} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Settings2 className="h-4 w-4 text-blue-600" /> 运营配置</h2>
              <p className="mt-1 text-xs text-slate-500">配置版本：{data.settings.configured ? `v${data.settings.version}` : '尚未配置'}；不会在浏览器内存中伪造保存状态。</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${data.settings.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{data.settings.configured ? '已持久化' : '尚未持久化'}</span>
          </div>
          {data.capabilities.canManageSettings ? (
            <form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px_auto] lg:items-end">
              <label className="block text-xs font-semibold text-slate-700">运营提示
                <textarea value={operationsNotice} onChange={(event) => setOperationsNotice(event.target.value)} maxLength={600} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500" placeholder="仅填写已确认的运营提示" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">订单关注阈值
                <input value={threshold} onChange={(event) => setThreshold(event.target.value)} inputMode="numeric" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500" />
              </label>
              <button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1769ff] px-4 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? '正在保存' : '保存配置'}</button>
            </form>
          ) : <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"><ShieldCheck className="mr-2 inline h-4 w-4 text-slate-500" />当前身份仅可读取中控数据，不能修改运营配置。</p>}
        </section>
      </> : <Empty label="未取得中控数据。请确认当前账号的订单、商品和数据范围授权。" />}
    </section>
  );
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Activity }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-xs text-slate-500"><span>{label}</span><Icon className="h-4 w-4 text-blue-600" /></div><strong className="mt-2 block text-2xl text-slate-900">{value}</strong><p className="mt-1 text-[11px] leading-5 text-slate-500">{note}</p></article>;
}
function Message({ tone, children }: { tone: 'error' | 'success'; children: string }) { return <p className={`rounded-xl border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</p>; }
function Loading() { return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">正在读取当前授权范围的中控数据…</div>; }
function Empty({ label }: { label: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{label}</div>; }
function integer(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('zh-CN') : '—'; }
function currency(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? `¥${(value / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; }
