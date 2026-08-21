import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Boxes, CheckCircle2, CircleAlert, CircleDashed, Database, Link2, Plus, RefreshCw, ScanSearch, ShieldAlert, Workflow } from 'lucide-react';
import { createPartnerCatalogConnection, loadPartnerCatalogHub, type PartnerCatalogConnection, type PartnerCatalogHubData, type PartnerCatalogSyncRun } from '../../services/operationsMvp';

type ChannelDefinition = {
  code: string;
  name: string;
  group: string;
  aliases: string[];
  capability: string;
  readinessNote?: string;
};

export type ChannelCatalogCard = ChannelDefinition & {
  connection: PartnerCatalogConnection | null;
  successfulSyncs: number;
};

const CHANNEL_DEFINITIONS: readonly ChannelDefinition[] = [
  { code: 'jd', name: '京东', group: '实物商品', aliases: ['jd', 'jingdong', '京东'], capability: '商品检索、价格与库存同步' },
  { code: 'jd-fresh', name: '京东生鲜', group: '实物商品', aliases: ['jd-fresh', 'jdfresh', '京东生鲜'], capability: '生鲜商品、区域与履约同步' },
  { code: 'tmall', name: '天猫超市', group: '实物商品', aliases: ['tmall', '天猫', '天猫超市'], capability: '商品检索、价格与库存同步' },
  { code: 'gift', name: '礼贸通', group: '礼品商品', aliases: ['gift', 'limaitong', '礼贸通'], capability: '礼品目录、报价与订单回传' },
  { code: 'voucher-card', name: '平台虚拟卡券', group: '虚拟商品', aliases: ['voucher-card', 'card', '虚拟卡券'], capability: '卡券目录、发券与核销状态' },
  { code: 'voucher-recharge', name: '平台虚拟直充', group: '虚拟商品', aliases: ['voucher-recharge', 'recharge', '虚拟直充'], capability: '直充商品、下单与结果回调' },
  { code: 'voucher-gift', name: '虚拟礼包', group: '虚拟商品', aliases: ['voucher-gift', 'gift-package', '虚拟礼包'], capability: '礼包组合、发放与状态查询' },
  {
    code: 'cake-uncle',
    name: '蛋糕叔叔',
    group: '本地生活',
    aliases: ['cake-uncle', 'dgss', 'fresh-gift', 'cake', 'flower', '蛋糕叔叔', '蛋糕', '鲜花'],
    capability: '商品目录、价格库存、配送范围与可约时段（先仅读同步）',
    readinessNote: '测试环境与签名规则已登记；待服务端安全配置凭据并以实际响应完成验收。',
  },
  { code: 'book', name: '图书', group: '图书商品', aliases: ['book', 'winxuan', '图书', '文轩'], capability: '图书目录、库存与订单回传' },
];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-/]+/g, '');
}

export function buildChannelCatalogCards(connections: readonly PartnerCatalogConnection[], syncRuns: readonly PartnerCatalogSyncRun[]): ChannelCatalogCard[] {
  return CHANNEL_DEFINITIONS.map((definition) => {
    const aliases = new Set(definition.aliases.map(normalize));
    const connection = connections.find((item) => aliases.has(normalize(item.providerCode)) || aliases.has(normalize(item.displayName))) ?? null;
    return {
      ...definition,
      connection,
      successfulSyncs: connection ? syncRuns.filter((run) => run.connectionId === connection.id && run.status === 'succeeded').length : 0,
    };
  });
}

