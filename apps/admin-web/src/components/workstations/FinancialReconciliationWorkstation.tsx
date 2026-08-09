import React, { useState } from 'react';
import { FileText, DollarSign, AlertTriangle, CheckCircle2, Download, ArrowRight, ShieldCheck } from 'lucide-react';
import { FinanceDiscrepancyRow } from '../../types';

interface FinancialReconciliationProps {
  discrepancies: FinanceDiscrepancyRow[];
  onUpdateDiscrepancies: (updated: FinanceDiscrepancyRow[]) => void;
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string, evidence: string) => void) => void;
  initialFilterDiscrepancyOnly?: boolean;
}

export const FinancialReconciliationWorkstation: React.FC<FinancialReconciliationProps> = ({ discrepancies, onUpdateDiscrepancies, onOpenGuardrail, initialFilterDiscrepancyOnly }) => {
  const [filterType, setFilterType] = useState<string>(initialFilterDiscrepancyOnly ? 'UNRESOLVED' : 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (filterType === 'UNRESOLVED' && d.status !== 'UNRESOLVED') return false;
    if (searchQuery && !d.orderId.includes(searchQuery) && !d.entityName.includes(searchQuery)) {
      return false;
    }
    return true;
  });

  const totalDiscrepancyAmount = discrepancies.filter((d) => d.status === 'UNRESOLVED').reduce((sum, d) => sum + Math.abs(d.diffAmount), 0);

  // Handle Diff Reconcile Guardrail
  const handleReconcileRow = (row: FinanceDiscrepancyRow) => {
    onOpenGuardrail(`财务平账与调账单生成: 订单号 ${row.orderId}`, '财务对账差异平账', row.entityName, row.id, Math.abs(row.diffAmount), (reason, evidence) => {
      const updated = discrepancies.map((d) => {
        if (d.id === row.id) {
          return {
            ...d,
            status: 'RESOLVED' as const,
            note: `平账成功！调账凭证已存。操作原因: ${reason}. 凭证: ${evidence}`,
          };
        }
        return d;
      });
      onUpdateDiscrepancies(updated);
      alert(`调账凭证已自动生成，差额 ¥${Math.abs(row.diffAmount)} 抹平！`);
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-[14px] shadow-lg flex items-center justify-between border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider">Financial Reconciliation</span>
            <span className="text-xs text-slate-400">三方勾稽 · 应收/应付/通道费率严密平账</span>
          </div>
          <h2 className="text-lg font-bold">三方勾稽对账与资金清算台</h2>
          <p className="text-xs text-slate-400 mt-0.5">商城记录 vs 企业公户预存水单 vs 供应商结算账单 vs 微信/支付宝通道卡口</p>
        </div>

        <button
          onClick={() => alert('正在导出本期三方勾稽平衡表 Excel...')}
          className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4 text-purple-600" />
          <span>导出三方勾稽平衡表 (Excel)</span>
        </button>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-[14px] p-4 border border-slate-200/90 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">本期应收企业款项 (结算总额)</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">¥18,425,000.00</span>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-1">已到账 98.5% (预付款通道)</span>
        </div>

        <div className="bg-white rounded-[14px] p-4 border border-slate-200/90 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">本期应付供应商结算款</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">¥14,210,000.00</span>
          <span className="text-[10px] text-slate-400 block mt-1">毛利率: 22.8%</span>
        </div>

        <div className="bg-white rounded-[14px] p-4 border border-slate-200/90 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">通道手续费成本 (微信/支付宝/银联)</span>
          <span className="text-xl font-[#1769ff] font-bold mt-1 block">¥110,550.00</span>
          <span className="text-[10px] text-slate-400 block mt-1">平均费率 0.6%</span>
        </div>

        <div className="bg-white rounded-[14px] p-4 border border-rose-200 bg-rose-50/30 shadow-xs">
          <span className="text-xs text-rose-800 font-bold block">待平账差异总额 / 笔数</span>
          <span className="text-xl font-bold text-rose-600 mt-1 block">¥{totalDiscrepancyAmount.toLocaleString('zh-CN')}</span>
          <span className="text-[10px] text-rose-700 font-semibold block mt-1">共 {discrepancies.filter((d) => d.status === 'UNRESOLVED').length} 笔挂起差异行</span>
        </div>
      </div>

      {/* Discrepancy Table */}
      <div className="bg-white rounded-[14px] border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索订单号 / 企业名称..."
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none w-64"
            />

            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium">
              <option value="ALL">全部勾稽行</option>
              <option value="UNRESOLVED">仅看未平账差异行</option>
            </select>
          </div>

          <span className="text-xs text-slate-500">
            找到 <span className="font-bold text-slate-800">{filteredDiscrepancies.length}</span> 条勾稽记录
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-3">订单号 / 对账日期</th>
                <th className="p-3">关联企业 / 供应商</th>
                <th className="p-3 text-right">商城记账金额</th>
                <th className="p-3 text-right">三方水单/通道实扣</th>
                <th className="p-3 text-right">差额 (Diff)</th>
                <th className="p-3">差异类型与诊断</th>
                <th className="p-3">平账状态</th>
                <th className="p-3 text-center">平账处置</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredDiscrepancies.map((row) => (
                <tr key={row.id} className="hover:bg-purple-50/30 transition-colors">
                  <td className="p-3">
                    <span className="font-mono font-bold text-slate-900 block">{row.orderId}</span>
                    <span className="text-[10px] text-slate-400">{row.reconcileDate}</span>
                  </td>

                  <td className="p-3">
                    <span className="font-semibold text-slate-800 block">{row.entityName}</span>
                  </td>

                  <td className="p-3 text-right font-mono font-bold">¥{row.mallRecordAmount.toLocaleString()}</td>

                  <td className="p-3 text-right font-mono font-bold">¥{row.thirdPartyAmount.toLocaleString()}</td>

                  <td className="p-3 text-right font-mono font-bold">
                    <span className={`px-1.5 py-0.5 rounded ${row.diffAmount !== 0 ? 'bg-rose-100 text-rose-700' : 'text-emerald-700'}`}>{row.diffAmount > 0 ? `+¥${row.diffAmount}` : `¥${row.diffAmount}`}</span>
                  </td>

                  <td className="p-3 font-medium text-slate-700">
                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-bold border border-purple-200">{row.diffType}</span>
                  </td>

                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.status === 'UNRESOLVED' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                      {row.status === 'UNRESOLVED' ? '挂起未平' : '已平账'}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    {row.status === 'UNRESOLVED' ? (
                      <button onClick={() => handleReconcileRow(row)} className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors">
                        调账平账
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">已平账归档</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
