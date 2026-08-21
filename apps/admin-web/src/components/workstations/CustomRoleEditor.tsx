import React, { useMemo, useState } from 'react';
import { Copy, Save, ShieldCheck } from 'lucide-react';
import type { CustomRole, CustomRoleCenterData } from '../../services/customRoles';
import { permissionsByCategory, RISK_LABELS } from './accessControlHelpers';

export function RoleDetails({
  role,
  data,
  canCreate,
  canUpdate,
  canDisable,
  saving,
  onClone,
  onEdit,
  onStatus,
}: {
  role: CustomRole;
  data: CustomRoleCenterData;
  canCreate: boolean;
  canUpdate: boolean;
  canDisable: boolean;
  saving: boolean;
  onClone: () => void;
  onEdit: () => void;
  onStatus: (status: 'active' | 'disabled') => void;
}) {
  const permissions = data.permissions.filter((permission) => role.permissions.includes(permission.code));
  return (
    <div>
      <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">{role.name}</h3>
            <RoleStatus role={role} />
          </div>
          <p className="text-xs text-slate-500 mt-2">{role.description || '暂无角色说明'}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canCreate && !role.isOwner && (
            <button disabled={saving} onClick={onClone} className={ACTION_BUTTON}>
              <Copy className="w-3.5 h-3.5" />
              复制
            </button>
          )}
          {canUpdate && role.isEditable && !role.isSystem && !role.isOwner && (
            <button disabled={saving} onClick={onEdit} className={ACTION_BUTTON}>
              编辑
            </button>
          )}
          {role.isEditable && !role.isSystem && !role.isOwner && ((role.status === 'active' && canDisable) || (role.status === 'disabled' && canUpdate)) && (
            <button disabled={saving} onClick={() => onStatus(role.status === 'active' ? 'disabled' : 'active')} className={ACTION_BUTTON}>
              {role.status === 'active' ? '停用' : '重新启用'}
            </button>
          )}
        </div>
      </div>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="权限数量" value={role.permissions.length} />
          <Stat label="使用人数" value={role.assignmentCount} />
          <Stat label="角色类型" value={role.isOwner ? '唯一 Owner' : role.isSystem ? '系统模板' : '自定义'} />
        </div>
        {permissionsByCategory(permissions).map(([category, items]) => (
          <section key={category}>
            <h4 className="text-[11px] font-bold text-slate-400 mb-2">{category}</h4>
            <div className="flex flex-wrap gap-2">
              {items.map((permission) => (
                <span key={permission.code} className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-700">
                  {permission.name}
                  {permission.risk !== 'low' && <em className="ml-1 not-italic text-[9px] text-rose-600">{RISK_LABELS[permission.risk]}</em>}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function RoleEditor({
  data,
  role,
  mode,
  saving,
  onCancel,
  onSubmit,
}: {
  data: CustomRoleCenterData;
  role?: CustomRole;
  mode: 'create' | 'edit' | 'clone';
  saving: boolean;
  onCancel: () => void;
  onSubmit: (value: { code: string; name: string; description: string; permissionCodes: string[]; reason: string }) => void;
}) {
  const [code, setCode] = useState(mode === 'clone' ? `${role?.code.slice(0, 31) ?? 'role'}_copy` : '');
  const [name, setName] = useState(mode === 'clone' ? `${role?.name ?? ''} 副本` : (role?.name ?? ''));
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissionCodes, setPermissionCodes] = useState<string[]>(role?.permissions ?? []);
  const [reason, setReason] = useState('');
  const grantable = useMemo(() => data.permissions.filter((permission) => permission.grantable || permissionCodes.includes(permission.code)), [data.permissions, permissionCodes]);
  const valid = name.trim().length >= 2 && reason.trim().length >= 4 && (mode === 'edit' || /^[a-z][a-z0-9_]{2,39}$/.test(code));
  return (
    <div className="p-5 space-y-5">
      <div>
        <h3 className="font-bold text-slate-900">{mode === 'edit' ? '编辑自定义角色' : mode === 'clone' ? '复制角色模板' : '创建自定义角色'}</h3>
        <p className="text-xs text-slate-500 mt-1">只能选择当前账号有权转授的权限，Owner 权限永远不可复制。</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {mode !== 'edit' && (
          <Field label="角色编码">
            <input value={code} onChange={(event) => setCode(event.target.value.toLowerCase())} placeholder="support_lead" />
          </Field>
        )}
        <Field label="角色名称">
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
        </Field>
      </div>
      <Field label="角色说明">
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={300} />
      </Field>
      {mode !== 'clone' ? (
        <div className="max-h-[380px] overflow-y-auto rounded-xl border border-slate-200 p-3 space-y-4">
          {permissionsByCategory(grantable).map(([category, permissions]) => (
            <section key={category}>
              <div className="text-[10px] font-bold text-slate-400 mb-2">{category}</div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5">
                {permissions.map((permission) => (
                  <label key={permission.code} className={`rounded-lg px-2 py-1.5 text-xs flex gap-2 ${permissionCodes.includes(permission.code) ? 'bg-blue-50 text-blue-800' : 'text-slate-600'}`}>
                    <input type="checkbox" checked={permissionCodes.includes(permission.code)} onChange={() => setPermissionCodes(toggle(permissionCodes, permission.code))} />
                    {permission.name}
                    {permission.risk !== 'low' && <em className="ml-auto not-italic text-[9px] text-rose-600">{RISK_LABELS[permission.risk]}</em>}
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          将复制“{role?.name}”的 {role?.permissions?.length ?? 0} 项权限；新角色仍是普通自定义角色。
        </div>
      )}
      <Field label="变更原因">
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} placeholder="例如：新增客服组长岗位模板" />
      </Field>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-xs text-slate-500">
          取消
        </button>
        <button
          disabled={!valid || saving}
          onClick={() => onSubmit({ code, name: name.trim(), description: description.trim(), permissionCodes, reason: reason.trim() })}
          className="px-4 py-2 rounded-xl bg-blue-600 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? '正在保存…' : '保存角色'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-500 mb-1.5">{label}</span>
      {React.cloneElement(children, { className: 'w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-400' })}
    </label>
  );
}
export function RoleStatus({ role }: { role: CustomRole }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${role.status === 'disabled' ? 'bg-slate-200 text-slate-600' : role.isOwner ? 'bg-amber-100 text-amber-800' : role.isSystem ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}
    >
      {role.status === 'disabled' ? '已停用' : role.isOwner ? 'OWNER' : role.isSystem ? '系统' : '自定义'}
    </span>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
export function PanelState({ text, action }: { text: string; action?: () => void }) {
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
function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

const ACTION_BUTTON = 'px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-700 disabled:opacity-50 flex items-center gap-1.5';