export function PartnerCatalogWorkstation() {
  const [data, setData] = useState<PartnerCatalogHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ providerCode: '', displayName: '', externalCatalogReference: '' });
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadPartnerCatalogHub());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '渠道商品池数据暂时无法读取');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const channelCards = useMemo(() => buildChannelCatalogCards(data?.connections ?? [], data?.syncRuns ?? []), [data]);
  const successfulSyncCount = data?.syncRuns.filter((run) => run.status === 'succeeded').length ?? 0;
  const actualSkuCount = data?.catalogPools.reduce((total, pool) => total + pool.itemCount, 0) ?? 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const connection = await createPartnerCatalogConnection(form);
      setData((current) => (current ? { ...current, connections: [connection, ...current.connections] } : current));
      setForm({ providerCode: '', displayName: '', externalCatalogReference: '' });
      setNotice('接入资料已保存为待配置状态；尚未连接外部目录，也未触发导入。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '接入资料保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1680px] space-y-5 p-6">
      <header className="rounded-3xl bg-gradient-to-br from-[#102a5a] via-[#164b95] to-[#157c9f] px-6 py-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Channel Catalog Operations</p>
            <h1 className="mt-1 text-2xl font-black">渠道商品池</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-cyan-50">统一管理商品源、商城商品池与接入证据。页面只展示服务端真实记录：没有凭据、同步日志或订单回传的渠道不会被标成已接通。</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />刷新真实数据
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="已登记渠道" value={data?.connections.length ?? 0} hint="服务端接入资料" />
          <Metric label="成功同步" value={successfulSyncCount} hint="仅计实际同步运行" />
          <Metric label="商城商品池" value={data?.catalogPools.length ?? 0} hint="当前授权范围" />
          <Metric label="真实 SKU" value={actualSkuCount} hint="来自现有商品池" />
        </div>
      </header>

      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="success">{notice}</Message>}
      {loading ? <Loading /> : data ? <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Boxes className="h-4 w-4 text-blue-600" />渠道能力地图</h2>
              <p className="mt-1 text-xs text-slate-500">渠道名来自已确认的功能清单；状态来自当前服务端连接与同步记录，不以页面配置或示例数据替代真实接口。</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{channelCards.length} 个规划渠道</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {channelCards.map((channel) => <ChannelCard key={channel.code} channel={channel} />)}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Database className="h-4 w-4 text-blue-600" />当前商城商品池</h2>
            <p className="mt-1 text-xs text-slate-500">这是当前授权范围内的真实商品池。商品治理、上下架与发布由“商品治理台”执行。</p>
            {data.catalogPools.length ? <div className="mt-4 divide-y divide-slate-100">{data.catalogPools.map((pool) => <div key={pool.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-sm text-slate-800">{pool.name}</strong><p className="mt-1 font-mono text-xs text-slate-500">{pool.code}</p></div><div className="text-right"><p className="text-sm font-bold text-slate-800">{pool.itemCount} 个 SKU</p><p className="mt-1 text-xs text-slate-500">{pool.status}</p></div></div>)}</div> : <Empty label="当前授权范围内尚无商品池记录。" />}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Workflow className="h-4 w-4 text-blue-600" />接通验收标准</h2>
            <p className="mt-1 text-xs text-slate-500">每一家外部渠道都要留下可复验的证据，才能从“待配置”进入可运营状态。</p>
            <ol className="mt-4 space-y-3">{['登记服务商与目录范围', '服务端安全配置凭据', '商品/价格/库存同步验证', '下单与履约回传验证', '异常、重试与审计留痕'].map((step, index) => <li key={step} className="flex gap-3 text-sm text-slate-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{index + 1}</span><span className="pt-0.5">{step}</span></li>)}</ol>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Link2 className="h-4 w-4 text-blue-600" />接入配置</h2>
          <p className="mt-1 text-xs text-slate-500">只登记公开的服务商编码、显示名称与目录参考；密钥只能由服务端安全配置，页面不会接收或显示。</p>
          {data.connections.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.connections.map((connection) => <article key={connection.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">{connection.displayName}</h3><p className="mt-1 font-mono text-xs text-slate-500">{connection.providerCode}</p></div><Status value={connection.status} /></div><p className="mt-3 text-xs text-slate-600">目录参考：{connection.externalCatalogReference || '未登记'}</p><p className="mt-1 text-xs text-slate-500">最近检查：{formatDate(connection.lastCheckedAt)}</p></article>)}</div> : <Empty label="尚未登记外部商品源；不会用示例连接或虚构同步记录替代真实信息。" />}
          {data.capabilities.canManageConnections && <form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-2 xl:grid-cols-4"><Field label="服务商编码" value={form.providerCode} onChange={(value) => setForm({ ...form, providerCode: value })} placeholder="例如 jd 或 partner_catalog" required /><Field label="显示名称" value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} placeholder="已确认的服务商名称" required /><Field label="外部目录参考（可选）" value={form.externalCatalogReference} onChange={(value) => setForm({ ...form, externalCatalogReference: value })} placeholder="目录 ID 或接入单号" /><button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? '正在保存' : '登记接入配置'}</button></form>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><ScanSearch className="h-4 w-4 text-blue-600" />导入与同步记录</h2>
          <p className="mt-1 text-xs text-slate-500">只展示实际写入的同步运行记录。未配置外部凭据或同步作业时，这里保持空状态。</p>
          {data.syncRuns.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.syncRuns.map((run) => <article key={run.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-800">{run.displayName}</strong><Status value={run.status} /></div><p className="mt-3 text-xs text-slate-600">来源 {run.sourceItemCount ?? '—'} 项 · 已导入 {run.importedItemCount ?? '—'} 项</p>{run.message && <p className="mt-1 text-xs text-slate-500">{run.message}</p>}</article>)}</div> : <Empty label="暂无实际同步记录；待服务端凭据、同步作业和渠道验收完成后产生。" />}
        </section>
      </> : <Empty label="未取得渠道商品池数据。请确认当前账号的商品或商业资源权限。" />}
    </section>
  );
}

function ChannelCard({ channel }: { channel: ChannelCatalogCard }) {
  const detail = channel.connection ? connectionDetail(channel.connection, channel.successfulSyncs) : { label: '待登记', description: '尚未保存服务端接入资料', tone: 'pending' as const };
  const Icon = detail.tone === 'active' ? CheckCircle2 : detail.tone === 'pending' ? CircleDashed : CircleAlert;
  return <article className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-slate-400">{channel.group}</p><h3 className="mt-1 text-base font-bold text-slate-900">{channel.name}</h3></div><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${detail.tone === 'active' ? 'bg-emerald-50 text-emerald-700' : detail.tone === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}><Icon className="h-3.5 w-3.5" />{detail.label}</span></div><p className="mt-3 text-xs leading-5 text-slate-600">{channel.capability}</p>{channel.readinessNote && <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">{channel.readinessNote}</p>}<p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{detail.description}</p></article>;
}

function connectionDetail(connection: PartnerCatalogConnection, successfulSyncs: number): { label: string; description: string; tone: 'active' | 'pending' | 'warning' } {
  if (connection.status === 'active') return successfulSyncs > 0 ? { label: '已验证同步', description: `已留存 ${successfulSyncs} 条成功同步记录`, tone: 'active' } : { label: '已启用', description: '接入记录已启用，等待同步验收记录', tone: 'pending' };
  if (connection.status === 'error') return { label: '异常待处理', description: '接入资料存在异常，已阻断外部同步', tone: 'warning' };
  if (connection.status === 'disabled') return { label: '已停用', description: '该渠道已登记，但当前不参与同步', tone: 'warning' };
  return { label: connection.status === 'awaiting_approval' ? '待审批' : '待配置', description: '接入资料已登记，等待服务端凭据与验收', tone: 'pending' };
}

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"><p className="text-xs text-cyan-100">{label}</p><p className="mt-1 text-2xl font-black">{value.toLocaleString('zh-CN')}</p><p className="mt-1 text-[11px] text-cyan-100/80">{hint}</p></div>;
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return <label className="text-xs font-semibold text-slate-700">{label}<input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500" /></label>;
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { pending_credentials: '待配置服务端凭据', awaiting_approval: '待审批', active: '已启用', disabled: '已停用', error: '异常待处理', queued: '已排队', running: '运行中', succeeded: '已完成', failed: '失败', blocked: '已阻断' };
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{labels[value] ?? value}</span>;
}

function Message({ tone, children }: { tone: 'error' | 'success'; children: string }) {
  return <p className={`rounded-xl border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</p>;
}

function Loading() {
  return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">正在读取渠道商品池配置…</div>;
}

function Empty({ label }: { label: string }) {
  return <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500"><ShieldAlert className="mx-auto mb-2 h-5 w-5 text-slate-400" />{label}</div>;
}

function formatDate(value: string | null) {
  if (!value) return '尚未检查';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN');
}
