import React, { useState } from 'react';
import type { Option, QualificationSelector } from '../../services/qualification';

export const FormGrid = ({ children }: { children: React.ReactNode }) => <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;

export function TextField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="text-xs font-bold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-300"
      />
    </label>
  );
}

export function TextArea({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <span className="ml-2 font-normal text-slate-400">{hint}</span>
      <textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-300" />
    </label>
  );
}

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<readonly [string, string]> }) {
  return (
    <label className="text-xs font-bold text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal">
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="mt-6 flex cursor-pointer items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function CheckboxOptions({ label, options, values, onChange }: { label: string; options: Option[]; values: string[]; onChange: (values: string[]) => void }) {
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => !query || `${option.name} ${option.id}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <b className="text-xs text-slate-700">
          {label} · 已选 {values.length}
        </b>
        {options.length > 8 && <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-xs" />}
      </div>
      <div className="grid max-h-44 gap-2 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((option) => (
          <label key={option.id} className="flex cursor-pointer gap-2 rounded-lg bg-slate-50 p-2 text-xs">
            <input type="checkbox" checked={values.includes(option.id)} onChange={(event) => onChange(event.target.checked ? [...values, option.id] : values.filter((id) => id !== option.id))} />
            <span>
              <b className="block text-slate-700">{option.name}</b>
              <small className="font-mono text-slate-400">{option.id}</small>
            </span>
          </label>
        ))}
        {!filtered.length && <span className="text-xs text-slate-400">暂无可选项</span>}
      </div>
    </section>
  );
}

export function SelectorGroup({ label, kind, options, values, onChange }: { label: string; kind: string; options: Option[]; values: QualificationSelector[]; onChange: (value: QualificationSelector[]) => void }) {
  return (
    <CheckboxOptions
      label={label}
      options={options}
      values={values.filter((item) => item.kind === kind).map((item) => item.id)}
      onChange={(ids) => onChange([...values.filter((item) => item.kind !== kind), ...ids.map((id) => ({ kind, id }))])}
    />
  );
}
