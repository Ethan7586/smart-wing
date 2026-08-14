import React from 'react';
import { Building2, Layers3, MapPinned, Plus, ShieldCheck, ShoppingCart, Store, Tags } from 'lucide-react';
import type { QualificationCenterData, QualificationConfigKind } from '../../services/qualification';

type OpenEditor = (kind: QualificationConfigKind, entity?: object | null) => void;
type Row = { id: string; title: string; meta: string; status: string; edit: () => void };

export function QualificationCenterSections({ data, open }: { data: QualificationCenterData; open: OpenEditor }) {
  return (
    <>
      {(data.capabilities.readCommercialResources || data.capabilities.manageCommercialResources) && <CommercialSection data={data} open={open} />}
      {(data.capabilities.readCommercialResources || data.capabilities.manageCommercialResources) && (
        <Panel title="商城商品池" subtitle="资格策略可以直接引用商品池；发布的商品池至少包含一个 SKU" icon={Layers3} action={data.capabilities.manageCommercialResources ? <Add onClick={() => open('catalog_pool')}>新建商品池</Add> : null}>
          <EntityGrid
            empty="尚无商品池"
            rows={data.catalogPools.map((item) => ({ id: item.id, title: item.name, meta: `${item.kind === 'selected' ? '精选池' : '组合池'} · ${item.itemCount} 个 SKU`, status: item.status, edit: () => open('catalog_pool', item) }))}
            canEdit={data.capabilities.manageCommercialResources}
          />
        </Panel>
      )}
      {(data.capabilities.readEntitlements || data.capabilities.manageEntitlements) && <EntitlementSections data={data} open={open} />}
      {(data.capabilities.readPurchaseLimits || data.capabilities.managePurchaseLimits) && (
        <Panel title="限售模板" subtitle="支持 SKU/SPU 的单次、日、月、生命周期数量与金额上限" icon={ShoppingCart} action={data.capabilities.managePurchaseLimits ? <Add onClick={() => open('purchase_limit')}>新建限售模板</Add> : null}>
          <EntityGrid
            empty="尚未配置限售模板"
            rows={data.limitTemplates.map((item) => ({
              id: item.id,
              title: item.name,
              meta: `${item.countScope.toUpperCase()} · 单次 ${item.maxPerOrderQty ?? '不限'} · 每日 ${item.maxDailyQty ?? '不限'} · 每月 ${item.maxMonthlyQty ?? '不限'} · 累计 ${item.maxLifetimeQty ?? '不限'}`,
              status: item.status,
              edit: () => open('purchase_limit', item),
            }))}
            canEdit={data.capabilities.managePurchaseLimits}
          />
        </Panel>
      )}
    </>
  );
}

function CommercialSection({ data, open }: { data: QualificationCenterData; open: OpenEditor }) {
  const canEdit = data.capabilities.manageCommercialResources;
  return (
    <Panel
      title="商业资源关系"
      subtitle="供应商供货协议 → 品牌 → 门店；品牌还需明确授权给当前商城"
      icon={Building2}
      action={
        canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Add onClick={() => open('supplier_agreement')}>供应商协议</Add>
            <Add onClick={() => open('brand')}>品牌</Add>
            <Add onClick={() => open('store')}>门店</Add>
          </div>
        ) : null
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MiniStat label="品牌" value={data.commercialSummary.brands} icon={Tags} />
        <MiniStat label="门店" value={data.commercialSummary.stores} icon={Store} />
        <MiniStat label="有效供货协议" value={data.commercialSummary.supplierAgreements} icon={Building2} />
        <MiniStat label="商城品牌授权" value={data.commercialSummary.brandAuthorizations} icon={ShieldCheck} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <EntityList
          title="供货协议"
          empty="尚无商城供货协议"
          rows={data.commercialResources.agreements.map((item) => ({
            id: item.id,
            title: item.agreementCode,
            meta: `${nameOf(data.selectors.suppliers, item.supplierId)} · ${item.settlementMode}`,
            status: item.status,
            edit: () => open('supplier_agreement', item),
          }))}
          canEdit={canEdit}
        />
        <EntityList
          title="品牌关系"
          empty="尚无品牌"
          rows={data.commercialResources.brands.map((item) => ({
            id: item.id,
            title: item.name,
            meta: `${item.supplierIds.length} 个供应商 · ${item.productIds.length} 个商品${item.authorizedInMall ? ' · 已授权本商城' : ''}`,
            status: item.status,
            edit: () => open('brand', item),
          }))}
          canEdit={canEdit}
        />
        <EntityList
          title="门店关系"
          empty="尚无门店"
          rows={data.commercialResources.stores.map((item) => ({ id: item.id, title: item.name, meta: `${storeType(item.storeType)} · ${item.brandIds.length} 个品牌`, status: item.status, edit: () => open('store', item) }))}
          canEdit={canEdit}
        />
      </div>
    </Panel>
  );
}

