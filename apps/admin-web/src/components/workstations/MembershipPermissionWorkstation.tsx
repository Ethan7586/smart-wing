import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LockKeyhole, RefreshCw, Search, ShieldCheck, UserRoundCheck, UsersRound } from 'lucide-react';
import { cachedAccessControl, loadAccessControl, preloadAccessControl, updateMemberAccess, updateMemberStatus, verifyCurrentPassword, type AccessControlData, type AccessMember, type AccessUpdate } from '../../services/accessControl';
import { preloadMemberOperations } from '../../services/memberOperations';
import { effectivePermissionCodes, memberSearchText, RISK_LABELS, SCOPE_LABELS } from './accessControlHelpers';
import { MemberAccessEditor } from './MemberAccessEditor';
import { StepUpModal } from './StepUpModal';
import { MemberOperationsPanel } from './MemberOperationsPanel';
import { CustomRoleCenterPanel } from './CustomRoleCenterPanel';

interface Props {
  active: boolean;
  canManageAccess: boolean;
  canManageStatus: boolean;
  canOffboard: boolean;
  canInvite: boolean;
  canUpdate: boolean;
  canImport: boolean;
  canCreateRole: boolean;
  canUpdateRole: boolean;
  canDisableRole: boolean;
}

export function MembershipPermissionWorkstation({ active: workstationActive, canManageAccess, canManageStatus, canOffboard, canInvite, canUpdate, canImport, canCreateRole, canUpdateRole, canDisableRole }: Props) {
  const [data, setData] = useState<AccessControlData | null>(() => cachedAccessControl());
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(() => !cachedAccessControl());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [verifiedUntil, setVerifiedUntil] = useState(0);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [section, setSection] = useState<'operations' | 'permissions' | 'roles'>('operations');
  const pendingAction = useRef<null | (() => Promise<void>)>(null);
  const refresh = async (force = false) => {
    if (!data) setLoading(true);
    setError('');
    try {
      const next = await loadAccessControl({ force });
      setData(next);
      setSelectedId((current) => (next.members.some((member) => member.membershipId === current) ? current : (next.members[0]?.membershipId ?? '')));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '会员权限读取失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    preloadAccessControl();
    preloadMemberOperations();
  }, []);
  useEffect(() => {
    if (workstationActive) void refresh();
  }, [workstationActive]);
  const members = useMemo(() => data?.members.filter((member) => !query.trim() || memberSearchText(member).includes(query.trim().toLowerCase())) ?? [], [data, query]);
  const selected = data?.members.find((member) => member.membershipId === selectedId) ?? null;
  const runProtected = (action: () => Promise<void>) => {
    if (verifiedUntil > Date.now()) {
      void action();
      return;
    }
    pendingAction.current = action;
    setStepUpOpen(true);
  };
  const completeStepUp = () => {
    setVerifiedUntil(Date.now() + 14 * 60 * 1000);
    setStepUpOpen(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) void action();
  };
  const closeStepUp = () => {
    pendingAction.current = null;
    setStepUpOpen(false);
  };
  const save = (value: AccessUpdate) => {
    if (!selected || !canManageAccess) return;
    runProtected(async () => {
      setSaving(true);
      setError('');
      try {
        await updateMemberAccess(selected.membershipId, value);
        await refresh(true);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '权限保存失败');
      } finally {
        setSaving(false);
      }
    });
  };
  const changeStatus = (member: AccessMember, status: 'active' | 'suspended' | 'offboarded') => {
    if (status === 'offboarded' ? !canOffboard : !canManageStatus) return;
    const reason = window.prompt(status === 'active' ? '请输入恢复会员的原因' : status === 'suspended' ? '请输入暂停会员的原因' : '请输入移除会员的原因');
    if (!reason?.trim()) return;
    runProtected(async () => {
      setSaving(true);
      setError('');
      try {
        await updateMemberStatus(member.membershipId, status, reason.trim());
        await refresh(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '会员状态更新失败');
      } finally {
        setSaving(false);
      }
    });
  };
  if (!workstationActive) return null;
  const activeMembers = data?.members.filter((member) => member.status === 'active').length ?? null;
  return (
    <>
      <div className="p-6 space-y-5 max-w-[1800px] mx-auto">
        <div className="rounded-[14px] bg-slate-900 text-white p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-blue-300 font-bold tracking-wider mb-1">MEMBERSHIP · RBAC · DATA SCOPE</div>
            <h2 className="text-lg font-bold">会员与权限控制中心</h2>
            <p className="text-xs text-slate-400 mt-1">角色叠加、明确禁止、数据范围、Owner 保护与授权审计统一管理</p>
          </div>
          <button onClick={() => void refresh(true)} disabled={loading} className="px-3 py-2 rounded-xl bg-white/10 text-xs flex gap-2 items-center disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '更新中' : '刷新'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Metric icon={UsersRound} label="会员身份" value={data?.members.length ?? null} />
          <Metric icon={UserRoundCheck} label="当前有效" value={activeMembers} />
          <Metric icon={ShieldCheck} label="角色模板" value={data?.roles.length ?? null} />
        </div>
        <div className="flex gap-2 border-b border-slate-200">
          <button onClick={() => setSection('operations')} className={`px-4 py-2 text-xs border-b-2 ${section === 'operations' ? 'border-blue-500 text-blue-700 font-bold' : 'border-transparent text-slate-500'}`}>
            会员运营
          </button>
          <button onClick={() => setSection('permissions')} className={`px-4 py-2 text-xs border-b-2 ${section === 'permissions' ? 'border-blue-500 text-blue-700 font-bold' : 'border-transparent text-slate-500'}`}>
            授权与状态
          </button>
          <button onClick={() => setSection('roles')} className={`px-4 py-2 text-xs border-b-2 ${section === 'roles' ? 'border-blue-500 text-blue-700 font-bold' : 'border-transparent text-slate-500'}`}>
            自定义角色
          </button>
        </div>
        <MemberOperationsPanel active={section === 'operations'} canInvite={canInvite} canUpdate={canUpdate} canImport={canImport} runProtected={runProtected} />
        <CustomRoleCenterPanel active={section === 'roles'} canCreate={canCreateRole} canUpdate={canUpdateRole} canDisable={canDisableRole} runProtected={runProtected} onChanged={() => refresh(true)} />
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
        {section === 'permissions' && !data && <StateCard text={error || '正在读取真实会员与授权关系…'} action={() => void refresh(true)} />}
        {section === 'permissions' && data && (
          <div className="grid grid-cols-12 gap-5 items-start">
            <section className="col-span-12 xl:col-span-4 bg-white border border-slate-200 rounded-[14px] overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、账号或角色" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none" />
                </div>
              </div>
              <div className="max-h-[720px] overflow-y-auto">
                {members.map((member) => (
                  <button
                    key={member.membershipId}
                    onClick={() => setSelectedId(member.membershipId)}
                    className={`w-full p-4 text-left border-b border-slate-100 ${selectedId === member.membershipId ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between gap-2">
                      <b className="text-slate-900">{member.displayName}</b>
                      <Status status={member.status} />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      {member.employeeNo} · {member.target}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {member.isOwner && <Tag text="OWNER" tone="amber" />}
                      {member.isSelf && <Tag text="本人" tone="blue" />}
                      {member.roles.map((role) => (
                        <Tag key={role.id} text={role.name} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <section className="col-span-12 xl:col-span-8 bg-white border border-slate-200 rounded-[14px] overflow-hidden">
              {selected ? (
                <>
                  <MemberHeader member={selected} data={data} saving={saving} canManageStatus={canManageStatus} canOffboard={canOffboard} onStatus={changeStatus} />
                  <div className="p-5">
                    <MemberAccessEditor member={selected} data={data} saving={saving} readOnly={!canManageAccess} onSave={save} />
                  </div>
                </>
              ) : (
                <StateCard text="请选择会员身份" />
              )}
            </section>
          </div>
        )}
      </div>
      <StepUpModal
        open={stepUpOpen}
        onClose={closeStepUp}
        onVerify={async (password) => {
          await verifyCurrentPassword(password);
        }}
        onVerified={completeStepUp}
      />
    </>
  );
}

function MemberHeader({
  member,
  data,
  saving,
  canManageStatus,
  canOffboard,
  onStatus,
}: {
  member: AccessMember;
  data: AccessControlData;
  saving: boolean;
  canManageStatus: boolean;
  canOffboard: boolean;
  onStatus: (member: AccessMember, status: 'active' | 'suspended' | 'offboarded') => void;
}) {
  const permissions = effectivePermissionCodes(member, data.roles);
  const highRisk = data.permissions.filter((permission) => permissions.has(permission.code) && ['high', 'critical'].includes(permission.risk));
  return (
    <div className="p-5 border-b border-slate-200 bg-slate-50/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{member.displayName}</h3>
            {member.isOwner && <LockKeyhole className="w-4 h-4 text-amber-600" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {member.employeeNo} · 权限版本 v{member.authzVersion} · {permissions.size} 项有效权限
          </p>
        </div>
        {(canManageStatus || canOffboard) && !member.isOwner && !member.isSelf && (
          <div className="flex gap-2">
            {canManageStatus &&
              (member.status === 'active' ? (
                <button disabled={saving} onClick={() => onStatus(member, 'suspended')} className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs">
                  暂停
                </button>
              ) : (
                <button disabled={saving} onClick={() => onStatus(member, 'active')} className="px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-xs">
                  恢复
                </button>
              ))}
            {canOffboard && (
              <button disabled={saving} onClick={() => onStatus(member, 'offboarded')} className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-xs">
                移除
              </button>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Info label="数据范围" text={member.scopes.map((scope) => SCOPE_LABELS[scope.kind]).join('、') || '未配置'} />
        <Info
          label="高风险权限"
          text={
            highRisk.length
              ? highRisk
                  .slice(0, 4)
                  .map((permission) => `${permission.name}(${RISK_LABELS[permission.risk]})`)
                  .join('、')
              : '无'
          }
        />
      </div>
    </div>
  );
}
function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | null }) {
  return (
    <div className="bg-white rounded-[14px] border border-slate-200 p-4 flex justify-between">
      <div>
        <div className="text-[10px] text-slate-400">{label}</div>
        <div className="text-2xl font-bold text-slate-900 mt-1">{value ?? '—'}</div>
      </div>
      <Icon className="w-5 h-5 text-blue-500" />
    </div>
  );
}
function Info({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] text-slate-400 mb-1">{label}</div>
      <div className="text-xs text-slate-700">{text}</div>
    </div>
  );
}
function Status({ status }: { status: AccessMember['status'] }) {
  const tone = status === 'active' ? 'bg-emerald-100 text-emerald-700' : status === 'suspended' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600';
  return <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tone}`}>{status}</span>;
}
function Tag({ text, tone = 'slate' }: { text: string; tone?: 'slate' | 'amber' | 'blue' }) {
  const style = tone === 'amber' ? 'bg-amber-100 text-amber-800' : tone === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
  return <span className={`text-[9px] rounded px-1.5 py-0.5 ${style}`}>{text}</span>;
}
function StateCard({ text, action }: { text: string; action?: () => void }) {
  return (
    <div className="min-h-[360px] flex flex-col gap-3 items-center justify-center text-sm text-slate-500">
      {text}
      {action && (
        <button onClick={action} className="text-blue-600 text-xs">
          重试
        </button>
      )}
    </div>
  );
}
