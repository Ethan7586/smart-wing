import React, { useEffect, useState } from 'react';
import { Building2, Layers3, MapPinned, RefreshCw, ShieldCheck, ShoppingCart, Store, Tags } from 'lucide-react';
import { loadQualificationCenter, type QualificationCenterData } from '../../services/qualification';

const emptyData: QualificationCenterData = {
  catalogPools: [],
  cityZones: [],
  policies: [],
  limitTemplates: [],
  commercialSummary: { brands: 0, stores: 0, supplierAgreements: 0, brandAuthorizations: 0 },
  capabilities: {
    readCommercialResources: false,
    manageCommercialResources: false,
    readEntitlements: false,
    manageEntitlements: false,
    readPurchaseLimits: false,
    managePurchaseLimits: false,
  },
};

function statusText(status: string) {
  return status === 'active' ? '生效中' : status === 'draft' ? '草稿' : '已停用';
}

export const QualificationCenterWorkstation: React.FC = () => {
  const [data, setData] = useState<QualificationCenterData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    void loadQualificationCenter()
      .then(setData)
      .catch(() => setError('资格中心暂时无法读取，请稍后重试。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="p-6 space-y-5">
      <header className="rounded-2xl bg-gradient-to-r from-[var(--sw-brand-ink)] to-[var(--sw-brand-dark)] px-6 py-5 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200">Employee Qualification</p>
            <h1 className="text-xl font-black">商业资源与员工资格中心</h1>
            <p className="mt-1 text-xs text-blue-100">商品池决定“卖什么”，资格策略决定“谁能看、谁能买”，城市专区和限售模板在购物车与下单时再次校验。</p>
          </div>
          <button onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 刷新真实数据
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-4 gap-4">
        {(
          [
            ['商品池', data.catalogPools.length, Layers3, 'text-blue-600'],
            ['城市专区', data.cityZones.length, MapPinned, 'text-emerald-600'],
            ['资格策略', data.policies.length, ShieldCheck, 'text-violet-600'],
            ['限售模板', data.limitTemplates.length, ShoppingCart, 'text-amber-600'],
          ] as const
        ).map(([label, value, Icon, color]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label as string}</span>
              <Icon className={`h-4 w-4 ${color as string}`} />
            </div>
            <strong className="mt-2 block text-2xl text-slate-900">{value as number}</strong>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Panel title="商业资源关系" subtitle="供应商协议、品牌授权、门店服务关系" icon={Building2}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="品牌" value={data.commercialSummary.brands} icon={Tags} />
            <Stat label="门店" value={data.commercialSummary.stores} icon={Store} />
            <Stat label="有效供货协议" value={data.commercialSummary.supplierAgreements} icon={Building2} />
            <Stat label="品牌授权" value={data.commercialSummary.brandAuthorizations} icon={ShieldCheck} />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">供应商、品牌、门店与商城采用显式多对多关系，不会被错误压进单父级组织树。</p>
        </Panel>

        <Panel title="商城商品池" subtitle="已选、组合与上游来源池" icon={Layers3}>
          <List rows={data.catalogPools.map((pool) => ({ title: pool.name, meta: `${pool.kind} · ${pool.itemCount} 个 SKU`, status: statusText(pool.status) }))} empty="尚无商品池" />
        </Panel>

        <Panel title="城市专区" subtitle="目录可见与收货城市可买范围分开控制" icon={MapPinned}>
          <List
            rows={data.cityZones.map((zone) => ({ title: zone.name, meta: `${zone.cityCount} 个城市 · ${zone.itemCount} 个商品范围 · ${zone.appliesTo}`, status: statusText(zone.status) }))}
            empty="尚未配置城市专区；现有商品不受城市限制"
          />
        </Panel>

        <Panel title="可见与可买策略" subtitle="明确拒绝优先，同一资源有 allow 时必须命中" icon={ShieldCheck}>
          <List
            rows={data.policies.map((policy) => ({ title: policy.name, meta: `${policy.action} / ${policy.effect} · ${policy.subjectCount} 个对象 · ${policy.resourceCount} 个资源`, status: statusText(policy.status) }))}
            empty="尚未配置资格策略；现有已上架商品按商业关系开放"
          />
        </Panel>
      </div>

      <Panel title="限售模板" subtitle="支持按 SKU/SPU 的单次、日、月、生命周期数量与金额限制" icon={ShoppingCart}>
        <div className="grid grid-cols-3 gap-3">
          {data.limitTemplates.length ? (
            data.limitTemplates.map((template) => (
              <article key={template.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-slate-800">{template.name}</strong>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{statusText(template.status)}</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">范围：{template.countScope.toUpperCase()}</p>
                <p className="mt-1 text-xs text-slate-700">
                  单次 {template.maxPerOrderQty ?? '不限'} · 每日 {template.maxDailyQty ?? '不限'} · 每月 {template.maxMonthlyQty ?? '不限'} · 累计 {template.maxLifetimeQty ?? '不限'}
                </p>
              </article>
            ))
          ) : (
            <p className="col-span-3 py-6 text-center text-xs text-slate-400">尚未配置限售模板</p>
          )}
        </div>
      </Panel>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">当前阶段已开放真实读取与执行链。写入操作继续保持关闭，待配置表单、审批与审计理由一起接入后再开放，避免半成品直接修改生产规则。</div>
    </section>
  );
};

const Panel: React.FC<{ title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({ title, subtitle, icon: Icon, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-start gap-3">
      <span className="rounded-lg bg-blue-50 p-2 text-[var(--sw-brand)]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: number; icon: React.ComponentType<{ className?: string }> }> = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg bg-slate-50 p-3">
    <div className="flex items-center justify-between text-[11px] text-slate-500">
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </div>
    <strong className="mt-1 block text-lg text-slate-900">{value}</strong>
  </div>
);

const List: React.FC<{ rows: Array<{ title: string; meta: string; status: string }>; empty: string }> = ({ rows, empty }) =>
  rows.length ? (
    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
      {rows.map((row, index) => (
        <div key={`${row.title}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
          <div>
            <strong className="text-xs text-slate-800">{row.title}</strong>
            <p className="text-[10px] text-slate-500">{row.meta}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">{row.status}</span>
        </div>
      ))}
    </div>
  ) : (
    <p className="py-6 text-center text-xs text-slate-400">{empty}</p>
  );
