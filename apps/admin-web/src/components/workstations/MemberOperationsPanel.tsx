import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardCopy, FileUp, History, Link2, Plus, RefreshCw, Search } from 'lucide-react';
import {
  cachedMemberOperations,
  createInvitation,
  createMember,
  disableInvitation,
  importMembers,
  loadMemberOperations,
  updateMemberProfile,
  type MemberOperationsData,
  type MemberProfile,
  type NewMember,
} from '../../services/memberOperations';

interface Props {
  active: boolean;
  canInvite: boolean;
  canUpdate: boolean;
  canImport: boolean;
  runProtected: (action: () => Promise<void>) => void;
}
type View = 'members' | 'invitations' | 'imports' | 'history';

export function MemberOperationsPanel({ active, canInvite, canUpdate, canImport, runProtected }: Props) {
  const [data, setData] = useState<MemberOperationsData | null>(() => cachedMemberOperations());
  const [view, setView] = useState<View>('members');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newMemberOpen, setNewMemberOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(() => !cachedMemberOperations());
  const refresh = async (force = false) => {
    if (!data) setLoading(true);
    setError('');
    try {
      setData(await loadMemberOperations({ force }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '会员运营数据读取失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (active) void refresh();
  }, [active]);
  const stats = useMemo(
    () => ({
      active: data?.profiles.filter((member) => member.status === 'active').length ?? 0,
      unbound: data?.profiles.filter((member) => !member.phoneBound).length ?? 0,
      invites: data?.invitations.filter((invite) => invite.status === 'active').length ?? 0,
    }),
    [data]
  );
  if (!active) return null;
  return (
    <div className="space-y-4">
      <div className="rounded-[14px] border border-blue-100 bg-blue-50/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">会员运营中心</h3>
          <p className="text-xs text-slate-500 mt-1">邀请码、后台建会员、资料维护、批量导入与操作历史</p>
        </div>
        <div className="flex gap-2">
          {canImport && (
            <>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void handleFile(event, runProtected, setNotice, setError, () => refresh(true))} />
              <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs flex gap-2 items-center">
                <FileUp className="w-4 h-4" />
                批量导入 CSV
              </button>
            </>
          )}
          {canInvite && (
            <button onClick={() => setInviteOpen(true)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs flex gap-2 items-center">
              <Link2 className="w-4 h-4" />
              创建邀请码
            </button>
          )}
          {canInvite && (
            <button onClick={() => setNewMemberOpen(true)} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs flex gap-2 items-center">
              <Plus className="w-4 h-4" />
              后台建会员
            </button>
          )}
          <button onClick={() => void refresh(true)} disabled={loading} className="px-3 py-2 rounded-xl border border-slate-200 bg-white disabled:opacity-60" aria-label="刷新会员运营数据">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Metric label="有效会员" value={stats.active} />
        <Metric label="手机未绑定" value={stats.unbound} />
        <Metric label="有效邀请码" value={stats.invites} />
      </div>
      {(error || notice) && <div className={`rounded-xl px-4 py-3 text-xs ${error ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{error || notice}</div>}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          ['members', '会员档案'],
          ['invitations', '邀请码'],
          ['imports', '导入报告'],
          ['history', '操作历史'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setView(id as View)} className={`px-3 py-2 text-xs border-b-2 ${view === id ? 'border-blue-500 text-blue-700 font-bold' : 'border-transparent text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>
      {!data ? (
        <div className="py-16 text-center text-sm text-slate-400">正在读取会员运营数据…</div>
      ) : view === 'members' ? (
        <Members profiles={data.profiles} departments={data.departments} canUpdate={canUpdate} runProtected={runProtected} refresh={() => refresh(true)} setError={setError} />
      ) : view === 'invitations' ? (
        <Invitations data={data} canInvite={canInvite} runProtected={runProtected} refresh={() => refresh(true)} setError={setError} />
      ) : view === 'imports' ? (
        <Imports data={data} />
      ) : (
        <HistoryList data={data} />
      )}
      {newMemberOpen && (
        <NewMemberDialog
          departments={data?.departments ?? []}
          onClose={() => setNewMemberOpen(false)}
          onSubmit={(value) =>
            runProtected(async () => {
              try {
                await createMember(value);
                setNewMemberOpen(false);
                setNotice('会员已创建；首次登录后必须修改临时密码。');
                await refresh(true);
              } catch (cause) {
                setError(message(cause));
              }
            })
          }
        />
      )}
      {inviteOpen && (
        <InvitationDialog
          onClose={() => setInviteOpen(false)}
          onSubmit={(value) =>
            runProtected(async () => {
              try {
                const created = await createInvitation(value);
                setInviteOpen(false);
                setNotice(`邀请码 ${created.code}（关闭提示后系统不再显示明文，请立即复制给员工）`);
                await navigator.clipboard?.writeText(created.code).catch(() => undefined);
                await refresh(true);
              } catch (cause) {
                setError(message(cause));
              }
            })
          }
        />
      )}
    </div>
  );
}

function Members({
  profiles,
  departments,
  canUpdate,
  runProtected,
  refresh,
  setError,
}: {
  profiles: MemberProfile[];
  departments: Array<{ id: string; name: string }>;
  canUpdate: boolean;
  runProtected: Props['runProtected'];
  refresh: () => Promise<void>;
  setError: (value: string) => void;
}) {
  const [editing, setEditing] = useState<MemberProfile | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = useMemo(
    () => profiles.filter((member) => !deferredQuery || [member.displayName, member.username, member.employeeNo, member.departmentName].some((value) => value?.toLowerCase().includes(deferredQuery))),
    [deferredQuery, profiles]
  );
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleProfiles = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-[260px] max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索姓名、账号、工号或部门"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400"
          />
        </label>
        <span className="text-[11px] text-slate-400">
          共 {filtered.length} 人 · 每页 {pageSize} 人
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 border-b">
              <th className="py-2">会员</th>
              <th>账号/工号</th>
              <th>部门</th>
              <th>认证</th>
              <th>状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleProfiles.map((member) => (
              <tr key={member.membershipId} className="border-b border-slate-100">
                <td className="py-3">
                  <b>{member.displayName}</b>
                  {member.isOwner && <span className="ml-2 text-amber-600">OWNER</span>}
                </td>
                <td>
                  {member.username ?? '—'}
                  <div className="text-[10px] text-slate-400">{member.employeeNo}</div>
                </td>
                <td>{member.departmentName ?? '未分配'}</td>
                <td>{member.phoneBound ? '手机已验证' : '账号认证 · 手机未验证'}</td>
                <td>{member.status}</td>
                <td>
                  {canUpdate && !member.isOwner && (
                    <button onClick={() => setEditing(member)} className="text-blue-600">
                      编辑资料
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
          <button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border p-2 disabled:opacity-40" aria-label="上一页">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            第 {currentPage}/{pageCount} 页
          </span>
          <button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border p-2 disabled:opacity-40" aria-label="下一页">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {editing && (
        <EditProfileDialog
          member={editing}
          departments={departments}
          onClose={() => setEditing(null)}
          onSubmit={(value) =>
            runProtected(async () => {
              try {
                await updateMemberProfile(editing.membershipId, value);
                setEditing(null);
                await refresh();
              } catch (cause) {
                setError(message(cause));
              }
            })
          }
        />
      )}
    </>
  );
}
function Invitations({ data, canInvite, runProtected, refresh, setError }: { data: MemberOperationsData; canInvite: boolean; runProtected: Props['runProtected']; refresh: () => Promise<void>; setError: (value: string) => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {data.invitations.map((invite) => (
        <div key={invite.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex justify-between">
            <b>{invite.label}</b>
            <span className="text-xs text-slate-500">{invite.status}</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            已用 {invite.useCount}/{invite.maxUses} · 截止 {new Date(invite.expiresAt).toLocaleString()}
          </div>
          {canInvite && invite.status === 'active' && (
            <button
              onClick={() => {
                const reason = window.prompt('请输入停用邀请码的原因');
                if (reason?.trim())
                  runProtected(async () => {
                    try {
                      await disableInvitation(invite.id, reason.trim());
                      await refresh();
                    } catch (cause) {
                      setError(message(cause));
                    }
                  });
              }}
              className="mt-3 text-xs text-rose-600"
            >
              停用
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
function Imports({ data }: { data: MemberOperationsData }) {
  return (
    <div className="space-y-2">
      {data.imports.map((job) => (
        <details key={job.id} className="rounded-xl border p-3 text-xs">
          <summary className="flex justify-between cursor-pointer">
            <span>{job.sourceName}</span>
            <span>
              成功 {job.successRows} · 失败 {job.failedRows} · {job.status}
            </span>
          </summary>
          {job.errors.length > 0 && (
            <div className="mt-3 space-y-1 border-t pt-2">
              {job.errors.map((error) => (
                <div key={error.rowNumber} className="text-rose-700">
                  第 {error.rowNumber} 行 · {error.message} <span className="text-slate-400">({error.code})</span>
                </div>
              ))}
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
function HistoryList({ data }: { data: MemberOperationsData }) {
  return (
    <div className="space-y-2">
      {data.history.length ? (
        data.history.map((item) => (
          <div key={item.id} className="rounded-xl border p-3 flex gap-3 text-xs">
            <History className="w-4 h-4 text-slate-400" />
            <div>
              <b>{item.action}</b>
              <div className="text-slate-400 mt-1">
                {new Date(item.createdAt).toLocaleString()} · {item.resourceId ?? '—'}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="py-12 text-center text-sm text-slate-400">当前账号无审计查看权限，或暂无操作记录。</div>
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function NewMemberDialog({ departments, onClose, onSubmit }: { departments: Array<{ id: string; name: string }>; onClose: () => void; onSubmit: (value: NewMember) => void }) {
  const [value, setValue] = useState<NewMember>({ username: '', password: '', displayName: '' });
  return (
    <Dialog title="后台创建普通员工会员" onClose={onClose}>
      <Fields value={value} setValue={setValue} departments={departments} />
      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg">只能创建员工端账号，不能创建管理员或 Owner；临时密码首次登录后必须修改。</p>
      <button onClick={() => onSubmit(value)} className="w-full px-3 py-2 rounded-xl bg-blue-600 text-white text-xs flex items-center justify-center">
        创建会员
      </button>
    </Dialog>
  );
}
function EditProfileDialog({
  member,
  departments,
  onClose,
  onSubmit,
}: {
  member: MemberProfile;
  departments: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (value: { displayName: string; email?: string; departmentId?: string; reason: string }) => void;
}) {
  const [displayName, setDisplayName] = useState(member.displayName);
  const [email, setEmail] = useState(member.email ?? '');
  const [departmentId, setDepartmentId] = useState(member.departmentId ?? '');
  const [reason, setReason] = useState('管理员更新会员资料');
  return (
    <Dialog title="编辑会员资料" onClose={onClose}>
      <Input label="姓名" value={displayName} onChange={setDisplayName} />
      <Input label="邮箱" value={email} onChange={setEmail} />
      <Select label="部门" value={departmentId} onChange={setDepartmentId} options={departments} />
      <Input label="变更原因" value={reason} onChange={setReason} />
      <button onClick={() => onSubmit({ displayName, email, departmentId: departmentId || undefined, reason })} className="w-full px-3 py-2 rounded-xl bg-blue-600 text-white text-xs flex items-center justify-center">
        保存并记录审计
      </button>
    </Dialog>
  );
}
function InvitationDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (value: { label: string; maxUses: number; expiresAt: string }) => void }) {
  const [label, setLabel] = useState('新员工入职邀请');
  const [maxUses, setMaxUses] = useState('20');
  const [days, setDays] = useState('7');
  return (
    <Dialog title="创建员工邀请码" onClose={onClose}>
      <Input label="用途名称" value={label} onChange={setLabel} />
      <Input label="最多使用次数" value={maxUses} onChange={setMaxUses} />
      <Input label="有效天数（1-90）" value={days} onChange={setDays} />
      <button
        onClick={() => onSubmit({ label, maxUses: Number(maxUses), expiresAt: new Date(Date.now() + Number(days) * 86_400_000).toISOString() })}
        className="w-full px-3 py-2 rounded-xl bg-blue-600 text-white text-xs flex items-center justify-center gap-2"
      >
        <ClipboardCopy className="w-4 h-4" />
        生成并复制
      </button>
    </Dialog>
  );
}
function Fields({ value, setValue, departments }: { value: NewMember; setValue: (value: NewMember) => void; departments: Array<{ id: string; name: string }> }) {
  return (
    <>
      <Input label="登录账号（英文开头，4-32位）" value={value.username} onChange={(username) => setValue({ ...value, username })} />
      <Input label="临时密码（至少10位，含字母和数字）" value={value.password} onChange={(password) => setValue({ ...value, password })} type="password" />
      <Input label="姓名" value={value.displayName} onChange={(displayName) => setValue({ ...value, displayName })} />
      <Input label="员工编号（可空）" value={value.employeeNo ?? ''} onChange={(employeeNo) => setValue({ ...value, employeeNo })} />
      <Input label="邮箱（可空）" value={value.email ?? ''} onChange={(email) => setValue({ ...value, email })} />
      <Select label="部门（可空）" value={value.departmentId ?? ''} onChange={(departmentId) => setValue({ ...value, departmentId })} options={departments} />
    </>
  );
}
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between">
          <b>{title}</b>
          <button onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-xs text-slate-600">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 outline-none" />
    </label>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }> }) {
  return (
    <label className="block text-xs text-slate-600">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2">
        <option value="">未分配</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function message(cause: unknown) {
  return cause instanceof Error ? cause.message : '操作失败';
}

async function handleFile(event: React.ChangeEvent<HTMLInputElement>, runProtected: Props['runProtected'], setNotice: (value: string) => void, setError: (value: string) => void, refresh: () => Promise<void>) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    runProtected(async () => {
      try {
        const report = await importMembers(file.name, rows);
        setNotice(`导入完成：成功 ${report.successRows} 行，失败 ${report.failedRows} 行${report.failedRows ? '；错误报告已保存。' : ''}`);
        await refresh();
      } catch (cause) {
        setError(message(cause));
      }
    });
  } catch (cause) {
    setError(message(cause));
  }
}
function parseCsv(text: string): NewMember[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV 至少需要标题行和一行会员数据');
  const headers = splitCsv(lines[0]);
  const required = ['username', 'password', 'displayName'];
  if (required.some((key) => !headers.includes(key))) throw new Error('CSV 必须包含 username、password、displayName 三列');
  return lines.slice(1).map((line) => {
    const values = splitCsv(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])) as unknown as NewMember;
  });
}
function splitCsv(line: string) {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}
