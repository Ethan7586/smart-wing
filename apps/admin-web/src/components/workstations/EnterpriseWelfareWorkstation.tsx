import React, { useState } from 'react';
import { Building2, Users, Download, AlertTriangle, RefreshCw, Search, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { Enterprise } from '../../types';

interface EnterpriseWelfareProps {
  enterprises: Enterprise[];
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string, evidence: string) => void) => void;
  initialSearchName?: string;
}

export const EnterpriseWelfareWorkstation: React.FC<EnterpriseWelfareProps> = ({ enterprises, onOpenGuardrail, initialSearchName }) => {
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string>(enterprises.find((e) => (initialSearchName ? e.name.includes(initialSearchName) : true))?.id || enterprises[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState(initialSearchName || '');
  const [activeTab, setActiveTab] = useState<'PLANS' | 'DEPT_BUDGETS' | 'HR_SYNC' | 'EXCLUSIVE_PRICES'>('PLANS');

  const selectedEnterprise = enterprises.find((e) => e.id === selectedEnterpriseId) || enterprises[0];

  const filteredEnterprises = enterprises.filter((e) => e.name.includes(searchQuery) || e.code.includes(searchQuery));

  // Mock Export Attribution Report
  const handleExportAttributionReport = () => {
    const reportData = {
      enterprise: selectedEnterprise.name,
      exportTime: new Date().toISOString(),
      welfarePlans: selectedEnterprise.welfarePlans,
      departmentBudgets: selectedEnterprise.deptBudgets,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartWing_Attribution_Report_${selectedEnterprise.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Adjust Dept Budget Guardrail
  const handleAdjustDeptBudget = (deptName: string, currentBudget: number) => {
    onOpenGuardrail(`调整部门福利预算包: ${deptName}`, '部门预算额度调增', selectedEnterprise.name, selectedEnterprise.id, 100000, (reason) => {
      alert(`已成功为【${deptName}】追补 100,000 元福利预算，解除阻断！`);
    });
  };

  // Sync HR System Org Tree
  const handleTriggerHrSync = () => {
    alert(`已向【${selectedEnterprise.name}】HR 系统 (泛微/钉钉/飞书企微) 发起组织架构与离发薪同步，成功校准 100% 员工资格！`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Value Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[var(--sw-sidebar-top)] to-[var(--sw-brand)] text-white p-5 rounded-[14px] shadow-lg flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 text-[10px] font-bold uppercase tracking-wider">Enterprise Welfare Hub</span>
            <span className="text-xs text-blue-200">Smart Wing 核心高价值差异功能</span>
          </div>
          <h2 className="text-lg font-bold">企业福利与预算卡扣控制台</h2>
          <p className="text-xs text-slate-200 mt-0.5 font-mono">企业 &rarr; 福利计划 &rarr; 部门/人群 &rarr; 预算额度 &rarr; 资格卡口 &rarr; 可见商品 &rarr; 使用归属</p>
        </div>

        <button onClick={handleExportAttributionReport} className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer">
          <Download className="w-4 h-4 text-[var(--sw-brand)]" />
          <span>导出企业预算归属明细报表</span>
        </button>
      </div>

      {/* Main Split Layout: Enterprise List vs Enterprise Deep Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Enterprises List */}
        <div className="lg:col-span-4 bg-white rounded-[14px] border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[750px]">
          <div className="p-3 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索企业客户名称..." className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400" />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
            {filteredEnterprises.map((ent) => {
              const isSelected = ent.id === selectedEnterprise?.id;
              return (
                <div
                  key={ent.id}
                  onClick={() => setSelectedEnterpriseId(ent.id)}
                  className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer space-y-2 ${isSelected ? 'bg-white border-[var(--sw-brand)] shadow-md ring-2 ring-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{ent.name}</span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${ent.status === '已预警' ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                      {ent.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{ent.industry}</span>
                    <span className="font-mono">{ent.employeeCount.toLocaleString()} 人</span>
                  </div>

                  {/* Exclusive Rate Pill */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                    <span className="text-slate-400">联系人: {ent.contactPerson}</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">专属打折率: {ent.exclusiveDiscountRate * 10} 折</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Enterprise Welfare Management Hub */}
        {selectedEnterprise ? (
          <div className="lg:col-span-8 bg-white rounded-[14px] border border-slate-200/90 shadow-xs p-6 space-y-6 overflow-y-auto max-h-[750px]">
            {/* Header Overview */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900">{selectedEnterprise.name}</h3>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{selectedEnterprise.code}</span>
                </div>
                <p className="text-xs text-slate-500">
                  行业领域：{selectedEnterprise.industry} · 覆盖员工规模：{selectedEnterprise.employeeCount} 人 · 电话：{selectedEnterprise.contactPhone}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleTriggerHrSync} className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[var(--sw-brand)] border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>HR 组织架构同步</span>
                </button>
              </div>
            </div>

            {/* Workplace Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
              <button onClick={() => setActiveTab('PLANS')} className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${activeTab === 'PLANS' ? 'bg-[var(--sw-brand)] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}>
                福利计划列表 ({selectedEnterprise.welfarePlans.length})
              </button>

              <button
                onClick={() => setActiveTab('DEPT_BUDGETS')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${activeTab === 'DEPT_BUDGETS' ? 'bg-[var(--sw-brand)] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                部门/人群预算消耗进度 ({selectedEnterprise.deptBudgets.length})
              </button>

              <button onClick={() => setActiveTab('HR_SYNC')} className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${activeTab === 'HR_SYNC' ? 'bg-[var(--sw-brand)] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}>
                员工资格与 HR 同步
              </button>

              <button
                onClick={() => setActiveTab('EXCLUSIVE_PRICES')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${activeTab === 'EXCLUSIVE_PRICES' ? 'bg-[var(--sw-brand)] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                企业专属价格配置
              </button>
            </div>

            {/* TAB 1: WELFARE PLANS */}
            {activeTab === 'PLANS' && (
              <div className="space-y-4 text-xs">
                {selectedEnterprise.welfarePlans.map((plan) => {
                  const usagePct = ((plan.spentAmount / plan.budgetPool) * 100).toFixed(1);
                  const isWarning = Number(usagePct) >= 80;

                  return (
                    <div key={plan.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{plan.name}</span>
                            <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${isWarning ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>{plan.status}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            发放周期：{plan.cycle} · 资金来源：{plan.balanceSource}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">已用 / 总预算包</span>
                          <span className="font-bold text-slate-900 text-sm">
                            ¥{plan.spentAmount.toLocaleString()} / ¥{plan.budgetPool.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Usage Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-slate-600">预算消耗率进度条</span>
                          <span className={isWarning ? 'text-rose-600 font-bold' : 'text-emerald-600'}>{usagePct}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${Number(usagePct) >= 100 ? 'bg-rose-600' : Number(usagePct) >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(Number(usagePct), 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Allowed Categories */}
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-400">限定可购品类：</span>
                          {plan.allowedCategoryL1s.map((cat, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-medium">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: DEPT BUDGETS CONSUMPTION */}
            {activeTab === 'DEPT_BUDGETS' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="font-semibold">部门预算监控：超过 80% 黄色告警，超过 100% 红色卡口并自动进入工单队列</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedEnterprise.deptBudgets.map((dept) => {
                    const pct = ((dept.spentAmount / dept.budgetAmount) * 100).toFixed(1);
                    const isExceeded = dept.status === 'EXCEEDED';

                    return (
                      <div key={dept.deptId} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 text-xs">{dept.deptName}</span>
                            <span className="text-[10px] text-slate-400 ml-2">编制：{dept.employeeCount} 人</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-800">
                              ¥{dept.spentAmount.toLocaleString()} / ¥{dept.budgetAmount.toLocaleString()}
                            </span>

                            {isExceeded && (
                              <button
                                onClick={() => handleAdjustDeptBudget(dept.deptName, dept.budgetAmount)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                              >
                                追补预算包
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isExceeded ? 'bg-rose-600' : Number(pct) >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: HR SYSTEM ORG SYNC */}
            {activeTab === 'HR_SYNC' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">企业 HR 组织架构与离职/入职同步状态</h4>
                    <span className="text-slate-500 text-[11px]">上次同步时间：{selectedEnterprise.hrSyncInfo.lastSyncTime}</span>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>同步连接健康</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 text-[10px] block">已挂钩同步部门数</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedEnterprise.hrSyncInfo.syncedDeptsCount} 个一级/二级部门</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">已激活福利资格员工</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedEnterprise.hrSyncInfo.syncedEmployeesCount.toLocaleString()} 人</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: EXCLUSIVE PRICES */}
            {activeTab === 'EXCLUSIVE_PRICES' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">企业专属优惠打折价格矩阵</h4>
                  <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">当前合约折扣：{selectedEnterprise.exclusiveDiscountRate * 10} 折</span>
                </div>
                <p className="text-slate-500 text-[11px]">同一 SPU/SKU 商品在商城公开价的基础上，对【{selectedEnterprise.name}】全场自动结算套用专属特惠系数。</p>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white rounded-[14px] border border-slate-200/90 shadow-xs p-12 flex items-center justify-center text-slate-400 text-xs">请选择左侧企业客户以展开福利与预算架构</div>
        )}
      </div>
    </div>
  );
};
