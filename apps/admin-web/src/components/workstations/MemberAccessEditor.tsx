import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ShieldAlert } from 'lucide-react';
import type { AccessControlData, AccessMember, AccessScope, ScopeKind } from '../../services/accessControl';
import { permissionsByCategory, RISK_LABELS, SCOPE_LABELS } from './accessControlHelpers';

interface Props {
  member: AccessMember;
  data: AccessControlData;
  saving: boolean;
  readOnly?: boolean;
  onSave: (value: { roleIds: string[]; scopes: AccessScope[]; deniedPermissions: string[]; reason: string }) => void;
}

export function MemberAccessEditor({ member, data, saving, readOnly = false, onSave }: Props) {
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<AccessScope[]>([]);
  const [deniedPermissions, setDeniedPermissions] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  useEffect(() => {
    setRoleIds(member.roles.map((role) => role.id));
    setScopes(member.scopes);
    setDeniedPermissions(member.deniedPermissions);
    setReason('');
  }, [member]);
  const editableRoles = data.roles.filter((role) => !role.isOwner);
  const grantedCodes = useMemo(() => new Set(data.roles.filter((role) => roleIds.includes(role.id)).flatMap((role) => role.permissions)), [data.roles, roleIds]);
  const protectedMember = member.isOwner || member.isSelf || readOnly;
  return (
    <div className="space-y-5">
      {protectedMember && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            {member.isOwner ? 'Owner 是唯一最高级身份，不能通过日常后台修改、停用或转授。' : member.isSelf ? '不能修改自己的角色和数据范围，防止误锁和自我提权。' : '当前身份只有查看权限，需要 Owner 授予角色与范围管理权限后才能修改。'}
          </span>
        </div>
      )}
      <section>
        <Title text="角色模板" hint="多个角色叠加授权" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {editableRoles.map((role) => (
            <label key={role.id} className={`rounded-xl border p-3 flex gap-3 ${roleIds.includes(role.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'} ${protectedMember ? 'opacity-60' : ''}`}>
              <input type="checkbox" disabled={protectedMember} checked={roleIds.includes(role.id)} onChange={() => setRoleIds(toggle(roleIds, role.id))} />
              <span>
                <b className="text-slate-900">{role.name}</b>
                <small className="block text-slate-500 mt-1">
                  {role.permissions.length} 项权限 · {role.description || (role.isSystem ? '系统角色模板' : '自定义角色')}
                </small>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section>
        <Title text="数据范围" hint="权限只在所选资源内生效" />
        <ScopeEditor data={data} value={scopes} disabled={protectedMember} onChange={setScopes} />
      </section>
      <section>
        <Title text="明确禁止" hint="像 Discord 一样，禁止优先于任何角色允许" />
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 space-y-4">
          {permissionsByCategory(data.permissions).map(([category, permissions]) => (
            <div key={category}>
              <div className="text-[10px] font-bold text-slate-400 mb-2">{category}</div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5">
                {permissions
                  .filter((permission) => grantedCodes.has(permission.code) || deniedPermissions.includes(permission.code))
                  .map((permission) => (
                    <label key={permission.code} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${deniedPermissions.includes(permission.code) ? 'bg-rose-50 text-rose-800' : 'text-slate-600'}`}>
                      <input type="checkbox" disabled={protectedMember} checked={deniedPermissions.includes(permission.code)} onChange={() => setDeniedPermissions(toggle(deniedPermissions, permission.code))} />
                      <span>{permission.name}</span>
                      {permission.risk !== 'low' && <em className="not-italic text-[9px] text-rose-600">{RISK_LABELS[permission.risk]}</em>}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <Title text="变更原因" hint="写入不可篡改审计日志" />
        <textarea
          disabled={protectedMember}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="说明授权依据，例如：客服岗位调整，仅保留商城售后处理权限"
          className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </section>
      <button
        disabled={protectedMember || saving || reason.trim().length < 4 || scopes.length === 0}
        onClick={() => onSave({ roleIds, scopes, deniedPermissions, reason: reason.trim() })}
        className="w-full rounded-xl bg-blue-600 disabled:bg-slate-300 px-4 py-3 text-white font-bold text-xs flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {saving ? '正在保存…' : '保存权限并立即使旧会话失效'}
      </button>
    </div>
  );
}

function ScopeEditor({ data, value, disabled, onChange }: { data: AccessControlData; value: AccessScope[]; disabled: boolean; onChange: (value: AccessScope[]) => void }) {
  const availableKinds = (Object.keys(SCOPE_LABELS) as ScopeKind[]).filter((candidate) => (data.scopeOptions[candidate]?.length ?? 0) > 0 || value.some((scope) => scope.kind === candidate));
  const [kind, setKind] = useState<ScopeKind>(availableKinds.includes('mall') ? 'mall' : (availableKinds[0] ?? 'mall'));
  const options = data.scopeOptions[kind] ?? [];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap gap-2 mb-3">
        {availableKinds.map((key) => (
          <button type="button" disabled={disabled} key={key} onClick={() => setKind(key)} className={`px-2.5 py-1 rounded-lg text-[11px] ${kind === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {SCOPE_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value.some((scope) => scope.kind === kind && scope.resourceId === option.id);
          return (
            <button
              type="button"
              disabled={disabled}
              key={option.id}
              onClick={() => onChange(active ? value.filter((scope) => !(scope.kind === kind && scope.resourceId === option.id)) : [...value, { kind, resourceId: option.id }])}
              className={`px-3 py-2 rounded-lg border text-xs ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}
            >
              {option.name}
            </button>
          );
        })}
        {options.length === 0 && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            当前没有可授权资源
          </span>
        )}
      </div>
    </div>
  );
}
function Title({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h4 className="font-bold text-slate-900 text-xs">{text}</h4>
      <span className="text-[10px] text-slate-400">{hint}</span>
    </div>
  );
}
function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
