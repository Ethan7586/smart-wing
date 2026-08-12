import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { QualificationCenterData, QualificationConfigKind } from '../../services/qualification';
import { SelectField, TextField } from './QualificationFormControls';
import { CatalogPoolEditor, CityZoneEditor, CommercialEditor, LimitEditor, PolicyEditor } from './QualificationRuleEditors';
import { initialQualificationForm, KIND_LABELS, number, qualificationPayload, text } from './qualificationConfigModel';

type Entity = Record<string, unknown> | null;
type SaveInput = { kind: QualificationConfigKind; entityId: string | null; expectedVersion: number; payload: Record<string, unknown>; reason: string };
export function QualificationConfigDialog({
  kind,
  entity,
  data,
  saving,
  onClose,
  onSave,
}: {
  kind: QualificationConfigKind | null;
  entity: Entity;
  data: QualificationCenterData;
  saving: boolean;
  onClose: () => void;
  onSave: (input: SaveInput) => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (kind) {
      setForm(initialQualificationForm(kind, entity));
      setReason('');
    }
  }, [kind, entity]);
  if (!kind) return null;
  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({ kind, entityId: text(entity?.id) || null, expectedVersion: number(entity?.version), payload: qualificationPayload(kind, form), reason: reason.trim() });
  };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-blue-600">QUALIFICATION CONFIG</p>
            <h2 className="text-lg font-black text-slate-900">
              {entity ? '编辑' : '新建'}
              {KIND_LABELS[kind]}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Editor kind={kind} form={form} set={set} data={data} />
          <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-[220px_1fr]">
            <SelectField
              label="保存状态"
              value={text(form.status)}
              onChange={(value) => set('status', value)}
              options={[
                ['draft', '草稿（不影响员工）'],
                ['active', '发布生效'],
                ['disabled', '停用规则'],
              ]}
            />
            <TextField label="变更原因（必填）" value={reason} onChange={setReason} placeholder="例如：为华东区员工开放夏季商品专区" />
          </div>
          {form.status !== 'draft' && (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              发布或停用会立即影响员工端资格，并要求再次验证管理员身份。
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-xs text-slate-600">
            取消
          </button>
          <button disabled={saving || reason.trim().length < 4} className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white disabled:bg-slate-300">
            {saving ? '正在保存…' : form.status === 'draft' ? '保存草稿' : form.status === 'active' ? '验证并发布' : '验证并停用'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Editor({ kind, form, set, data }: { kind: QualificationConfigKind; form: Record<string, unknown>; set: (key: string, value: unknown) => void; data: QualificationCenterData }) {
  if (kind === 'catalog_pool') return <CatalogPoolEditor form={form} set={set} data={data} />;
  if (kind === 'city_zone') return <CityZoneEditor form={form} set={set} data={data} />;
  if (kind === 'entitlement_policy') return <PolicyEditor form={form} set={set} data={data} />;
  if (kind === 'purchase_limit') return <LimitEditor form={form} set={set} data={data} />;
  return <CommercialEditor kind={kind} form={form} set={set} data={data} />;
}
