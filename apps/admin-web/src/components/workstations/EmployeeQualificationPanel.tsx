import React, { useEffect, useState } from 'react';
import { Pencil, Search, Tag, X } from 'lucide-react';
import { updateEmployeeQualification, type EmployeeQualification, type QualificationGovernanceData } from '../../services/qualification';
import { Empty } from './QualificationGovernancePanel';

type Props = { governance: QualificationGovernanceData; refresh: () => Promise<void>; runProtected: (action: () => Promise<void>) => void; setNotice: (message: string) => void; setError: (message: string) => void };
export function EmployeeQualificationPanel(props: Props) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<EmployeeQualification | null>(null);
  const filtered = props.governance.employees.filter(
    (employee) => !query || `${employee.name} ${employee.employeeNo} ${employee.departmentName ?? ''} ${employee.cityName ?? ''} ${employee.tags.map((tag) => tag.code).join(' ')}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <b className="text-sm text-slate-900">当前商城员工</b>
          <p className="text-[11px] text-slate-500">管理员先人工维护城市和标签；未来接 HR 时外部标签不会被人工覆盖。</p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索员工或标签" className="w-48 text-xs outline-none" />
        </label>
      </div>
      {!filtered.length ? (
        <Empty text="当前商城暂无可维护员工。" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3">员工</th>
                <th className="p-3">部门 / 城市</th>
                <th className="p-3">人工与外部标签</th>
                <th className="p-3">状态</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((employee) => (
                <tr key={employee.userId} className="border-t border-slate-100">
                  <td className="p-3">
                    <b className="block text-slate-800">{employee.name}</b>
                    <small className="font-mono text-slate-400">{employee.employeeNo}</small>
                  </td>
                  <td className="p-3 text-slate-600">
                    {employee.departmentName ?? '未分部门'} · {employee.cityName ?? '未设城市'}
                  </td>
                  <td className="p-3">
                    <div className="flex max-w-xl flex-wrap gap-1">
                      {employee.tags.map((tag) => (
                        <span key={tag.code} className={`rounded-full px-2 py-1 text-[10px] ${tag.source === 'manual' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                          <Tag className="mr-1 inline h-3 w-3" />
                          {tag.code}
                          {tag.source !== 'manual' ? ` · ${tag.source}` : ''}
                        </span>
                      ))}
                      {!employee.tags.length && <span className="text-slate-400">无标签</span>}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={employee.status === 'active' ? 'text-emerald-700' : 'text-slate-400'}>{employee.status === 'active' ? '有效' : '停用'}</span>
                  </td>
                  <td className="p-3 text-right">
                    {props.governance.capabilities.manageEmployees && (
                      <button onClick={() => setEditing(employee)} className="rounded-lg border border-slate-200 p-2 text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EmployeeDialog employee={editing} close={() => setEditing(null)} {...props} />}
    </>
  );
}

function EmployeeDialog({ employee, close, refresh, runProtected, setNotice, setError }: Props & { employee: EmployeeQualification; close: () => void }) {
  const [cityCode, setCityCode] = useState(employee.cityCode ?? '');
  const [cityName, setCityName] = useState(employee.cityName ?? '');
  const [status, setStatus] = useState<'active' | 'disabled'>(employee.status);
  const [tagText, setTagText] = useState(
    employee.tags
      .filter((tag) => tag.source === 'manual')
      .map((tag) => tag.code)
      .join(', ')
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCityCode(employee.cityCode ?? '');
    setCityName(employee.cityName ?? '');
  }, [employee]);
  const save = () => {
    const tags = [
      ...new Set(
        tagText
          .split(/[,，\n]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      ),
    ];
    if (reason.trim().length < 4) return setError('员工资格变更原因至少填写四个字。');
    runProtected(async () => {
      setBusy(true);
      setError('');
      try {
        await updateEmployeeQualification(employee.userId, {
          expectedVersion: employee.version,
          cityCode: cityCode.trim() || null,
          cityName: cityName.trim() || null,
          status,
          attributes: {},
          tags: tags.map((code) => ({ code, startsAt: null, endsAt: null })),
          reason: reason.trim(),
        });
        close();
        setNotice('员工资格事实已更新并写入审计记录。');
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '员工资格更新失败');
      } finally {
        setBusy(false);
      }
    });
  };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
      <section className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b p-5">
          <div>
            <h3 className="font-black text-slate-900">维护员工资格</h3>
            <p className="text-xs text-slate-500">
              {employee.name} · {employee.employeeNo}
            </p>
          </div>
          <button onClick={close}>
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="城市编码" value={cityCode} set={setCityCode} />
            <Field label="城市名称" value={cityName} set={setCityName} />
          </div>
          <label className="block text-xs font-bold text-slate-700">
            资格状态
            <select value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'disabled')} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal">
              <option value="active">有效</option>
              <option value="disabled">停用</option>
            </select>
          </label>
          <Field label="人工标签（逗号分隔）" value={tagText} set={setTagText} />
          <p className="text-[11px] text-slate-500">
            外部来源标签只读保留：
            {employee.tags
              .filter((tag) => tag.source !== 'manual')
              .map((tag) => `${tag.code} (${tag.source})`)
              .join('、') || '暂无'}
          </p>
          <Field label="变更原因（必填）" value={reason} set={setReason} />
        </div>
        <footer className="flex justify-end gap-2 border-t bg-slate-50 p-4">
          <button onClick={close} className="rounded-lg border px-4 py-2 text-xs">
            取消
          </button>
          <button disabled={busy || reason.trim().length < 4} onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:bg-slate-300">
            {busy ? '保存中…' : '验证并保存'}
          </button>
        </footer>
      </section>
    </div>
  );
}
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <input value={value} onChange={(event) => set(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" />
    </label>
  );
}
