import React, { useState } from 'react';
import { DemoDataBanner } from './DemoDataBanner';
import { X, AlertCircle, ArrowRight, CheckCircle2, User, Clock, PlusCircle } from 'lucide-react';
import { CaseItem, CaseStatus, WorkstationId } from '../types';

interface CaseCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseItem[];
  onUpdateCaseStatus: (caseId: string, newStatus: CaseStatus, operator: string, note: string) => void;
  onNavigateToWorkstation: (wsId: WorkstationId, objectId?: string) => void;
}

const LIFECYCLE_STAGES: CaseStatus[] = ['发现', '分级', '指派', '处理', '验证', '关闭', '复盘'];

export const CaseCenterDrawer: React.FC<CaseCenterDrawerProps> = ({ isOpen, onClose, cases, onUpdateCaseStatus, onNavigateToWorkstation }) => {
  if (!isOpen) return null;

  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || '');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [newNote, setNewNote] = useState('');

  const filteredCases = cases.filter((c) => {
    if (filterPriority !== 'ALL' && c.priority !== filterPriority) return false;
    return true;
  });

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];

  const handleAdvanceStatus = () => {
    if (!selectedCase) return;
    const currentIndex = LIFECYCLE_STAGES.indexOf(selectedCase.status);
    if (currentIndex < LIFECYCLE_STAGES.length - 1) {
      const nextStatus = LIFECYCLE_STAGES[currentIndex + 1];
      onUpdateCaseStatus(selectedCase.id, nextStatus, '张立 (COO)', newNote || `状态推进至 [${nextStatus}]`);
      setNewNote('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200">
        {/* Header */}
        <div className="p-4">
          <DemoDataBanner scope="工单与客服案例" />
        </div>
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">CS</div>
            <div>
              <h2 className="font-bold text-sm text-white">全局 Case 工单中心 (问题单治理)</h2>
              <p className="text-[11px] text-slate-400">跨工作台协同 · 发现 → 分级 → 指派 → 处理 → 验证 → 关闭 → 复盘</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Case List */}
          <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/60">
            {/* Filter Bar */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">全量 Case ({filteredCases.length})</span>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="text-[11px] bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700">
                <option value="ALL">全部优先级</option>
                <option value="P0-紧急">P0-紧急</option>
                <option value="P1-高">P1-高</option>
                <option value="P2-中">P2-中</option>
              </select>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredCases.map((c) => {
                const isSelected = c.id === selectedCase?.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${isSelected ? 'bg-white border-[var(--sw-brand)] shadow-md ring-1 ring-[var(--sw-brand)]' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          c.priority.startsWith('P0')
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : c.priority.startsWith('P1')
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {c.priority}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">{c.status}</span>
                    </div>
                    <h4 className="font-semibold text-slate-800 line-clamp-2 leading-snug mb-1">{c.title}</h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                      <span>{c.caseNo}</span>
                      <span>SLA: {c.slaMinutesRemaining}m</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Case Detail & State Machine */}
          {selectedCase ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
              {/* Title & Actions */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{selectedCase.caseNo}</span>
                    <span className="text-xs font-semibold text-slate-500">来源工作台：{selectedCase.sourceWorkstation}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{selectedCase.title}</h3>
                </div>

                <button
                  onClick={() => onNavigateToWorkstation(selectedCase.sourceWorkstation, selectedCase.relatedObjectId)}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[var(--sw-brand)] border border-blue-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>去工作台处理</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* State Machine Step Progress Bar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 block mb-3">工单状态机生命周期 (Lifecycle State Machine)</span>
                <div className="flex items-center justify-between">
                  {LIFECYCLE_STAGES.map((stage, idx) => {
                    const currentIdx = LIFECYCLE_STAGES.indexOf(selectedCase.status);
                    const isPassed = idx < currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                      <React.Fragment key={stage}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              isCurrent ? 'bg-[var(--sw-brand)] text-white ring-4 ring-blue-100 shadow-md' : isPassed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>
                          <span className={`text-[10px] mt-1 font-semibold ${isCurrent ? 'text-[var(--sw-brand)]' : isPassed ? 'text-emerald-700' : 'text-slate-400'}`}>{stage}</span>
                        </div>
                        {idx < LIFECYCLE_STAGES.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Case Stats Cards */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[11px] block font-medium">涉及总金额</span>
                  <span className="text-sm font-bold text-rose-600">¥{selectedCase.affectedAmount.toLocaleString('zh-CN')}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[11px] block font-medium">影响员工数</span>
                  <span className="text-sm font-bold text-slate-800">{selectedCase.affectedUsers} 人</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 text-[11px] block font-medium">指派责任人</span>
                  <span className="text-sm font-bold text-blue-700 flex items-center gap-1 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                    {selectedCase.assignee}
                  </span>
                </div>
              </div>

              {/* Root Cause Summary */}
              <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-rose-800 mb-1">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>根因初步诊断 (Root Cause Summary)</span>
                </div>
                <p className="text-rose-900 leading-relaxed font-medium">{selectedCase.rootCause}</p>
              </div>

              {/* Advance Status & Notes Action */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">工单流转处置 (State Machine Action)</span>
                  {selectedCase.status !== '复盘' && (
                    <button onClick={handleAdvanceStatus} className="px-3 py-1.5 rounded-xl bg-[var(--sw-brand)] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition-all cursor-pointer">
                      <span>推进状态至下一步</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="可输入本阶段处理备注（如：已协调极客智造重新发货，顺丰单号跟进中）..."
                  className="w-full px-3 py-2 text-xs bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Action History Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>处理履历明细 (Action History Logs)</span>
                </h4>
                <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-4 text-xs">
                  {selectedCase.actionLogs.map((log, i) => (
                    <div key={i} className="relative pb-3">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-100" />
                      <div className="flex items-center justify-between font-semibold text-slate-700">
                        <span>
                          {log.operator} · {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">{log.timestamp}</span>
                      </div>
                      <p className="text-slate-600 mt-0.5 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200/80">{log.remark}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">暂无工单选择</div>
          )}
        </div>
      </div>
    </div>
  );
};
