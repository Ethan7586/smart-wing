import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, TrendingUp, Sparkles, ShieldAlert, Clock, User, Activity, Zap, RotateCw } from 'lucide-react';
import { WorkstationId, Order, Product, Enterprise } from '../../types';
import type { LiveOperationsSummary } from '../../services/catalog';

interface CockpitWorkstationProps {
  orders: Order[];
  products: Product[];
  enterprises: Enterprise[];
  liveOperations: LiveOperationsSummary | null;
  onNavigateToWorkstation: (wsId: WorkstationId, filterKey?: string, filterValue?: string) => void;
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string) => void) => void;
  language?: 'zh' | 'en';
}

export const CockpitWorkstation: React.FC<CockpitWorkstationProps> = ({ orders, products, enterprises, liveOperations, onNavigateToWorkstation, onOpenGuardrail, language = 'zh' }) => {
  const isEn = language === 'en';
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Generate or Trigger Gemini Operational Copilot Analysis
  const handleTriggerAiCopilot = async () => {
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai/operational-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomalyData: {
            problemOrdersCount: orders.filter((o) => o.isProblematic).length,
            unclassifiedProductsCount: products.filter((p) => p.status === '待分类审核').length,
            overbudgetEnterprisesCount: enterprises.filter((e) => e.status === '已预警').length,
          },
        }),
      });
      const data = await response.json();
      setAiAnalysis(data);
    } catch (err) {
      console.error('Copilot Fetch Error', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAcceptAiSuggestion = (suggestionTitle: string) => {
    onOpenGuardrail(`采纳 AI 经营优化建议：${suggestionTitle}`, 'AI建议采纳与业务调整', '全局经营战略配置', 'AI-REC-001', 184500, () => {
      alert('已成功采纳 AI 经营优化建议，规则策略已生效！');
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-[13px] text-slate-700">
      {/* Top Banner / Headline */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#10294d] to-[#07182f] text-white p-5 rounded-[14px] shadow-md border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-[#1769ff] text-white text-[10px] font-bold tracking-wider uppercase">Operational Cockpit</span>
            <span className="text-xs text-blue-200/80">{liveOperations ? (isEn ? 'Production data • Read-only overview' : '生产数据 · 只读概览') : (isEn ? 'Loading production facts…' : '正在加载生产数据…')}</span>
          </div>
          <h2 className="text-lg font-bold text-white">{isEn ? 'Smart Wing Executive Cockpit' : 'Smart Wing 经营决策驾驶舱'}</h2>
          <p className="text-xs text-slate-300 mt-0.5">{isEn ? 'Actionable Insights Only • Identify conflicts in 30s, resolve in 3min' : '只展示“决策”与“行动” • 30 秒看清关键冲突，3 分钟完成闭环处置'}</p>
        </div>

        <button
          onClick={handleTriggerAiCopilot}
          disabled={isAiLoading}
          className="px-4 py-2 rounded-lg bg-[#1769ff] hover:bg-blue-600 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer border border-blue-400/30"
        >
          {isAiLoading ? <RotateCw className="w-4 h-4 animate-spin text-white" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
          <span>{isAiLoading ? (isEn ? 'Gemini Analyzing...' : 'Gemini 深度分析中...') : isEn ? 'Trigger Gemini AI Copilot' : '触发 Gemini AI 经营诊断'}</span>
        </button>
      </div>

      {/* BLOCK 1: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-[14px] shadow-sm border border-slate-100 space-y-1">
          <div className="text-slate-400 text-xs mb-1">{isEn ? 'Published products' : '生产目录商品'}</div>
          <div className="text-2xl font-bold text-[#10294d]">{liveOperations?.catalogCount ?? '—'}</div>
          <div className="flex items-center gap-1 text-[11px] mt-1 text-[#15a46b] font-semibold"><TrendingUp className="w-3.5 h-3.5" />{isEn ? 'Live catalogue' : '实时目录读取'}</div>
        </div>

        <div className="bg-white p-4 rounded-[14px] shadow-sm border border-slate-100 space-y-1">
          <div className="text-slate-400 text-xs mb-1">{isEn ? 'Available stock' : '可用库存'}</div>
          <div className="text-2xl font-bold text-[#10294d]">{liveOperations?.availableStock ?? '—'}</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-[#1769ff] h-1.5 rounded-full" style={{ width: liveOperations ? '100%' : '0%' }}></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-[14px] shadow-sm border border-slate-100 space-y-1">
          <div className="text-slate-400 text-xs mb-1">{isEn ? 'Orders in scope' : '权限范围内订单'}</div>
          <div className="text-2xl font-bold text-[#10294d]">{liveOperations?.orderCount ?? '—'}</div>
          <div className="flex items-center gap-1 text-[11px] mt-1 text-slate-400">{isEn ? 'Live order query' : '实时订单查询'}</div>
        </div>

        <div className="bg-white p-4 rounded-[14px] shadow-sm border border-slate-100 space-y-1">
          <div className="text-slate-400 text-xs mb-1">{isEn ? 'After-sales cases' : '售后工单'}</div>
          <div className="text-2xl font-bold text-[#15a46b]">{liveOperations?.afterSaleCount ?? '—'}</div>
          <div className="flex items-center gap-1 text-[11px] mt-1 text-slate-400">{isEn ? 'Live after-sales query' : '实时售后查询'}</div>
        </div>
      </div>

      {/* BLOCK 2: 必须立即处理 (Must Handle Immediately) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef476f] animate-ping" />
              <h3 className="text-sm font-bold text-[#10294d]">{isEn ? 'Action Required Immediately (3)' : '必须立即处理 (3)'}</h3>
            </div>
            <button onClick={() => onNavigateToWorkstation('order')} className="text-[#1769ff] text-xs font-semibold hover:underline">
              {isEn ? 'View All Cases →' : '查看全部 Case →'}
            </button>
          </div>

          <div className="space-y-3">
            {/* Card 1 */}
            <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-200/80 shadow-2xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="bg-[#ef476f] text-white px-2 py-0.5 rounded text-[10px] font-bold">{isEn ? 'P0 High' : 'P0 高优先级'}</span>
                  <span className="font-bold text-slate-800 text-xs">{isEn ? 'GeekTech ERP inventory sync timeout caused 10 headset oversells for China Railway' : '极客智造ERP锁库超时导致中铁建设10件耳机超卖'}</span>
                </div>
                <span className="text-rose-600 font-mono text-[11px] font-semibold">{isEn ? 'SLA Timer: 00:18:10' : 'SLA 倒计时: 00:18:10'}</span>
              </div>
              <p className="text-slate-600 text-xs line-clamp-1">{isEn ? 'Impact: $1,990 / 10 Users • Occurred: 11:20 • Owner: Zhang Li (COO)' : '影响: 1,990 元 / 10 人 • 发生时间: 2026-08-08 11:20 • 负责人: 张立 (COO)'}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] py-1 px-2.5 bg-white/80 rounded border border-rose-100 text-slate-600 font-medium">{isEn ? 'Root Cause: Supplier API Inventory Sync Delay' : '根因: 供应商 API 库存同步延迟'}</span>
                <button
                  onClick={() => onNavigateToWorkstation('order', 'problemType', 'STOCK_CONFLICT')}
                  className="bg-[#ef476f] hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs cursor-pointer transition-colors shadow-xs"
                >
                  {isEn ? 'Resolve' : '去处理'}
                </button>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="bg-[#f59e0b] text-white px-2 py-0.5 rounded text-[10px] font-bold">{isEn ? 'P1 Medium' : 'P1 中优先级'}</span>
                  <span className="font-bold text-slate-800 text-xs">{isEn ? 'Enterprise Budget Overrun Alert - State Grid North China' : '企业预算超支预警 - 国家电网华北分公司'}</span>
                </div>
                <span className="text-amber-700 font-mono text-[11px] font-semibold">{isEn ? 'SLA Timer: 01:20:00' : 'SLA 倒计时: 01:20:00'}</span>
              </div>
              <p className="text-slate-600 text-xs line-clamp-1">{isEn ? 'Impact: $40,000 / 420 Users • Occurred: 09:00 • Owner: Financial Director' : '影响: 40,000 元 / 420 人 • 发生时间: 2026-08-08 09:00 • 负责人: 王财务'}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] py-1 px-2.5 bg-white/80 rounded border border-amber-100 text-slate-600 font-medium">
                  {isEn ? 'Root Cause: Payday redemption surge in admin pre-budget pool' : '根因: 行政中心预支包发薪日兑换冲顶'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onNavigateToWorkstation('enterprise', 'search', '国家电网华北分公司')}
                    className="border border-amber-200 bg-white text-slate-700 px-3 py-1.5 rounded-lg font-medium text-xs cursor-pointer hover:bg-amber-50"
                  >
                    {isEn ? 'Details' : '查看详情'}
                  </button>
                  <button
                    onClick={() => onNavigateToWorkstation('enterprise', 'search', '国家电网华北分公司')}
                    className="bg-[#f59e0b] hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    {isEn ? 'Adjust Budget' : '调整预算'}
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-200/80 shadow-2xs space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="bg-[#1769ff] text-white px-2 py-0.5 rounded text-[10px] font-bold">{isEn ? 'P1 Product Review' : 'P1 商品审核'}</span>
                  <span className="font-bold text-slate-800 text-xs">{isEn ? '10 imported products missing standard eCommerce 3-level taxonomy' : '10 件新建导入商品缺少标准三级电商类目'}</span>
                </div>
                <span className="text-blue-700 font-mono text-[11px] font-semibold">{isEn ? 'SLA Timer: 00:45:00' : 'SLA 倒计时: 00:45:00'}</span>
              </div>
              <p className="text-slate-600 text-xs line-clamp-1">{isEn ? 'Impact: New SPUs unindexed in enterprise store • Owner: Category Team' : '影响: 新上架 SPU 无法在企业前端索引展示 • 负责人: 品类治理组'}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] py-1 px-2.5 bg-white/80 rounded border border-blue-100 text-slate-600 font-medium">{isEn ? 'AI Suggested Taxonomy Ready (92% Confidence)' : 'AI 建议分类已生成 (置信度 92%)'}</span>
                <button onClick={() => onNavigateToWorkstation('product', 'status', '待分类审核')} className="bg-[#1769ff] hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs cursor-pointer transition-colors shadow-xs">
                  {isEn ? 'Categorize' : '去治理台分类'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BLOCK 3: AI Copilot Card */}
        <aside className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 p-4 rounded-[14px] border border-indigo-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-indigo-900 text-sm">{isEn ? 'AI Operations Copilot' : 'AI 运营协作者'}</h3>
              </div>
              <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Gemini Copilot</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">{isEn ? 'Anomaly Pattern Recognition' : '异常模式识别'}</span>
                <span className="text-[10px] text-slate-400 font-mono">{isEn ? 'Confidence 94%' : '置信度 94%'}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {aiAnalysis?.whatHappened ||
                  (isEn
                    ? 'Detected GeekTech API accepting orders with 0 physical stock, causing China Railway order lock. Recommend freezing auto-lock rules.'
                    : '识别到『极客智造』物理库存为0情况下虚假接收 orders，造成中铁建设挂起。建议冻结该供应商 API 自动锁库逻辑。')}
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => alert(isEn ? 'Ignored' : '已忽略')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-medium cursor-pointer">
                  {isEn ? 'Ignore' : '忽略'}
                </button>
                <button
                  onClick={() => handleAcceptAiSuggestion(isEn ? 'GeekTech API Rule Tuning' : '极客智造 API 规则调优')}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {isEn ? 'Accept Suggestion' : '采纳建议'}
                </button>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">{isEn ? 'Budget & Redemption Forecast' : '预算与兑换预测'}</span>
                <span className="text-[10px] text-slate-400 font-mono">{isEn ? 'Confidence 88%' : '置信度 88%'}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isEn ? 'Projected State Grid North China admin recharge pool will deplete in 2 days. Recommend initiating wire transfer top-up.' : '预测国家电网华北分公司行政中心充值池将在 2 天后耗尽。建议发起企业公户电汇补录。'}
              </p>
              <button
                onClick={() => handleAcceptAiSuggestion(isEn ? 'Initiate Wire Transfer Top-up' : '发起公户补录')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                {isEn ? 'Accept Suggestion' : '采纳建议'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
