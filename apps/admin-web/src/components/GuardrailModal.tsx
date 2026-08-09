import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck, X, FileText, ArrowRight } from 'lucide-react';
import { GuardrailActionOptions } from '../types';

interface GuardrailModalProps {
  options: GuardrailActionOptions | null;
  onClose: () => void;
}

export const GuardrailModal: React.FC<GuardrailModalProps> = ({ options, onClose }) => {
  if (!options) return null;

  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [errorText, setErrorText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorText('必须填写操作原因，以保证合规追溯');
      return;
    }
    options.onConfirm(reason.trim(), evidence.trim() || '系统交互点击确认');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-[14px] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-white">{options.title}</h3>
              <p className="text-[11px] text-slate-400">不可逆高风险操作护栏 · 强制合规追溯机制</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Section 1: Required Four Elements Overview */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 text-[11px] block font-medium">1. 当前操作人</span>
              <span className="font-semibold text-slate-800">张立 (COO / 超级管理员)</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block font-medium">2. 操作类型</span>
              <span className="inline-block font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{options.actionType}</span>
            </div>
            <div className="col-span-2 border-t border-slate-200/80 pt-2">
              <span className="text-slate-400 text-[11px] block font-medium">3. 目标对象 & 影响范围</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-semibold text-slate-800">
                  {options.targetEntityName} ({options.entityId})
                </span>
                {options.impactAmount !== undefined && <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">影响金额: ¥{options.impactAmount.toLocaleString('zh-CN')}</span>}
              </div>
            </div>
            {(options.beforeValue || options.afterValue) && (
              <div className="col-span-2 bg-white p-2.5 rounded-lg border border-slate-200/90 text-[11px]">
                <span className="text-slate-400 block font-medium mb-1">4. 变更前后对照</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded line-through">{options.beforeValue || '原始状态'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">{options.afterValue || '更新状态'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Mandatory Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              操作原因 <span className="text-rose-500">* (必填，计入审计日志)</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrorText('');
              }}
              placeholder="请输入明确且严谨的操作业务原因（例如：大客户协议让利调整 / 客服纠纷退款 / 校验清单确认通过）..."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1769ff]/30 focus:border-[#1769ff] text-slate-800 placeholder-slate-400"
            />
            {errorText && <p className="text-[11px] text-rose-600 font-semibold mt-1">{errorText}</p>}
          </div>

          {/* Section 3: Evidence Attachment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>关联证据说明 / 附件编号</span>
              <span className="text-[10px] text-slate-400 font-normal">选填 (如工单号/合同编号)</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder={options.evidencePlaceholder || '例如：CONTRACT-2026-0811 或 微信沟通截图工单 #9910'}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1769ff]/30 focus:border-[#1769ff] text-slate-800"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#1769ff] to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>确认执行并生成审计流水</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
