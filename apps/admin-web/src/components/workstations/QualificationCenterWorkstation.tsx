import React, { useEffect, useRef, useState } from 'react';
import { Layers3, MapPinned, RefreshCw, ShieldCheck, ShoppingCart } from 'lucide-react';
import { verifyCurrentPassword } from '../../services/accessControl';
import { loadQualificationCenter, saveQualificationConfig, type QualificationCenterData, type QualificationConfigKind } from '../../services/qualification';
import { QualificationCenterSections } from './QualificationCenterSections';
import { QualificationConfigDialog } from './QualificationConfigDialog';
import { StepUpModal } from './StepUpModal';

type EditTarget = { kind: QualificationConfigKind; entity: Record<string, unknown> | null };
const emptyData: QualificationCenterData = {
  catalogPools: [],
  cityZones: [],
  policies: [],
  limitTemplates: [],
  commercialResources: { agreements: [], brands: [], stores: [] },
  selectors: { enterprises: [], suppliers: [], products: [], skus: [], departments: [], users: [], memberships: [] },
  commercialSummary: { brands: 0, stores: 0, supplierAgreements: 0, brandAuthorizations: 0 },
  capabilities: { readCommercialResources: false, manageCommercialResources: false, readEntitlements: false, manageEntitlements: false, readPurchaseLimits: false, managePurchaseLimits: false },
};

export const QualificationCenterWorkstation: React.FC = () => {
  const [data, setData] = useState<QualificationCenterData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const pendingAction = useRef<null | (() => Promise<void>)>(null);
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadQualificationCenter());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '资格中心暂时无法读取');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const save = (input: Parameters<typeof saveQualificationConfig>[0]) => {
    const execute = async () => {
      setSaving(true);
      setError('');
      setNotice('');
      try {
        await saveQualificationConfig(input);
        setEditing(null);
        setNotice(input.payload.status === 'draft' ? '草稿已保存，不影响员工端。' : input.payload.status === 'active' ? '规则已发布，员工端资格已更新。' : '规则已停用。');
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '资格配置保存失败');
      } finally {
        setSaving(false);
      }
    };
    if (input.payload.status === 'draft') {
      void execute();
      return;
    }
    pendingAction.current = execute;
    setStepUpOpen(true);
  };
  const open = (kind: QualificationConfigKind, entity: object | null = null) => setEditing({ kind, entity: entity as Record<string, unknown> | null });
  return (
    <>
      <section className="mx-auto max-w-[1800px] space-y-5 p-6">
        <header className="rounded-2xl bg-gradient-to-r from-[var(--sw-brand-ink)] to-[var(--sw-brand-dark)] px-6 py-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200">Employee Qualification</p>
              <h1 className="text-xl font-black">商业资源与员工资格中心</h1>
              <p className="mt-1 text-xs text-blue-100">先建立商城能卖什么，再决定哪些员工能看、能买，以及每次、每日、每月最多能买多少。</p>
            </div>
            <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新真实数据
            </button>
          </div>
        </header>
        {error && <Banner tone="error">{error}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="商品池" value={data.catalogPools.length} icon={Layers3} />
          <Metric label="城市专区" value={data.cityZones.length} icon={MapPinned} />
          <Metric label="资格策略" value={data.policies.length} icon={ShieldCheck} />
          <Metric label="限售模板" value={data.limitTemplates.length} icon={ShoppingCart} />
        </div>
        <QualificationCenterSections data={data} open={open} />
      </section>
      <QualificationConfigDialog kind={editing?.kind ?? null} entity={editing?.entity ?? null} data={data} saving={saving} onClose={() => setEditing(null)} onSave={save} />
      <StepUpModal
        open={stepUpOpen}
        onClose={() => {
          pendingAction.current = null;
          setStepUpOpen(false);
        }}
        onVerify={async (password) => {
          await verifyCurrentPassword(password);
        }}
        onVerified={() => {
          setStepUpOpen(false);
          const action = pendingAction.current;
          pendingAction.current = null;
          if (action) void action();
        }}
      />
    </>
  );
};

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <strong className="mt-2 block text-2xl text-slate-900">{value}</strong>
    </div>
  );
}
function Banner({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</div>;
}
