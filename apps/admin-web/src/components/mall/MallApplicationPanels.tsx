import { History, RotateCcw, ShieldCheck, Store } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { MallApplication, MallApplicationCenter, MallApplicationConfig } from '../../services/mallApplications';
import { Field } from './MallApplicationEditor';
import { MallPhonePreview } from './MallPhonePreview';

export type CopyForm = { name: string; code: string; publicSlug: string };

export function MallPicker(props: { center: MallApplicationCenter; selected: MallApplication; onSelect: (id: string) => void }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 px-2 py-3 font-bold text-slate-900">
        <Store className="h-4 w-4 text-blue-600" />
        我的商城
      </div>
      <div className="space-y-2">
        {props.center.malls.map((mall) => (
          <button key={mall.id} onClick={() => props.onSelect(mall.id)} className={`w-full rounded-xl border p-3 text-left ${mall.id === props.selected.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{mall.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${mall.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{mall.status === 'active' ? '已上线' : '草稿态'}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {mall.code} · {mall.publicSlug}
            </p>
            <p className="mt-2 text-xs text-blue-700">
              草稿 v{mall.draftVersion.versionNo} / 已发布 v{mall.publishedVersion.versionNo}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}

export function HistoryPanel(props: { center: MallApplicationCenter; selected: MallApplication; busy: string; onRestore: (versionId: string, versionNo: number) => Promise<void> }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-blue-600" />
        <h2 className="font-bold text-slate-900">版本历史与回退</h2>
      </div>
      <div className="mt-4 space-y-2">
        {props.selected.history.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <div>
              <p className="font-bold text-slate-800">
                v{item.versionNo} · {item.lifecycle === 'published' ? '已发布' : '草稿'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.reason} · {new Date(item.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
            <button
              disabled={!props.center.capabilities.decorate || !!props.busy || item.id === props.selected.draftVersion.id}
              onClick={() => void props.onRestore(item.id, item.versionNo)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 disabled:text-slate-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PreviewAndGuard(props: { config: MallApplicationConfig; frozenRules: string[] }) {
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-900">手机实时预览</h2>
        <p className="mb-5 mt-1 text-xs text-slate-500">预览当前草稿，不代表已发布。</p>
        <MallPhonePreview config={props.config} />
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <div>
            <p className="font-bold text-blue-950">VI 与安全边界已锁定</p>
            {props.frozenRules.map((rule) => (
              <p key={rule} className="mt-2 text-xs text-blue-800">
                • {rule}
              </p>
            ))}
            <p className="mt-3 text-xs leading-5 text-blue-700">复制只包含页面配置，不复制会员、余额、卡券、订单、财务与审计。</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function CopyPanel(props: { form: CopyForm; setForm: Dispatch<SetStateAction<CopyForm>>; busy: string; onCancel: () => void; onCreate: () => Promise<void> }) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold">复制当前页面配置为新商城</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="新商城名称" value={props.form.name} onChange={(name) => props.setForm((value) => ({ ...value, name }))} />
        <Field label="商城编码" value={props.form.code} onChange={(code) => props.setForm((value) => ({ ...value, code }))} />
        <Field label="访问标识" value={props.form.publicSlug} onChange={(publicSlug) => props.setForm((value) => ({ ...value, publicSlug }))} />
      </div>
      <p className="mt-3 text-xs text-slate-500">只复制页面配置；新商城从独立的会员、商品、卡券、订单和财务数据开始。</p>
      <div className="mt-4 flex gap-2">
        <button onClick={props.onCancel} className="rounded-lg border px-3 py-2">
          取消
        </button>
        <button disabled={!!props.busy} onClick={() => void props.onCreate()} className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white">
          确认创建
        </button>
      </div>
    </div>
  );
}

export function copyDefaults(selected: MallApplication): CopyForm {
  const suffix = String(Date.now()).slice(-5);
  return { name: `${selected.name} 副本`, code: `${selected.code}_${suffix}`, publicSlug: `${selected.publicSlug}-${suffix}` };
}
