import { CopyPlus, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MallApplicationEditor } from '../mall/MallApplicationEditor';
import { CopyPanel, HistoryPanel, MallPicker, PreviewAndGuard, copyDefaults, type CopyForm } from '../mall/MallApplicationPanels';
import { createMallApplication, loadMallApplications, publishMallApplication, restoreMallApplication, saveMallApplicationDraft, type MallApplicationCenter, type MallApplicationConfig } from '../../services/mallApplications';

export function MallApplicationWorkstation() {
  const [center, setCenter] = useState<MallApplicationCenter | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [config, setConfig] = useState<MallApplicationConfig | null>(null);
  const [reason, setReason] = useState('更新商城页面展示配置');
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyForm, setCopyForm] = useState<CopyForm>({ name: '', code: '', publicSlug: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = useMemo(() => center?.malls?.find((mall) => mall.id === selectedId) ?? center?.malls?.[0] ?? null, [center, selectedId]);

  const refresh = async (preferredId?: string) => {
    const payload = await loadMallApplications();
    setCenter(payload);
    const next = payload.malls.find((mall) => mall.id === (preferredId ?? selectedId)) ?? payload.malls[0];
    setSelectedId(next?.id ?? '');
    setConfig(next ? structuredClone(next.draftVersion.config) : null);
  };

  useEffect(() => {
    void refresh().catch((cause) => setError(errorMessage(cause)));
  }, []);
  useEffect(() => {
    if (selected) setConfig(structuredClone(selected.draftVersion.config));
  }, [selected?.id, selected?.draftVersion.id]);

  const run = async (key: string, action: () => Promise<string | void>, success: string) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const preferredId = await action();
      await refresh(preferredId || undefined);
      setNotice(success);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setBusy('');
    }
  };

  if (!center) return <Loading error={error} />;
  if (!selected || !config) return <EmptyState error={error} />;

  const createCopy = async () => {
    const ok = await run('create', async () => (await createMallApplication({ ...copyForm, config, reason: '复制商城页面配置创建新应用' })).mallId, '新商城已创建为草稿，交易数据未复制');
    if (ok) setCopyOpen(false);
  };

  return (
    <section className="mx-auto max-w-[1500px] space-y-5 p-6">
      <header className="rounded-2xl bg-gradient-to-r from-[var(--sw-sidebar-top)] to-[var(--sw-brand-ink)] p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Mall Application Builder</p>
            <h1 className="mt-2 text-2xl font-bold">商城应用台</h1>
            <p className="mt-2 text-sm text-blue-100">同一套智慧翼代码，多商城独立配置。草稿不影响用户，发布后小程序才读取。</p>
          </div>
          {center.capabilities.manage && (
            <button
              onClick={() => {
                setCopyForm(copyDefaults(selected));
                setCopyOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 font-bold shadow-lg"
            >
              <CopyPlus className="h-4 w-4" />
              复制当前商城
            </button>
          )}
        </div>
      </header>

      {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}
      {copyOpen && <CopyPanel form={copyForm} setForm={setCopyForm} busy={busy} onCancel={() => setCopyOpen(false)} onCreate={createCopy} />}

      <div className="grid gap-5 xl:grid-cols-[250px_minmax(520px,1fr)_360px]">
        <MallPicker center={center} selected={selected} onSelect={setSelectedId} />
        <div className="space-y-5">
          <MallApplicationEditor
            center={center}
            selected={selected}
            config={config}
            setConfig={setConfig}
            reason={reason}
            setReason={setReason}
            busy={busy}
            onSave={() => run('save', () => saveMallApplicationDraft(selected.id, selected.rowVersion, config, reason), '草稿已保存并生成新版本').then(() => undefined)}
            onPublish={() => run('publish', () => publishMallApplication(selected.id, selected.rowVersion, reason), '商城版本已发布，小程序将读取新配置').then(() => undefined)}
          />
          <HistoryPanel
            center={center}
            selected={selected}
            busy={busy}
            onRestore={(versionId, versionNo) => run('restore', () => restoreMallApplication(selected.id, selected.rowVersion, versionId, `恢复历史版本 v${versionNo} 为新草稿`), `历史 v${versionNo} 已恢复为新草稿`).then(() => undefined)}
          />
        </div>
        <PreviewAndGuard config={config} frozenRules={center.frozenRules} />
      </div>
    </section>
  );
}

function Loading({ error }: { error: string }) {
  return (
    <section className="m-6 rounded-2xl border border-slate-200 bg-white p-8">
      <LoaderCircle className="h-6 w-6 animate-spin text-blue-600" />
      <p className="mt-3 font-bold">{error || '正在读取已授权商城应用…'}</p>
    </section>
  );
}

function EmptyState({ error }: { error: string }) {
  return (
    <section className="m-6 rounded-2xl border border-slate-200 bg-white p-8">
      <p className="text-lg font-bold text-slate-900">当前企业还没有可管理的商城</p>
      <p className="mt-2 text-sm text-slate-500">请先由平台管理员建立首个商城，再由商家在这里复制和自定义。</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : '商城应用操作失败';
}