function EntitlementSections({ data, open }: { data: QualificationCenterData; open: OpenEditor }) {
  const canEdit = data.capabilities.manageEntitlements;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="城市专区" subtitle="把城市与商品绑定，可分别控制目录可见和收货城市可买" icon={MapPinned} action={canEdit ? <Add onClick={() => open('city_zone')}>新建城市专区</Add> : null}>
        <EntityList
          empty="尚无城市专区；现有商品不受城市限制"
          rows={data.cityZones.map((item) => ({ id: item.id, title: item.name, meta: `${item.cityCount} 个城市 · ${item.itemCount} 个商品范围 · ${appliesTo(item.appliesTo)}`, status: item.status, edit: () => open('city_zone', item) }))}
          canEdit={canEdit}
        />
      </Panel>
      <Panel title="可见与可买策略" subtitle="明确拒绝优先；存在允许规则时，员工必须命中一条允许" icon={ShieldCheck} action={canEdit ? <Add onClick={() => open('entitlement_policy')}>新建资格策略</Add> : null}>
        <EntityList
          empty="尚无资格策略；商品按商业关系开放"
          rows={data.policies.map((item) => ({
            id: item.id,
            title: item.name,
            meta: `${item.action === 'visible' ? '可见' : '可买'} · ${item.effect === 'deny' ? '明确拒绝' : '允许'} · ${item.subjectCount} 个员工范围 · ${item.resourceCount} 个商品范围`,
            status: item.status,
            edit: () => open('entitlement_policy', item),
          }))}
          canEdit={canEdit}
        />
      </Panel>
    </div>
  );
}

function Panel({ title, subtitle, icon: Icon, action, children }: { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="rounded-lg bg-blue-50 p-2 text-[var(--sw-brand)]">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">{title}</h2>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
function EntityList({ title, rows, empty, canEdit }: { title?: string; rows: Row[]; empty: string; canEdit: boolean }) {
  return (
    <div>
      {title && <h3 className="mb-2 text-xs font-bold text-slate-700">{title}</h3>}
      <div className="max-h-72 space-y-2 overflow-y-auto">{rows.length ? rows.map((row) => <Entity key={row.id} row={row} canEdit={canEdit} />) : <p className="py-6 text-center text-xs text-slate-400">{empty}</p>}</div>
    </div>
  );
}
function EntityGrid({ rows, empty, canEdit }: { rows: Row[]; empty: string; canEdit: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.length ? rows.map((row) => <Entity key={row.id} row={row} canEdit={canEdit} card />) : <p className="col-span-full py-6 text-center text-xs text-slate-400">{empty}</p>}
    </div>
  );
}
function Entity({ row, canEdit, card = false }: { row: Row; canEdit: boolean; card?: boolean }) {
  return (
    <button
      onClick={canEdit ? row.edit : undefined}
      disabled={!canEdit}
      className={`${card ? 'rounded-xl border-slate-200 p-3' : 'rounded-lg border-slate-100 px-3 py-2'} flex w-full items-center justify-between border text-left hover:border-blue-300 hover:bg-slate-50 disabled:cursor-default`}
    >
      <span>
        <b className="block text-xs text-slate-800">{row.title}</b>
        <small className="text-[10px] text-slate-500">{row.meta}</small>
      </span>
      <Status value={row.status} />
    </button>
  );
}
function Add({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">
      <Plus className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <strong className="mt-1 block text-lg text-slate-900">{value}</strong>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] ${value === 'active' ? 'bg-emerald-50 text-emerald-700' : value === 'draft' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
      {value === 'active' ? '生效中' : value === 'draft' ? '草稿' : '已停用'}
    </span>
  );
}
const nameOf = (options: Array<{ id: string; name: string }>, id: string) => options.find((item) => item.id === id)?.name ?? id;
const storeType = (value: string) => (value === 'online' ? '线上' : value === 'offline' ? '线下' : '线上 + 线下');
const appliesTo = (value: string) => (value === 'visible' ? '控制可见' : value === 'purchasable' ? '控制可买' : '控制可见与可买');
