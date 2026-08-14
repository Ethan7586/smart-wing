import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { createCustomRole, loadCustomRoles, setCustomRoleStatus, updateCustomRole, type CustomRoleCenterData } from '../../services/customRoles';
import { PanelState, RoleDetails, RoleEditor, RoleStatus } from './CustomRoleEditor';

interface Props {
  active: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDisable: boolean;
  runProtected: (action: () => Promise<void>) => void;
  onChanged: () => Promise<void>;
}
type Mode = 'view' | 'create' | 'edit' | 'clone';

export function CustomRoleCenterPanel({ active, canCreate, canUpdate, canDisable, runProtected, onChanged }: Props) {
  const [data, setData] = useState<CustomRoleCenterData | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<Mode>('view');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await loadCustomRoles();
      setData(next);
      setSelectedId((current) => (next.roles.some((role) => role.id === current) ? current : (next.roles.find((role) => !role.isOwner)?.id ?? next.roles[0]?.id ?? '')));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '角色中心读取失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (active && !data) void refresh();
  }, [active, data]);
  if (!active) return null;
  if (loading && !data) return <PanelState text="正在读取角色与权限字典…" />;
  if (!data) return <PanelState text={error || '暂无角色数据'} action={refresh} />;
  const selected = data.roles.find((role) => role.id === selectedId) ?? null;
  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}
      <div className="grid grid-cols-12 gap-5 items-start">
        <section className="col-span-12 xl:col-span-4 rounded-[14px] border border-slate-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <div>
              <b className="text-sm text-slate-900">角色模板</b>
              <div className="text-[10px] text-slate-400 mt-1">{data.roles.filter((role) => role.status === 'active').length} 个启用</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void refresh()} className="p-2 rounded-lg bg-slate-100 text-slate-500" aria-label="刷新角色">
                <RefreshCw className="w-4 h-4" />
              </button>
              {canCreate && (
                <button
                  onClick={() => {
                    setMode('create');
                    setSelectedId('');
                  }}
                  className="p-2 rounded-lg bg-blue-600 text-white"
                  aria-label="创建角色"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[690px] overflow-y-auto">
            {data.roles.map((role) => (
              <button
                key={role.id}
                onClick={() => {
                  setSelectedId(role.id);
                  setMode('view');
                }}
                className={`w-full p-4 text-left border-b border-slate-100 ${selectedId === role.id && mode === 'view' ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'} ${role.status === 'disabled' ? 'opacity-60' : ''}`}
              >
                <div className="flex justify-between gap-2">
                  <b className="text-sm text-slate-900">{role.name}</b>
                  <RoleStatus role={role} />
                </div>
                <div className="font-mono text-[10px] text-slate-400 mt-1">{role.code}</div>
                <div className="text-[10px] text-slate-500 mt-2">
                  {role.permissions.length} 项权限 · {role.assignmentCount} 人使用
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="col-span-12 xl:col-span-8 rounded-[14px] border border-slate-200 bg-white overflow-hidden">
          {mode === 'create' ? (
            <RoleEditor
              key="create"
              data={data}
              mode="create"
              saving={saving}
              onCancel={() => setMode('view')}
              onSubmit={(value) =>
                protect(async () => {
                  await createCustomRole(value);
                  await finish();
                })
              }
            />
          ) : mode === 'clone' && selected ? (
            <RoleEditor
              key={`clone-${selected.id}`}
              data={data}
              role={selected}
              mode="clone"
              saving={saving}
              onCancel={() => setMode('view')}
              onSubmit={(value) =>
                protect(async () => {
                  await createCustomRole({ ...value, permissionCodes: [], sourceRoleId: selected.id });
                  await finish();
                })
              }
            />
          ) : mode === 'edit' && selected ? (
            <RoleEditor
              key={`edit-${selected.id}`}
              data={data}
              role={selected}
              mode="edit"
              saving={saving}
              onCancel={() => setMode('view')}
              onSubmit={(value) =>
                protect(async () => {
                  await updateCustomRole(selected.id, value);
                  await finish();
                })
              }
            />
          ) : selected ? (
            <RoleDetails
              role={selected}
              data={data}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDisable={canDisable}
              saving={saving}
              onClone={() => setMode('clone')}
              onEdit={() => setMode('edit')}
              onStatus={(status) => {
                const reason = window.prompt(status === 'disabled' ? '请输入停用原因；已分配人员会立即失去该角色' : '请输入重新启用原因');
                if (!reason?.trim()) return;
                protect(async () => {
                  await setCustomRoleStatus(selected.id, status, reason.trim());
                  await finish();
                });
              }}
            />
          ) : (
            <PanelState text="选择一个角色，或创建新角色" />
          )}
        </section>
      </div>
    </div>
  );

  function protect(action: () => Promise<void>) {
    runProtected(async () => {
      setSaving(true);
      setError('');
      try {
        await action();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '角色操作失败');
      } finally {
        setSaving(false);
      }
    });
  }
  async function finish() {
    setMode('view');
    await Promise.all([refresh(), onChanged()]);
  }
}
