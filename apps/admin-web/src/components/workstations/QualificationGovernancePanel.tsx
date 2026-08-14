import React, { useState } from 'react';
import { CheckCircle2, Clock3, History, ShieldCheck, UserRoundCog, XCircle } from 'lucide-react';
import { reviewQualificationChange, type QualificationCenterData, type QualificationGovernanceData } from '../../services/qualification';
import { EmployeeQualificationPanel } from './EmployeeQualificationPanel';
import { QualificationHistorySimulator } from './QualificationHistorySimulator';
import { KIND_LABELS } from './qualificationConfigModel';

type Props = {
  data: QualificationCenterData;
  governance: QualificationGovernanceData;
  refresh: () => Promise<void>;
  runProtected: (action: () => Promise<void>) => void;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};

export function QualificationGovernancePanel(props: Props) {
  const [tab, setTab] = useState<'approval' | 'employees' | 'verify'>('approval');
  const pending = props.governance.changeRequests.filter((request) => request.status === 'pending');
  const tabs = [
    { id: 'approval' as const, label: `审批与记录${pending.length ? ` (${pending.length})` : ''}`, icon: ShieldCheck, show: props.governance.changeRequests.length > 0 || props.governance.capabilities.approveChanges },
    { id: 'employees' as const, label: '员工资格事实', icon: UserRoundCog, show: props.governance.capabilities.readEmployees },
    {
      id: 'verify' as const,
      label: '历史与模拟',
      icon: History,
      show:
        props.governance.capabilities.simulate ||
        props.data.capabilities.readCommercialResources ||
        props.data.capabilities.manageCommercialResources ||
        props.data.capabilities.readEntitlements ||
        props.data.capabilities.manageEntitlements ||
        props.data.capabilities.readPurchaseLimits ||
        props.data.capabilities.managePurchaseLimits,
    },
  ].filter((item) => item.show);
  if (!tabs.length) return null;
  const visibleTab = tabs.some((item) => item.id === tab) ? tab : tabs[0].id;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-black text-slate-900">资格治理</h2>
          <p className="text-[11px] text-slate-500">双人审批、人工员工资格、历史回滚与结果模拟统一留痕。</p>
        </div>
        <nav className="flex flex-wrap rounded-xl bg-slate-100 p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${visibleTab === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="p-5">
        {visibleTab === 'approval' && <ApprovalQueue {...props} />}
        {visibleTab === 'employees' && <EmployeeQualificationPanel governance={props.governance} refresh={props.refresh} runProtected={props.runProtected} setNotice={props.setNotice} setError={props.setError} />}
        {visibleTab === 'verify' && <QualificationHistorySimulator data={props.data} governance={props.governance} refresh={props.refresh} runProtected={props.runProtected} setNotice={props.setNotice} setError={props.setError} />}
      </div>
    </section>
  );
}

function ApprovalQueue({ governance, refresh, runProtected, setNotice, setError }: Props) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const decide = (id: string, decision: 'approve' | 'reject') => {
    const reason = (reasons[id] ?? '').trim();
    if (reason.length < 4) return setError('审批意见至少填写四个字。');
    runProtected(async () => {
      setBusy(id);
      setError('');
      try {
        const result = await reviewQualificationChange({ changeRequestId: id, decision, reason });
        setNotice(result.status === 'applied' ? '审批通过，配置已生成新版本并生效。' : result.status === 'stale' ? '申请基于旧版本，已自动失效；请重新发起变更。' : '申请已驳回，员工端未发生变化。');
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '审批失败');
      } finally {
        setBusy('');
      }
    });
  };
  if (!governance.changeRequests.length) return <Empty text="暂无资格变更申请。高风险发布后会自动进入这里。" />;
  return (
    <div className="space-y-3">
      {governance.changeRequests.map((request) => {
        const self = request.requesterMembershipId === governance.currentMembershipId;
        return (
          <article key={request.id} className={`rounded-xl border p-4 ${request.status === 'pending' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm text-slate-900">
                    {KIND_LABELS[request.kind]} · {request.requestedStatus === 'active' ? '发布' : request.requestedStatus === 'disabled' ? '停用' : '草稿'}
                  </b>
                  <State value={request.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  申请人：{request.requesterName} · {new Date(request.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <Metric label="员工" value={request.preview.affectedEmployees} />
                <Metric label="SKU" value={request.preview.affectedSkus} />
                <Metric label="风险" value={request.riskLevel} />
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-700">{request.reason}</p>
            {!!request.preview.reasons?.length && (
              <div className="mt-2 flex flex-wrap gap-1">
                {request.preview.reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-amber-100 px-2 py-1 text-[10px] text-amber-800">
                    {reason}
                  </span>
                ))}
              </div>
            )}
            {request.status === 'pending' && governance.capabilities.approveChanges && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={reasons[request.id] ?? ''}
                  onChange={(event) => setReasons((current) => ({ ...current, [request.id]: event.target.value }))}
                  placeholder="审批意见（至少四个字）"
                  className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <button disabled={self || busy === request.id} onClick={() => decide(request.id, 'approve')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  通过
                </button>
                <button disabled={self || busy === request.id} onClick={() => decide(request.id, 'reject')} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300">
                  <XCircle className="h-3.5 w-3.5" />
                  驳回
                </button>
                {self && <span className="text-[11px] text-amber-700">你是申请人，必须由另一位审批人处理。</span>}
              </div>
            )}
            {request.status !== 'pending' && (
              <p className="mt-3 text-[11px] text-slate-500">
                处理人：{request.reviewerName ?? '系统'}
                {request.reviewReason ? ` · ${request.reviewReason}` : ''}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function State({ value }: { value: string }) {
  const labels: Record<string, string> = { pending: '待审批', applied: '已生效', rejected: '已驳回', stale: '版本已过期', cancelled: '已取消' };
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] ${value === 'pending' ? 'bg-amber-100 text-amber-800' : value === 'applied' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{labels[value] ?? value}</span>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-lg bg-white px-2 py-1">
      <small className="text-slate-400">{label}</small> <b className="text-slate-700">{value}</b>
    </span>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-10 text-xs text-slate-400">
      <Clock3 className="h-4 w-4" />
      {text}
    </div>
  );
}
