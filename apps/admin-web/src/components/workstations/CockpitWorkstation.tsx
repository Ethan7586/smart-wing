import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, RotateCw, Sparkles, TrendingUp } from 'lucide-react';
import { WorkstationId, Order, Product, Enterprise } from '../../types';
import type { LiveOperationsSummary } from '../../services/catalog';

interface CockpitWorkstationProps {
  orders: Order[];
  products: Product[];
  enterprises: Enterprise[];
  liveOperations: LiveOperationsSummary | null;
  onNavigateToWorkstation: (wsId: WorkstationId, filterKey?: string, filterValue?: string) => void;
  language?: 'zh' | 'en';
}

type AiAnalysis = {
  whatHappened?: string;
  confidence?: number;
  recommendation?: string;
};

export const CockpitWorkstation: React.FC<CockpitWorkstationProps> = ({ orders, products, enterprises, liveOperations, onNavigateToWorkstation, language = 'zh' }) => {
  const isEn = language === 'en';
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const problemOrders = orders.filter((order) => order.isProblematic);
  const pendingClassification = products.filter((product) => product.status === '待分类审核').length;
  const enterpriseWarnings = enterprises.filter((enterprise) => enterprise.status === '已预警').length;

  const handleTriggerAiCopilot = async () => {
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai/operational-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomalyData: {
            problemOrdersCount: problemOrders.length,
            unclassifiedProductsCount: pendingClassification,
            overbudgetEnterprisesCount: enterpriseWarnings,
          },
        }),
      });
      if (!response.ok) throw new Error('AI diagnosis unavailable');
      setAiAnalysis((await response.json()) as AiAnalysis);
    } catch {
      setAiAnalysis({
        whatHappened: isEn ? 'The diagnosis service is temporarily unavailable. No operational decision has been applied.' : '诊断服务暂不可用；系统未执行任何经营决策或数据变更。',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-[13px] text-slate-700">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#10294d] to-[#07182f] text-white p-5 rounded-[14px] shadow-md border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-[#1769ff] text-white text-[10px] font-bold tracking-wider uppercase">Operational Cockpit</span>
            <span className="text-xs text-blue-200/80">{liveOperations ? (isEn ? 'Production data • Read-only overview' : '生产数据 · 只读概览') : isEn ? 'Loading production facts…' : '正在加载生产数据…'}</span>
          </div>
          <h2 className="text-lg font-bold text-white">{isEn ? 'Smart Wing Executive Cockpit' : 'Smart Wing 经营决策驾驶舱'}</h2>
          <p className="text-xs text-slate-300 mt-0.5">{isEn ? 'Production facts, scoped to your authorised data.' : '只显示当前授权范围内的生产事实与待处理事项。'}</p>
        </div>
        <button
          onClick={handleTriggerAiCopilot}
          disabled={isAiLoading}
          className="px-4 py-2 rounded-lg bg-[#1769ff] hover:bg-blue-600 disabled:opacity-60 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer border border-blue-400/30"
        >
          {isAiLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
          <span>{isAiLoading ? (isEn ? 'Gemini Analyzing...' : 'Gemini 深度分析中...') : isEn ? 'Run AI diagnosis' : '运行 AI 经营诊断'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label={isEn ? 'Loaded authorised products' : '当前授权目录商品'} value={liveOperations?.catalogCount} hint={isEn ? 'Live catalogue' : '实时目录读取'} positive />
        <MetricCard label={isEn ? 'Available stock' : '可用库存'} value={liveOperations?.availableStock} hint={isEn ? 'Live inventory query' : '实时库存查询'} />
        <MetricCard label={isEn ? 'Orders in scope' : '权限范围内订单'} value={liveOperations?.orderCount} hint={isEn ? 'Live order query' : '实时订单查询'} />
        <MetricCard label={isEn ? 'After-sales cases' : '售后工单'} value={liveOperations?.afterSaleCount} hint={isEn ? 'Live after-sales query' : '实时售后查询'} positive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${problemOrders.length ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
              <h3 className="text-sm font-bold text-[#10294d]">{isEn ? `Action required (${problemOrders.length})` : `待处理异常 (${problemOrders.length})`}</h3>
            </div>
            <button onClick={() => onNavigateToWorkstation('order')} className="text-[#1769ff] text-xs font-semibold hover:underline">
              {isEn ? 'Open order workbench →' : '打开订单履约台 →'}
            </button>
          </div>

          {problemOrders.length ? (
            <div className="space-y-3">
              {problemOrders.slice(0, 3).map((order) => (
                <article key={order.id} className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{order.problemSummary || order.productTitle}</span>
                    </div>
                    <span className="text-rose-700 font-mono text-[11px] shrink-0">{order.slaDeadline}</span>
                  </div>
                  <p className="text-xs text-slate-600">{isEn ? `Order ${order.id} · ${order.enterpriseName}` : `订单 ${order.id} · ${order.enterpriseName} · ${order.problemType || '待人工处理'}`}</p>
                  <button onClick={() => onNavigateToWorkstation('order', 'problemType', order.problemType)} className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs">
                    <span>{isEn ? 'Handle' : '去处理'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-emerald-50/50 p-8 rounded-xl border border-emerald-200 text-center">
              <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-600 mb-2" />
              <h4 className="font-bold text-emerald-900">{isEn ? 'No active exceptions in your scope' : '当前权限范围内无待处理异常'}</h4>
              <p className="text-xs text-emerald-700 mt-1">{isEn ? 'This status is calculated from the live scoped order query.' : '该结论来自实时的授权订单查询，不包含演示告警。'}</p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 p-4 rounded-[14px] border border-indigo-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-bold text-indigo-900 text-sm">{isEn ? 'AI Operations Copilot' : 'AI 运营协作者'}</h3>
            </div>
            {aiAnalysis ? (
              <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-[11px] font-bold text-indigo-600">{isEn ? 'Latest diagnosis' : '本次诊断结果'}</span>
                  {aiAnalysis.confidence ? (
                    <span className="text-[10px] text-slate-400">
                      {isEn ? 'Confidence ' : '置信度 '}
                      {aiAnalysis.confidence}%
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{aiAnalysis.whatHappened}</p>
                {aiAnalysis.recommendation ? <p className="text-xs text-indigo-800 bg-indigo-50 rounded-lg p-2">{aiAnalysis.recommendation}</p> : null}
                <p className="text-[11px] text-slate-400">{isEn ? 'Diagnosis is advisory only; no business action is automatically executed.' : '诊断仅供决策参考，系统不会自动执行任何业务操作。'}</p>
              </div>
            ) : (
              <div className="bg-white p-3 rounded-xl border border-indigo-100 text-xs text-slate-600 leading-relaxed">
                {isEn ? 'Run a diagnosis to analyse the real order, catalogue and enterprise facts within your authorisation scope.' : '点击“运行 AI 经营诊断”后，才会基于当前授权范围内的订单、目录与企业事实生成建议。'}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

function MetricCard({ label, value, hint, positive = false }: { label: string; value: number | undefined; hint: string; positive?: boolean }) {
  return (
    <div className="bg-white p-4 rounded-[14px] shadow-sm border border-slate-100 space-y-1">
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      <div className={`text-2xl font-bold ${positive ? 'text-[#15a46b]' : 'text-[#10294d]'}`}>{value ?? '—'}</div>
      <div className="flex items-center gap-1 text-[11px] mt-1 text-slate-400">
        {positive ? <TrendingUp className="w-3.5 h-3.5 text-[#15a46b]" /> : null}
        {hint}
      </div>
    </div>
  );
}
