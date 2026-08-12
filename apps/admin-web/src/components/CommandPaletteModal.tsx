import React, { useState } from 'react';
import { Search, X, Sparkles, Building2, PackageCheck, Truck, ArrowRight, Zap } from 'lucide-react';
import { WorkstationId } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateWithFilter: (workstation: WorkstationId, filterKey?: string, filterValue?: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose, onNavigateWithFilter }) => {
  if (!isOpen) return null;

  const [query, setQuery] = useState('');

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();

    if (q.includes('华北') || q.includes('预算') || q.includes('国网')) {
      onNavigateWithFilter('enterprise', 'search', '国家电网华北分公司');
      onClose();
    } else if (q.includes('待分类') || q.includes('分类')) {
      onNavigateWithFilter('product', 'status', '待分类审核');
      onClose();
    } else if (q.includes('异常') || q.includes('订单') || q.includes('超卖')) {
      onNavigateWithFilter('order', 'problemType', 'STOCK_CONFLICT');
      onClose();
    } else if (q.includes('对账') || q.includes('差异')) {
      onNavigateWithFilter('finance', 'discrepancy', 'ONLY_DISCREPANCY');
      onClose();
    } else if (q.includes('供应商') || q.includes('结算')) {
      onNavigateWithFilter('supplier', 'status', 'DISPUTE');
      onClose();
    } else {
      // Default fallback search
      onNavigateWithFilter('cockpit', 'search', query);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-[14px] shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Form Header */}
        <form onSubmit={handleCommandSubmit} className="p-3.5 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜订单号/商品/员工/企业/供应商/输入自然语言指令（如: '查看华北大区本月预算异常'）..."
            className="flex-1 bg-transparent text-sm font-medium text-slate-800 focus:outline-none placeholder-slate-400"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <button type="submit" className="px-3 py-1.5 rounded-xl bg-[var(--sw-brand)] text-white text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer">
            <span>执行指令</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Natural Language Demo Shortcuts */}
        <div className="p-4 bg-slate-50 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>智能指令快捷执行 (Natural Language Commands)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => {
                onNavigateWithFilter('enterprise', 'search', '国家电网华北分公司');
                onClose();
              }}
              className="p-2.5 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-800">查看华北大区本月预算异常</span>
              </div>
              <Zap className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500" />
            </button>

            <button
              onClick={() => {
                onNavigateWithFilter('product', 'status', '待分类审核');
                onClose();
              }}
              className="p-2.5 rounded-xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-slate-800">过滤 10 件待分类商品队列</span>
              </div>
              <Zap className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500" />
            </button>

            <button
              onClick={() => {
                onNavigateWithFilter('order', 'problemType', 'STOCK_CONFLICT');
                onClose();
              }}
              className="p-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-rose-600" />
                <span className="font-semibold text-slate-800">定位极客智造库存超卖订单</span>
              </div>
              <Zap className="w-3.5 h-3.5 text-slate-300 group-hover:text-rose-500" />
            </button>

            <button
              onClick={() => {
                onNavigateWithFilter('finance', 'discrepancy', 'ONLY_DISCREPANCY');
                onClose();
              }}
              className="p-2.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-slate-800">筛出三方勾稽对账差异行</span>
              </div>
              <Zap className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-500" />
            </button>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="p-3 bg-white border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>提示：按 ESC 键或点击空白区域关闭</span>
          <span className="font-mono">Smart Wing AI Assistant Ready</span>
        </div>
      </div>
    </div>
  );
};
