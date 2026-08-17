import { Save, Send } from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { MallApplication, MallApplicationCenter, MallApplicationConfig } from '../../services/mallApplications';

type EditorProps = {
  center: MallApplicationCenter;
  selected: MallApplication;
  config: MallApplicationConfig;
  setConfig: Dispatch<SetStateAction<MallApplicationConfig | null>>;
  reason: string;
  setReason: (value: string) => void;
  busy: string;
  onSave: () => Promise<void>;
  onPublish: () => Promise<void>;
};

export function MallApplicationEditor(props: EditorProps) {
  const { center, selected, config, setConfig, reason, setReason, busy, onSave, onPublish } = props;
  const update = (patch: Partial<MallApplicationConfig>) => {
    setConfig((current) => (current ? { ...current, ...patch } : current));
  };
  const changeEntry = (index: number, patch: Partial<MallApplicationConfig['entries'][number]>) => {
    update({ entries: config.entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) });
  };
  const changeSegment = (index: number, patch: Partial<MallApplicationConfig['segments'][number]>) => {
    update({ segments: config.segments.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)) });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">编辑草稿</h2>
          <p className="mt-1 text-xs text-slate-500">
            {selected.name} · 并发版本 {selected.rowVersion}
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">未发布修改区</span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="商城显示名称" value={config.mallDisplayName} onChange={(mallDisplayName) => update({ mallDisplayName })} />
        <Select
          label="主题风格"
          value={config.themePreset}
          onChange={(themePreset) => update({ themePreset: themePreset as MallApplicationConfig['themePreset'] })}
          options={[
            ['smart-blue', '智慧蓝'],
            ['city-blue', '城市蓝'],
            ['festival-blue', '福利季蓝'],
          ]}
        />
        <Field label="公告短句" value={config.announcement} onChange={(announcement) => update({ announcement })} wide />
        <Field label="主视觉标题" value={config.hero.title} onChange={(title) => update({ hero: { ...config.hero, title } })} />
        <Field label="主视觉副标题" value={config.hero.subtitle} onChange={(subtitle) => update({ hero: { ...config.hero, subtitle } })} />
        <Select
          label="首页推荐数量"
          value={String(config.recommendationLimit)}
          onChange={(value) => update({ recommendationLimit: Number(value) as MallApplicationConfig['recommendationLimit'] })}
          options={[
            ['2', '2 件'],
            ['4', '4 件'],
            ['6', '6 件'],
          ]}
        />
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 md:col-span-2">
          <p className="text-xs font-bold text-blue-950">会员码入口已按 VI 锁定</p>
          <p className="mt-1 text-xs text-blue-700">
            {config.memberCodeCta.title} · {config.memberCodeCta.description}
          </p>
        </div>
        <Field
          label="合作卖场（逗号分隔）"
          value={config.partners.join('，')}
          onChange={(value) =>
            update({
              partners: value
                .split(/[，,]/)
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
          wide
        />
      </div>
      <EditorList title="首页快捷入口">
        {config.entries.map((entry, index) => (
          <EditorRow key={entry.key} title={entry.key} value={entry.label} visible={entry.visible} onValue={(label) => changeEntry(index, { label })} onVisible={(visible) => changeEntry(index, { visible })} />
        ))}
      </EditorList>
      <EditorList title="首页业务板块">
        {config.segments.map((segment, index) => (
          <EditorRow
            key={segment.key}
            title={segment.key}
            value={segment.title}
            secondary={segment.description}
            visible={segment.visible}
            onValue={(title) => changeSegment(index, { title })}
            onSecondary={(description) => changeSegment(index, { description })}
            onVisible={(visible) => changeSegment(index, { visible })}
          />
        ))}
      </EditorList>
      <div className="mt-5">
        <Field label="本次变更原因" value={reason} onChange={setReason} wide />
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Action disabled={!center.capabilities.decorate || !!busy} onClick={onSave} label="保存草稿" icon={<Save className="h-4 w-4" />} />
        <Action disabled={!center.capabilities.publish || !!busy} onClick={onPublish} label="发布到小程序" icon={<Send className="h-4 w-4" />} primary />
      </div>
    </div>
  );
}

export function Field(props: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <label className={props.wide ? 'md:col-span-2' : ''}>
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{props.label}</span>
      <input value={props.value} onChange={(event) => props.onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400" />
    </label>
  );
}

function Select(props: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">
        {props.options.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditorList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-bold text-slate-800">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EditorRow(props: { title: string; value: string; secondary?: string; visible: boolean; onValue: (value: string) => void; onSecondary?: (value: string) => void; onVisible: (value: boolean) => void }) {
  return (
    <div className="grid grid-cols-[76px_1fr_auto] items-center gap-2 rounded-xl bg-slate-50 p-2">
      <span className="text-xs font-bold text-slate-500">{props.title}</span>
      <div className="flex gap-2">
        <input value={props.value} onChange={(event) => props.onValue(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5" />
        {props.secondary !== undefined && <input value={props.secondary} onChange={(event) => props.onSecondary?.(event.target.value)} className="min-w-0 flex-[1.5] rounded-lg border border-slate-200 px-2 py-1.5" />}
      </div>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={props.visible} onChange={(event) => props.onVisible(event.target.checked)} />
        显示
      </label>
    </div>
  );
}

function Action(props: { disabled: boolean; onClick: () => Promise<void>; label: string; icon: ReactNode; primary?: boolean }) {
  return (
    <button
      disabled={props.disabled}
      onClick={() => void props.onClick()}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold disabled:opacity-40 ${props.primary ? 'bg-[var(--sw-brand)] text-white' : 'border border-slate-200 bg-white text-slate-800'}`}
    >
      {props.icon}
      {props.label}
    </button>
  );
}
