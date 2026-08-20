import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDollarSign, ExternalLink, Loader2, Package, PackagePlus, RefreshCw, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { Product } from '../../types';
import { getWhyouyeIntegrationStatus, type WhyouyeIntegrationStatus } from '../../services/whyouyeProductPool';
import { PARTNER_SOURCES, CAMPAIGNS, DEFAULT_SOURCE, productSource, money, margin } from './productSourcePool';
import type { SourceKey, CampaignKey } from './productSourcePool';

import { PoolWriteDialog } from './PoolWriteDialog';

export function ProductSourcePoolWorkstation({ products, isLiveCatalog, onOpenGovernance }: { products: Product[]; isLiveCatalog: boolean; onOpenGovernance: () => void }) {
  const [sourceKey, setSourceKey] = useState<SourceKey>('all');
  const [campaign, setCampaign] = useState<CampaignKey>('精选商品池');
  const [search, setSearch] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [stockOnly, setStockOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [writeOpen, setWriteOpen] = useState(false);
  const [status, setStatus] = useState<WhyouyeIntegrationStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);

  const selectedSource = PARTNER_SOURCES.find((source) => source.key === sourceKey) ?? DEFAULT_SOURCE;
  const records = useMemo(() => {
    const minimum = Number(priceRange.min);
    const maximum = Number(priceRange.max);
    const keyword = search.trim().toLowerCase();
    return products.filter((product) => {
      if (sourceKey !== 'all' && productSource(product) !== sourceKey) return false;
      if (stockOnly && product.stock <= 0) return false;
      if (priceRange.min && (!Number.isFinite(minimum) || product.enterprisePrice < minimum)) return false;
      if (priceRange.max && (!Number.isFinite(maximum) || product.enterprisePrice > maximum)) return false;
      return !keyword || `${product.title} ${product.spuCode} ${product.brand} ${product.supplierName}`.toLowerCase().includes(keyword);
    });
  }, [priceRange.max, priceRange.min, products, search, sourceKey, stockOnly]);

  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));

  const refreshStatus = () => {
    setStatusLoading(true);
    setStatusError('');
    void getWhyouyeIntegrationStatus()
      .then(setStatus)
      .catch((error: unknown) => setStatusError(error instanceof Error ? error.message : '无法读取甲方对接状态'))
      .finally(() => setStatusLoading(false));
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const toggleAll = () => setSelectedIds((current) => (current.length === records.length ? [] : records.map((product) => product.id)));
  const toggleProduct = (id: string) => setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const openWrite = () => setWriteOpen(true);

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#10161f] text-slate-100 shadow-2xl overflow-hidden">
      <header className="border-b border-slate-800 px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Package className="h-4 w-4 text-blue-400" /> 商品来源与甲方商品池
            </div>
            <p className="mt-1 text-xs text-slate-400">对标甲方的多来源商品页：本地目录治理、候选商品筛选、批量预演与受控写入在同一工作台完成。</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {statusLoading ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                检查对接状态
              </span>
            ) : status?.capabilities.generalPoolEnroll ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950/60 px-2.5 py-1 text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                甲方商品池可写入
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-800 bg-amber-950/40 px-2.5 py-1 text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                可预演，待配置生产凭证
              </span>
            )}
            <button onClick={refreshStatus} className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800" title="刷新对接状态">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {PARTNER_SOURCES.map((source) => (
            <button
              key={source.key}
              onClick={() => {
                setSourceKey(source.key);
                setSelectedIds([]);
              }}
              className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold transition ${sourceKey === source.key ? 'border-blue-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[10px] text-blue-300">{source.shortName}</span>
              {source.name}
            </button>
          ))}
        </div>
      </header>

      <div className="border-b border-slate-800 bg-[#131c28] p-4">
        <div className="grid min-w-[900px] grid-cols-6 gap-3">
          {CAMPAIGNS.map((item) => (
            <button
              key={item.key}
              onClick={() => setCampaign(item.key)}
              className={`rounded-xl border px-3 py-3 text-center transition ${campaign === item.key ? 'border-blue-500 bg-blue-700/80 text-white shadow-lg shadow-blue-950/40' : 'border-slate-700 bg-[#111820] text-slate-200 hover:border-slate-500'}`}
            >
              <div className="text-xs font-bold">{item.key}</div>
              <div className="mt-1 text-[11px] text-slate-400">{item.subline}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-blue-300" />
          当前专区：<span className="font-semibold text-slate-200">{campaign}</span>；专区策略只作为运营视图，正式入池以甲方返回结果为准。
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-400">渠道：</span>
          <span className="font-bold text-blue-300">{selectedSource.name}</span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">当前授权目录 {records.length} 件</span>
          {isLiveCatalog && <span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-2 py-0.5 text-[11px] text-emerald-300">生产目录实时读取</span>}
        </div>
        {statusError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-900 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            {statusError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#111820] px-3 py-2 text-xs text-slate-300">
            <Search className="h-4 w-4 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-600" placeholder="商品名称 / SPU / 品牌" />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#111820] px-3 py-2 text-xs text-slate-300">
            <CircleDollarSign className="h-4 w-4 text-slate-500" />
            <input
              value={priceRange.min}
              onChange={(event) => setPriceRange((current) => ({ ...current, min: event.target.value }))}
              inputMode="decimal"
              className="w-full bg-transparent outline-none placeholder:text-slate-600"
              placeholder="商城价最低"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#111820] px-3 py-2 text-xs text-slate-300">
            <CircleDollarSign className="h-4 w-4 text-slate-500" />
            <input
              value={priceRange.max}
              onChange={(event) => setPriceRange((current) => ({ ...current, max: event.target.value }))}
              inputMode="decimal"
              className="w-full bg-transparent outline-none placeholder:text-slate-600"
              placeholder="商城价最高"
            />
          </label>
          <button
            onClick={() => setStockOnly((current) => !current)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${stockOnly ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 bg-[#111820] text-slate-300'}`}
          >
            仅看有货
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSearch('');
                setPriceRange({ min: '', max: '' });
                setStockOnly(false);
              }}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              重置
            </button>
            <button onClick={openWrite} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">
              <PackagePlus className="h-3.5 w-3.5" />
              批量加入
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-[1120px] w-full text-left text-xs">
            <thead className="bg-[#17202b] text-slate-300">
              <tr>
                <th className="w-12 px-4 py-4 text-center">
                  <input type="checkbox" checked={records.length > 0 && selectedIds.length === records.length} onChange={toggleAll} />
                </th>
                <th className="px-4 py-4">商品</th>
                <th className="px-4 py-4">SPU</th>
                <th className="px-4 py-4 text-right">市场参考价</th>
                <th className="px-4 py-4 text-right">商城价</th>
                <th className="px-4 py-4 text-right">参考毛利率</th>
                <th className="px-4 py-4 text-right">库存</th>
                <th className="px-4 py-4">商品来源</th>
                <th className="px-4 py-4">目录状态</th>
                <th className="px-4 py-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-[#10161f]">
              {records.map((product) => (
                <tr key={product.id} className="hover:bg-slate-800/50">
                  <td className="px-4 py-4 text-center">
                    <input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800">
                        {product.mainImage ? <img src={product.mainImage} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-slate-500" />}
                      </div>
                      <div className="max-w-[300px]">
                        <div className="line-clamp-2 font-semibold text-slate-100">{product.title}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{product.supplierName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{product.spuCode}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{money(product.costPrice)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{money(product.enterprisePrice)}</td>
                  <td className="px-4 py-3 text-right text-emerald-300">{margin(product)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${product.stock > 0 ? 'text-slate-200' : 'text-rose-300'}`}>{product.stock > 0 ? `${product.stock} 件` : '缺货'}</td>
                  <td className="px-4 py-3 text-slate-300">{PARTNER_SOURCES.find((source) => source.key === productSource(product))?.name ?? '平台商品2.0'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-1 ${product.status === '已发布' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{product.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={onOpenGovernance} className="text-blue-300 hover:text-blue-200">
                      治理详情
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center text-slate-500">
                    没有符合条件的授权商品
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>显示 {records.length} 件商品；甲方源目录读取与文件导入待甲方确认正式读取协议后启用。</span>
          <button onClick={onOpenGovernance} className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200">
            进入生命周期治理 <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {writeOpen && (
        <PoolWriteDialog
          selectedProducts={selectedProducts}
          source={selectedSource.source ?? DEFAULT_SOURCE.source!}
          ready={status?.capabilities.generalPoolEnroll === true}
          jdVopReady={status?.capabilities.jdVopPoolEnroll === true}
          onClose={() => setWriteOpen(false)}
        />
      )}
    </section>
  );
}
