import React, { useState } from 'react';
import { Settings, ShieldCheck, History, Sliders, Cpu, Save } from 'lucide-react';
import { SystemConfig } from '../../types';

interface SystemControlProps {
  config: SystemConfig;
  onUpdateConfig: (updatedConfig: SystemConfig) => void;
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string, evidence: string) => void) => void;
}

export const SystemControlWorkstation: React.FC<SystemControlProps> = ({ config, onUpdateConfig, onOpenGuardrail }) => {
  const [formData, setFormData] = useState<SystemConfig>(config);

  const handleSaveSystemConfig = (e: React.FormEvent) => {
    e.preventDefault();

    onOpenGuardrail(`更新 Smart Wing 全局业务引擎参数`, '系统核心参数配置变更', '全局操作系统配置', 'SYS-CFG-001', 0, (reason, evidence) => {
      const newLog = {
        id: `LOG-SYS-${Date.now()}`,
        operator: '张立 (COO)',
        timestamp: new Date().toLocaleString('zh-CN'),
        parameterName: '退款SLA / 缺货罚金率 / 预算预警线 / Gemini Copilot',
        beforeValue: `SLA:${config.refundSlaHours}h, 罚金:${config.stockoutPenaltyRate * 100}%, 预警:${config.budgetWarningThreshold * 100}%`,
        afterValue: `SLA:${formData.refundSlaHours}h, 罚金:${formData.stockoutPenaltyRate * 100}%, 预警:${formData.budgetWarningThreshold * 100}%`,
        reason,
      };

      const updated = {
        ...formData,
        auditLogs: [newLog, ...formData.auditLogs],
      };

      onUpdateConfig(updated);
      alert('系统参数已实时更新生效并记入全局审计日志！');
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-[14px] shadow-lg flex items-center justify-between border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider">System Operations & Rules</span>
            <span className="text-xs text-slate-400">全局引擎参数与 Gemini Copilot 控制卡口</span>
          </div>
          <h2 className="text-lg font-bold">系统规则配置与审计中心</h2>
          <p className="text-xs text-slate-400 mt-0.5">配置全站退款 SLA、缺货惩罚系数、企业预算预警线及 Gemini Copilot 策略</p>
        </div>
      </div>

      <form onSubmit={handleSaveSystemConfig} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Settings */}
        <div className="lg:col-span-7 bg-white rounded-[14px] border border-slate-200/90 shadow-xs p-6 space-y-6 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#1769ff]" />
            <span>核心业务阀门参数设置 (Business Thresholds)</span>
          </h3>

          <div className="space-y-4">
            {/* Rule 1: Refund SLA */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">类目退款审核 SLA 时效限制 (小时)</label>
              <input
                type="number"
                value={formData.refundSlaHours}
                onChange={(e) => setFormData({ ...formData, refundSlaHours: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-[10px] text-slate-400">超过此时间未处理的退款单将自动标记为 P0 严重超时，进入异常工单队列。</span>
            </div>

            {/* Rule 2: Penalty Rate */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">供应商缺货 / 超卖违约罚扣比例 (百分比 0.10 = 10%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.stockoutPenaltyRate}
                onChange={(e) => setFormData({ ...formData, stockoutPenaltyRate: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-[10px] text-slate-400">缺货违约发生时，系统自动扣减供应商履约保证金计算比例。</span>
            </div>

            {/* Rule 3: Budget Warning Threshold */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">企业福利预算消耗预警阈值 (百分比 0.80 = 80%)</label>
              <input
                type="number"
                step="0.05"
                value={formData.budgetWarningThreshold}
                onChange={(e) => setFormData({ ...formData, budgetWarningThreshold: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-[10px] text-slate-400">企业或部门预算使用率达到此线时自动变为黄色警示。</span>
            </div>

            {/* Rule 4: Gemini Copilot Toggles */}
            <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3">
              <h4 className="font-bold text-indigo-900 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span>Gemini AI Copilot 智能引擎配置</span>
              </h4>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input type="checkbox" checked={formData.geminiCopilotEnabled} onChange={(e) => setFormData({ ...formData, geminiCopilotEnabled: e.target.checked })} className="rounded text-[#1769ff]" />
                  <span>开启 Gemini 三级类目推断与经营诊断功能</span>
                </label>

                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                  <span>当前选用 Gemini 模型别名：</span>
                  <span className="font-mono font-bold text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200">{formData.aiModelAlias}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#1769ff] hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all">
              <Save className="w-4 h-4" />
              <span>保存配置并生成修改日志 (护栏卡口)</span>
            </button>
          </div>
        </div>

        {/* Right Audit Logs Table */}
        <div className="lg:col-span-5 bg-white rounded-[14px] border border-slate-200/90 shadow-xs p-6 space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-[#1769ff]" />
            <span>系统参数修改审计流水 (Audit Trail)</span>
          </h3>

          <div className="space-y-3 overflow-y-auto max-h-[600px]">
            {formData.auditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{log.operator}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                </div>
                <div className="text-[11px] text-[#1769ff] font-semibold">{log.parameterName}</div>
                <div className="text-[10px] text-slate-500 font-mono bg-white p-1.5 rounded border border-slate-200">
                  <span className="line-through text-rose-600 mr-2">{log.beforeValue}</span>
                  <span className="text-emerald-700 font-bold">&rarr; {log.afterValue}</span>
                </div>
                <p className="text-slate-600 text-[11px] pt-1">原因: {log.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
