import { useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import type { Product } from '../../types';
import { enrollWhyouyeGeneralPool, enrollWhyouyeJdVopPool, type PoolPreviewResult, type WhyouyePoolSource } from '../../services/whyouyeProductPool';
import { PARTNER_SOURCES, splitProductIds } from './productSourcePool';
import type { PartnerSource } from './productSourcePool';

export function PoolWriteDialog({ selectedProducts, source, ready, jdVopReady, onClose }: { selectedProducts: Product[]; source: WhyouyePoolSource; ready: boolean; jdVopReady: boolean; onClose: () => void }) {
  const [sourceId, setSourceId] = useState<WhyouyePoolSource>(source);
  const [remoteIds, setRemoteIds] = useState(selectedProducts.map((product) => product.spuCode).join('\n'));
  const [useJdVop, setUseJdVop] = useState(false);
  const [targetPool, setTargetPool] = useState<'standard' | 'fresh'>('standard');
  const [operStatus, setOperStatus] = useState<'' | '3' | '4'>('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<PoolPreviewResult | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<'preview' | 'commit' | null>(null);
  const ids = splitProductIds(remoteIds);
  const canCommit = useJdVop ? jdVopReady : ready;

  const execute = async (mode: 'preview' | 'commit') => {
    if (ids.length === 0) {
      setError('请填写至少一个甲方商品 ID。');
      return;
    }
    if (mode === 'commit' && !acknowledged) {
      setError('请先勾选确认：本操作会写入甲方商品池。');
      return;
    }
    setSubmitting(mode);
    setError('');
    setResult(null);
    try {
      const response = useJdVop
        ? await enrollWhyouyeJdVopPool({ mode, remoteProductIds: ids, targetPool })
        : await enrollWhyouyeGeneralPool({ mode, source: sourceId, remoteProductIds: ids, ...(operStatus ? { operStatus: Number(operStatus) as 3 | 4 } : {}) });
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '请求未完成');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#10161f] text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold">
              <ShieldCheck className="h-5 w-5 text-blue-300" />
              加入甲方商品池
            </h3>
            <p className="mt-1 text-xs text-slate-400">先预演请求；只有已配置凭证、拥有发布权限并完成本次确认后，才会发送正式写入。</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5 text-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-400">
              甲方商品来源
              <select
                value={sourceId}
                onChange={(event) => setSourceId(Number(event.target.value) as WhyouyePoolSource)}
                disabled={useJdVop}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#161f2b] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {PARTNER_SOURCES.filter((item): item is PartnerSource & { source: WhyouyePoolSource } => typeof item.source === 'number').map((item) => (
                  <option key={item.key} value={item.source}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              入池后的状态
              <select
                value={operStatus}
                onChange={(event) => setOperStatus(event.target.value as '' | '3' | '4')}
                disabled={useJdVop}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#161f2b] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value="">遵循甲方当前规则</option>
                <option value="3">上架</option>
                <option value="4">下架</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-slate-400">
            甲方商品 ID <span className="text-amber-300">（请核对，Smart Wing SPU 仅作预填，未必等于甲方 ID）</span>
            <textarea
              value={remoteIds}
              onChange={(event) => setRemoteIds(event.target.value)}
              rows={5}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#161f2b] p-3 font-mono text-xs text-white outline-none focus:border-blue-500"
              placeholder="每行一个甲方商品 ID，最多 100 个"
            />
          </label>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" checked={useJdVop} onChange={(event) => setUseJdVop(event.target.checked)} />
              使用京东 VOP 专用商品池接口
            </label>
            {useJdVop && (
              <label className="mt-3 block text-xs text-slate-400">
                目标池
                <select value={targetPool} onChange={(event) => setTargetPool(event.target.value as 'standard' | 'fresh')} className="ml-2 rounded border border-slate-700 bg-[#161f2b] px-2 py-1 text-white">
                  <option value="standard">标准池</option>
                  <option value="fresh">生鲜池</option>
                </select>
              </label>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-900/70 bg-amber-950/30 p-3 text-xs text-amber-100">
            <input className="mt-0.5" type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            我已核对甲方商品 ID、来源与定价规则；点击“正式写入”将向甲方系统提交商品入池请求。
          </label>
          {!canCommit && <div className="rounded-lg border border-amber-900 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">生产凭证尚未配置，因此可执行预演，但“正式写入”已锁定。</div>}
          {error && <div className="rounded-lg border border-rose-900 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{error}</div>}
          {result && (
            <div className={`rounded-lg border p-3 text-xs ${result.mode === 'commit' ? 'border-emerald-800 bg-emerald-950/30 text-emerald-200' : 'border-blue-800 bg-blue-950/30 text-blue-100'}`}>
              <div className="font-bold">{result.mode === 'commit' ? '甲方已确认接收写入请求' : '预演完成，尚未向甲方写入'}</div>
              <div className="mt-1 font-mono text-[11px]">
                {result.endpoint} · {result.productCount} 件 · 请求 {result.requestId}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">
              关闭
            </button>
            <button
              onClick={() => void execute('preview')}
              disabled={submitting !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-700 px-4 py-2 text-xs font-bold text-blue-200 hover:bg-blue-950 disabled:opacity-50"
            >
              {submitting === 'preview' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}预演请求
            </button>
            <button
              onClick={() => void execute('commit')}
              disabled={submitting !== null || !canCommit}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting === 'commit' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}正式写入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
