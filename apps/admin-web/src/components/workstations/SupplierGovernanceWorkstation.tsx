import React, { useState } from 'react';
import { Truck, ShieldAlert, Clock, AlertCircle, FileCheck, CheckCircle2, DollarSign, ArrowRight, Zap } from 'lucide-react';
import { Supplier } from '../../types';

interface SupplierGovernanceProps {
  suppliers: Supplier[];
  onUpdateSuppliers: (updatedSuppliers: Supplier[]) => void;
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string, evidence: string) => void) => void;
}

export const SupplierGovernanceWorkstation: React.FC<SupplierGovernanceProps> = ({ suppliers, onUpdateSuppliers, onOpenGuardrail }) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0];

  const filteredSuppliers = suppliers.filter((s) => s.name.includes(searchQuery) || s.code.includes(searchQuery));

  // Guardrail: Freeze Supplier or Deduct Guarantee Deposit
  const handleDeductDeposit = (sup: Supplier) => {
    onOpenGuardrail(`扣减供应商履约保证金: ${sup.name}`, '履约违约保证金扣减', sup.name, sup.id, 10000, (reason, evidence) => {
      const updated = suppliers.map((s) => {
        if (s.id === sup.id) {
          return {
            ...s,
            depositBalance: Math.max(0, s.depositBalance - 10000),
            settlementStatus: 'SETTLED' as const,
            auditLogs: [
              ...s.auditLogs,
              {
                id: `LOG-${Date.now()}`,
                operator: '张立 (COO)',
                action: '扣减履约违约金 ¥10,000',
                timestamp: new Date().toLocaleString('zh-CN'),
                reason: `因SLA发货严重违规超时及超卖，扣减保证金。理由: ${reason}. 凭证: ${evidence}`,
              },
            ],
          };
        }
        return s;
      });
      onUpdateSuppliers(updated);
      alert(`已成功向 ${sup.name} 扣除 ¥10,000 履约保证金！日志已记录。`);
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-[14px] shadow-lg flex items-center justify-between border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider">Supplier SLA Governance</span>
            <span className="text-xs text-slate-400">供应商协议履约与库存挂钩中心</span>
          </div>
          <h2 className="text-lg font-bold">供应商合规治理与结算监控</h2>
          <p className="text-xs text-slate-400 mt-0.5">实时监控 API 扣减时效、保证金质押池、SLA 违约扣减与对账争议</p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="lg:col-span-4 bg-white rounded-[14px] border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[750px]">
          <div className="p-3 bg-slate-100/80 border-b border-slate-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索供应商名称 / 编号..."
              className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
            {filteredSuppliers.map((sup) => {
              const isSelected = sup.id === selectedSupplier?.id;
              return (
                <div
                  key={sup.id}
                  onClick={() => setSelectedSupplierId(sup.id)}
                  className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer space-y-2 ${isSelected ? 'bg-white border-[var(--sw-brand)] shadow-md ring-2 ring-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{sup.name}</span>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        sup.riskGrade === 'RED'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                          : sup.riskGrade === 'YELLOW'
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {sup.riskGrade === 'RED' ? '高风险' : sup.riskGrade === 'YELLOW' ? '中风险' : '正常健康'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>模式: {sup.stockMode}</span>
                    <span className="font-bold text-slate-800">SLA 得分: {sup.slaScore} 分</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                    <span className="text-slate-400">保证金: ¥{sup.depositBalance.toLocaleString()}</span>
                    <span className={`font-semibold ${sup.settlementStatus === 'DISPUTE' ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>结算: {sup.settlementStatus === 'DISPUTE' ? '⚠️ 争议冻结中' : '正常结算'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detail */}
        {selectedSupplier ? (
          <div className="lg:col-span-8 bg-white rounded-[14px] border border-slate-200/90 shadow-xs p-6 space-y-6 overflow-y-auto max-h-[750px] text-xs">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900">{selectedSupplier.name}</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">{selectedSupplier.code}</span>
                </div>
                <p className="text-slate-500">
                  主营品类：{selectedSupplier.categoryScope.join(', ')} · 合作接洽人：{selectedSupplier.contactPerson} ({selectedSupplier.contactPhone})
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedSupplier.settlementStatus === 'DISPUTE' && (
                  <button
                    onClick={() => handleDeductDeposit(selectedSupplier)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>执行保证金扣款违约金</span>
                  </button>
                )}
              </div>
            </div>

            {/* SLA Metrics Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] block font-medium">发货平均响应时长</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{selectedSupplier.slaMetrics.avgDispatchHours} 小时</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] block font-medium">退款处理同意时效</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{selectedSupplier.slaMetrics.refundApprovalHours} 小时</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] block font-medium">缺货率 (Stockout)</span>
                <span className={`text-sm font-bold mt-0.5 block ${selectedSupplier.slaMetrics.stockoutRate > 0.05 ? 'text-rose-600' : 'text-emerald-600'}`}>{(selectedSupplier.slaMetrics.stockoutRate * 100).toFixed(1)}%</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 text-[10px] block font-medium">质检退货率</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">{(selectedSupplier.slaMetrics.qualityReturnRate * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Contract & Deposit Info */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900">协议与保证金合规</h4>
              <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block">协议到期日</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedSupplier.agreementExpireDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">保证金池账户余额</span>
                  <span className="font-bold text-slate-900">¥{selectedSupplier.depositBalance.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">库存对接模式</span>
                  <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">{selectedSupplier.stockMode}</span>
                </div>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">供应商处置履历流水</h4>
              <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                {selectedSupplier.auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>
                        {log.operator} · {log.action}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-1">{log.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white rounded-[14px] border border-slate-200/90 shadow-xs p-12 flex items-center justify-center text-slate-400 text-xs">请选择左侧供应商</div>
        )}
      </div>
    </div>
  );
};
