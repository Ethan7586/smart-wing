import React, { useMemo, useState } from 'react';
import { History, Play, RotateCcw } from 'lucide-react';
import {
  loadQualificationHistory,
  rollbackQualificationConfig,
  simulateQualification,
  type QualificationCenterData,
  type QualificationConfigKind,
  type QualificationGovernanceData,
  type QualificationHistoryItem,
} from '../../services/qualification';
import { KIND_LABELS } from './qualificationConfigModel';

type Props = {
  data: QualificationCenterData;
  governance: QualificationGovernanceData;
  refresh: () => Promise<void>;
  runProtected: (action: () => Promise<void>) => void;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
};
type EntityOption = { kind: QualificationConfigKind; id: string; name: string; version: number };
export function QualificationHistorySimulator(props: Props) {
  return (
    <div className={`grid gap-5 ${props.governance.capabilities.simulate ? 'xl:grid-cols-2' : ''}`}>
      <HistoryPanel {...props} />
      {props.governance.capabilities.simulate && <SimulatorPanel {...props} />}
    </div>
  );
}

function HistoryPanel(props: Props) {
  const entities = useMemo(() => entityOptions(props.data), [props.data]);
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState<QualificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const option = entities.find((item) => `${item.kind}:${item.id}` === selected);
  const load = async (value: string) => {
    setSelected(value);
    setHistory([]);
    const target = entities.find((item) => `${item.kind}:${item.id}` === value);
    if (!target) return;
    setLoading(true);
    props.setError('');
    try {
      setHistory(await loadQualificationHistory(target.kind, target.id));
    } catch (cause) {
      props.setError(cause instanceof Error ? cause.message : '历史读取失败');
    } finally {
      setLoading(false);
    }
  };
  const rollback = (item: QualificationHistoryItem) => {
    if (!option) return;
    const reason = window.prompt(`将 ${option.name} 恢复到版本 ${item.version}。请输入回滚原因：`, '恢复经过验证的历史配置');
    if (!reason || reason.trim().length < 4) return;
    props.runProtected(async () => {
      props.setError('');
      try {
        const result = await rollbackQualificationConfig({ kind: option.kind, entityId: option.id, auditId: item.auditId, expectedVersion: option.version, reason: reason.trim() });
        props.setNotice(result.approvalRequired === true ? '回滚已提交双人审批，当前版本未改变。' : '已基于历史快照创建一个新版本。');
        await props.refresh();
      } catch (cause) {
        props.setError(cause instanceof Error ? cause.message : '回滚失败');
      }
    });
  };
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <header className="mb-3">
        <b className="flex items-center gap-2 text-sm text-slate-900">
          <History className="h-4 w-4 text-blue-600" />
          历史版本与回滚
        </b>
        <p className="mt-1 text-[11px] text-slate-500">回滚不会改写历史，而是从服务端快照创建一个新版本；高风险回滚仍需双人审批。</p>
      </header>
      <select value={selected} onChange={(event) => void load(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        <option value="">选择一项配置</option>
        {entities.map((item) => (
          <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
            {KIND_LABELS[item.kind]} · {item.name} · 当前 v{item.version}
          </option>
        ))}
      </select>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {loading && <p className="py-6 text-center text-xs text-slate-400">读取历史中…</p>}
        {!loading && selected && !history.length && <p className="py-6 text-center text-xs text-slate-400">尚无可回滚历史</p>}
        {history.map((item) => (
          <article key={item.auditId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <div>
              <b className="text-xs text-slate-800">
                版本 {item.version} · {item.status}
              </b>
              <p className="mt-1 text-[10px] text-slate-500">
                {new Date(item.createdAt).toLocaleString('zh-CN')} · {item.reason}
              </p>
            </div>
            <button
              disabled={!option || item.version === option.version}
              onClick={() => rollback(item)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-blue-700 disabled:text-slate-300"
            >
              <RotateCcw className="h-3 w-3" />
              恢复此版本
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SimulatorPanel({ data, governance, setError }: Props) {
  const [userId, setUserId] = useState(''),
    [skuId, setSkuId] = useState(''),
    [quantity, setQuantity] = useState(1),
    [cityCode, setCityCode] = useState(''),
    [cityName, setCityName] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null),
    [running, setRunning] = useState(false);
  const employee = governance.employees.find((item) => item.userId === userId);
  const run = async () => {
    if (!employee || !skuId) return setError('请选择员工和 SKU。');
    setRunning(true);
    setError('');
    try {
      setResult(await simulateQualification({ userId: employee.userId, membershipId: employee.membershipId, skuId, quantity, cityCode: cityCode || null, cityName: cityName || null }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '模拟失败');
    } finally {
      setRunning(false);
    }
  };
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <header className="mb-3">
        <b className="flex items-center gap-2 text-sm text-slate-900">
          <Play className="h-4 w-4 text-blue-600" />
          员工资格模拟器
        </b>
        <p className="mt-1 text-[11px] text-slate-500">只读取当前真实规则，不下单、不改数据；用于解释为什么可见、可买或被限制。</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <Select
          label="员工"
          value={userId}
          set={(value) => {
            setUserId(value);
            const found = governance.employees.find((item) => item.userId === value);
            setCityCode(found?.cityCode ?? '');
            setCityName(found?.cityName ?? '');
          }}
          options={governance.employees.map((item) => [item.userId, `${item.name} · ${item.employeeNo}`])}
        />
        <Select label="SKU" value={skuId} set={setSkuId} options={data.selectors.skus.map((item) => [item.id, item.name])} />
        <Field label="测试城市编码" value={cityCode} set={setCityCode} />
        <Field label="测试城市名称" value={cityName} set={setCityName} />
        <label className="text-xs font-bold text-slate-700">
          数量
          <input type="number" min={1} max={99} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <button disabled={!employee || !skuId || running} onClick={() => void run()} className="mt-6 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:bg-slate-300">
          {running ? '计算中…' : '运行模拟'}
        </button>
      </div>
      {result && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-2 md:grid-cols-2">
            <Result label="可见" value={result.visible === true ? '是' : '否'} ok={result.visible === true} />
            <Result label="可买" value={result.purchasable === true ? '是' : '否'} ok={result.purchasable === true} />
            <Result label="可见原因" value={String(result.visibilityReason ?? '-')} />
            <Result label="可买原因" value={String(result.purchaseReason ?? '-')} />
          </div>
          <pre className="mt-3 max-h-36 overflow-auto rounded-lg bg-slate-900 p-3 text-[10px] text-slate-200">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}

function entityOptions(data: QualificationCenterData): EntityOption[] {
  return [
    ...data.catalogPools.map((i) => ({ kind: 'catalog_pool' as const, id: i.id, name: i.name, version: i.version })),
    ...data.cityZones.map((i) => ({ kind: 'city_zone' as const, id: i.id, name: i.name, version: i.version })),
    ...data.policies.map((i) => ({ kind: 'entitlement_policy' as const, id: i.id, name: i.name, version: i.version })),
    ...data.limitTemplates.map((i) => ({ kind: 'purchase_limit' as const, id: i.id, name: i.name, version: i.version })),
    ...data.commercialResources.agreements.map((i) => ({ kind: 'supplier_agreement' as const, id: i.id, name: i.agreementCode, version: i.version })),
    ...data.commercialResources.brands.map((i) => ({ kind: 'brand' as const, id: i.id, name: i.name, version: i.version })),
    ...data.commercialResources.stores.map((i) => ({ kind: 'store' as const, id: i.id, name: i.name, version: i.version })),
  ];
}
function Select({ label, value, set, options }: { label: string; value: string; set: (value: string) => void; options: string[][] }) {
  return (
    <label className="text-xs font-bold text-slate-700">
      {label}
      <select value={value} onChange={(event) => set(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
        <option value="">请选择</option>
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return (
    <label className="text-xs font-bold text-slate-700">
      {label}
      <input value={value} onChange={(event) => set(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2" />
    </label>
  );
}
function Result({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <span className="block text-[10px] text-slate-400">{label}</span>
      <b className={ok === undefined ? 'text-slate-800' : ok ? 'text-emerald-700' : 'text-red-700'}>{value}</b>
    </div>
  );
}
