import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Building2,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileSearch,
  Layers3,
  Plus,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Store,
  TicketCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  loadLiveVoucherBatches,
  loadLiveVoucherAudit,
  loadLiveVoucherOverview,
  loadLiveVoucherPrograms,
  loadLiveVoucherRedemptions,
  loadLiveVoucherReserves,
  loadLiveVoucherVoidBalanceHolds,
  loadLiveVouchers,
  type LiveVoucher,
  type LiveVoucherAudit,
  type LiveVoucherBatch,
  type LiveVoucherOverview,
  type LiveVoucherProgram,
  type LiveVoucherRedemption,
  type LiveVoucherReserve,
  type LiveVoucherVoidBalanceHold,
  type VoucherApiStatus,
} from '../../services/vouchers';
import { VoucherWriteActionDialog, type VoucherWriteAction } from './VoucherWriteActionDialog';

type ModuleId = 'overview' | 'foundation' | 'reserve' | 'approval' | 'center' | 'operations' | 'query' | 'consumption' | 'verify' | 'audit' | 'reconciliation';
type VoucherStatus = '未激活' | '可使用' | '已禁用' | '已核销' | '已作废';
type ApplicationStatus = '待审核' | '已同意' | '已拒绝';
type OperationKind = '激活' | '禁用' | '延期' | '作废';

interface VoucherOperationsProps {
  /** Set only after a production admin session grants voucher.read. */
  liveDataEnabled?: boolean;
  /** Permissions come from the server session projection, never from a form. */
  sessionPermissions?: string[];
  /** Explicitly disabled in every normal and test build until grey approval. */
  writeEnabled?: boolean;
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string, evidence: string) => void) => void;
}

interface ReserveApplication {
  id: string;
  customer: string;
  name: string;
  product: string;
  quantity: number;
  remaining: number | null;
  mall: string;
  status: ApplicationStatus;
  createdAt: string;
}

interface VoucherRow {
  batchNo: string;
  cardNo: string;
  voucherCode: string;
  name: string;
  customer: string;
  mall: string;
  status: VoucherStatus;
  balance: number;
  validUntil: string;
  boundUser: string;
}

const moduleItems: Array<{ id: ModuleId; label: string; owner: string; icon: React.ElementType }> = [
  { id: 'overview', label: '运营总览', owner: '全部层级', icon: Layers3 },
  { id: 'foundation', label: '基础档案', owner: '平台 / 集团', icon: Building2 },
  { id: 'reserve', label: '备券中心', owner: '集团', icon: ClipboardList },
  { id: 'approval', label: '卡券审批', owner: '集团', icon: ShieldCheck },
  { id: 'center', label: '卡券中心', owner: '集团 / 商城', icon: TicketCheck },
  { id: 'operations', label: '券操作', owner: '商城', icon: RefreshCcw },
  { id: 'query', label: '券查询', owner: '商城', icon: FileSearch },
  { id: 'consumption', label: '消费明细', owner: '集团 / 商城', icon: ReceiptText },
  { id: 'verify', label: '门店核销', owner: '门店工作台', icon: ScanLine },
  { id: 'audit', label: '审计记录', owner: '平台 / 审计', icon: ClipboardCheck },
];

/** The reconciliation module is formal-only: test fixtures must not imitate finance records. */
const formalModuleItems: Array<{ id: ModuleId; label: string; owner: string; icon: React.ElementType }> = [...moduleItems, { id: 'reconciliation', label: '作废余额对账', owner: '财务', icon: CircleDollarSign }];

const initialApplications: ReserveApplication[] = [
  { id: 'BQ202608170001', customer: '湖北博钛智能科技', name: '2026 中秋福利备券', product: '企业储值券', quantity: 2_000, remaining: null, mall: '智慧翼福利商城', status: '待审核', createdAt: '2026-08-17 08:42' },
  { id: 'BQ202608160008', customer: '武汉优页科技', name: '员工生日福利卡', product: '企业储值券', quantity: 800, remaining: 386, mall: '智慧翼福利商城', status: '已同意', createdAt: '2026-08-16 16:20' },
  { id: 'BQ202608150003', customer: '华中数智服务中心', name: '高温关怀福利券', product: '企业储值券', quantity: 300, remaining: null, mall: '智慧翼福利商城', status: '已拒绝', createdAt: '2026-08-15 10:05' },
];

const initialVouchers: VoucherRow[] = [
  {
    batchNo: 'PH202608161620001',
    cardNo: 'NO.202608000018',
    voucherCode: 'QH26081616200018',
    name: '员工生日福利卡',
    customer: '武汉优页科技',
    mall: '智慧翼福利商城',
    status: '可使用',
    balance: 300,
    validUntil: '2026-12-31',
    boundUser: '陈青 · 138****5802',
  },
  {
    batchNo: 'PH202608161620001',
    cardNo: 'NO.202608000019',
    voucherCode: 'QH26081616200019',
    name: '员工生日福利卡',
    customer: '武汉优页科技',
    mall: '智慧翼福利商城',
    status: '未激活',
    balance: 300,
    validUntil: '2026-12-31',
    boundUser: '—',
  },
  {
    batchNo: 'PH202608161620001',
    cardNo: 'NO.202608000020',
    voucherCode: 'QH26081616200020',
    name: '员工生日福利卡',
    customer: '武汉优页科技',
    mall: '智慧翼福利商城',
    status: '已禁用',
    balance: 300,
    validUntil: '2026-12-31',
    boundUser: '周雨 · 139****1628',
  },
  {
    batchNo: 'PH202607221030006',
    cardNo: 'NO.202607000106',
    voucherCode: 'QH26072210300106',
    name: '夏日关怀福利券',
    customer: '湖北博钛智能科技',
    mall: '智慧翼福利商城',
    status: '已核销',
    balance: 0,
    validUntil: '2026-08-31',
    boundUser: '孙帆 · 186****8316',
  },
];

const statusStyle: Record<VoucherStatus | ApplicationStatus, string> = {
  未激活: 'bg-amber-50 text-amber-700 border-amber-200',
  可使用: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  已禁用: 'bg-orange-50 text-orange-700 border-orange-200',
  已核销: 'bg-blue-50 text-blue-700 border-blue-200',
  已作废: 'bg-rose-50 text-rose-700 border-rose-200',
  待审核: 'bg-amber-50 text-amber-700 border-amber-200',
  已同意: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  已拒绝: 'bg-rose-50 text-rose-700 border-rose-200',
};

function StatusTag({ value }: { value: VoucherStatus | ApplicationStatus }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${statusStyle[value]}`}>{value}</span>;
}

function MetricCard({ label, value, note, icon: Icon, tone = 'blue' }: { label: string; value: string; note: string; icon: React.ElementType; tone?: 'blue' | 'green' | 'amber' | 'rose' }) {
  const toneMap = {
    blue: 'bg-blue-50 text-[var(--sw-brand)] border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 min-w-0 shadow-sm shadow-slate-200/30">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
        <span className={`w-8 h-8 rounded-xl border flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="mt-3 text-[22px] leading-none font-bold text-slate-900 font-mono">{value}</div>
      <div className="mt-2 text-[11px] text-slate-400">{note}</div>
    </div>
  );
}

const VoucherPrototypeWorkstation: React.FC<VoucherOperationsProps> = ({ onOpenGuardrail }) => {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [applications, setApplications] = useState(initialApplications);
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [approvalEnabled, setApprovalEnabled] = useState(true);
  const [showReserveForm, setShowReserveForm] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | VoucherStatus>('全部');
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherRow | null>(null);
  const [operationKind, setOperationKind] = useState<OperationKind>('禁用');
  const [selectionMode, setSelectionMode] = useState<'券号' | '券号段' | '批次号'>('券号');
  const [operationTarget, setOperationTarget] = useState('');
  const [operationPreview, setOperationPreview] = useState<{ count: number; amount: number } | null>(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [verifyCode, setVerifyCode] = useState('QH26081616200018');
  const [verifyState, setVerifyState] = useState<'idle' | 'matched' | 'done' | 'error'>('idle');

  const activeMeta = moduleItems.find((item) => item.id === activeModule) ?? moduleItems[0];
  const pendingCount = applications.filter((item) => item.status === '待审核').length;
  const filteredVouchers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return vouchers.filter((item) => {
      const matchesKeyword = !keyword || [item.batchNo, item.cardNo, item.voucherCode, item.name, item.customer, item.boundUser].some((value) => value.toLowerCase().includes(keyword));
      return matchesKeyword && (statusFilter === '全部' || item.status === statusFilter);
    });
  }, [query, statusFilter, vouchers]);

  const updateApplication = (id: string, status: ApplicationStatus) => {
    setApplications((current) => current.map((item) => (item.id === id ? { ...item, status, remaining: status === '已同意' ? item.quantity : item.remaining } : item)));
  };

  const previewOperation = () => {
    if (!operationTarget.trim()) {
      setOperationMessage('请先输入券号、券号段或批次号。');
      setOperationPreview(null);
      return;
    }
    const count = selectionMode === '券号' ? 1 : selectionMode === '券号段' ? 8 : 386;
    setOperationPreview({ count, amount: count * 300 });
    setOperationMessage('');
  };

  const executeOperation = () => {
    if (!operationPreview) return;
    const afterStatus: VoucherStatus = operationKind === '激活' ? '可使用' : operationKind === '禁用' ? '已禁用' : operationKind === '作废' ? '已作废' : '可使用';
    onOpenGuardrail(`确认批量${operationKind}卡券`, `卡券${operationKind}`, `${selectionMode}: ${operationTarget}`, `VOUCHER-${selectionMode.toUpperCase()}`, operationPreview.amount, () => {
      if (selectionMode === '券号') {
        setVouchers((current) => current.map((item) => (item.voucherCode === operationTarget || item.cardNo === operationTarget ? { ...item, status: afterStatus } : item)));
      }
      setOperationMessage(`已模拟提交 ${operationPreview.count} 张卡券的${operationKind}任务；本次仅更新页面测试状态，未写入正式审计。`);
      setOperationPreview(null);
    });
  };

  const runVerify = () => {
    const matched = vouchers.some((item) => item.voucherCode === verifyCode.trim() && item.status === '可使用');
    setVerifyState(matched ? 'matched' : 'error');
  };

  const confirmVerify = () => {
    const matched = vouchers.find((item) => item.voucherCode === verifyCode.trim());
    if (!matched) return;
    setVouchers((current) => current.map((item) => (item.voucherCode === verifyCode.trim() ? { ...item, balance: 100 } : item)));
    setVerifyState('done');
  };

  return (
    <div className="min-h-full bg-[#F5F7FB] p-5 lg:p-6 space-y-4">
      <section className="bg-gradient-to-r from-[var(--sw-brand-ink)] via-[#102E61] to-[var(--sw-brand-dark)] rounded-2xl p-5 text-white overflow-hidden relative shadow-lg shadow-blue-950/10">
        <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-[var(--sw-brand)]/25 blur-2xl" />
        <div className="relative flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-[var(--sw-brand)] flex items-center justify-center shadow-lg shadow-blue-900/40">
                <TicketCheck className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight">卡券运营台</h1>
                  <span className="px-2 py-0.5 rounded-full bg-amber-300/15 border border-amber-200/30 text-[10px] font-mono text-amber-100">测试原型</span>
                </div>
                <p className="text-xs text-blue-100/80 mt-0.5">产品档案 → 备券审批 → 发行 → 券操作 → 查询 → 核销 → 消费明细</p>
              </div>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-2 text-[11px] text-blue-100/80">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>测试护栏：尚未写入正式审计</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-[210px_minmax(0,1fr)] gap-4 items-start">
        <aside className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm sticky top-2">
          <div className="px-3 pt-2 pb-2 text-[10px] text-slate-400 font-semibold tracking-wider">卡券管理模块</div>
          <div className="space-y-1">
            {moduleItems.map(({ id, label, owner, icon: Icon }) => {
              const active = activeModule === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveModule(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors ${active ? 'bg-[var(--sw-brand-light)] text-[var(--sw-brand-dark)] ring-1 ring-[var(--sw-brand)]/20' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--sw-brand)]' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold truncate">{label}</span>
                    <span className="block text-[10px] text-slate-400 truncate mt-0.5">{owner}</span>
                  </span>
                  {id === 'approval' && pendingCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{pendingCount}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-500 leading-relaxed">
            <strong className="block text-slate-700 mb-1">码制边界</strong>
            门店只核销券码；小程序会员码只识别会员身份。
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{activeMeta.label}</h2>
                <span className="px-2 py-0.5 rounded-full bg-[var(--sw-brand-light)] text-[var(--sw-brand-dark)] text-[10px] font-semibold">{activeMeta.owner}</span>
              </div>
              <p className="text-[11px] text-amber-700 mt-1">当前展示预置测试数据；刷新会回到初始状态，不能作为生产记录。</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                导出
              </button>
              {(activeModule === 'reserve' || activeModule === 'center') && (
                <button
                  type="button"
                  onClick={() => (activeModule === 'reserve' ? setShowReserveForm(true) : setActiveModule('reserve'))}
                  className="px-3 py-2 rounded-xl bg-[var(--sw-brand)] text-white text-xs font-semibold hover:bg-[#174CCC] flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {activeModule === 'reserve' ? '新增备券' : '创建卡券'}
                </button>
              )}
            </div>
          </div>

          {activeModule === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="可使用卡券" value="12,480" note="较昨日 +320 张" icon={TicketCheck} />
                <MetricCard label="待审核备券" value={String(pendingCount)} note="最早等待 28 分钟" icon={ClipboardCheck} tone="amber" />
                <MetricCard label="今日核销金额" value="¥68,420" note="1,096 笔核销流水" icon={CircleDollarSign} tone="green" />
                <MetricCard label="风险操作任务" value="1" note="待复核作废任务" icon={AlertTriangle} tone="rose" />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">卡券生命周期</h3>
                    <p className="text-[11px] text-slate-400 mt-1">点击节点进入对应工作区</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">测试流程演示中</span>
                </div>
                <div className="flex items-stretch gap-2">
                  {[
                    ['foundation', '1', '产品档案', '平台 / 集团'],
                    ['reserve', '2', '备券申请', '集团'],
                    ['approval', '3', '审批', '集团'],
                    ['center', '4', '发行批次', '集团 / 商城'],
                    ['query', '5', '会员券资产', '商城'],
                    ['verify', '6', '券码核销', '门店'],
                    ['consumption', '7', '消费明细', '集团 / 商城'],
                  ].map(([id, step, label, owner], index, list) => (
                    <React.Fragment key={id}>
                      <button type="button" onClick={() => setActiveModule(id as ModuleId)} className="flex-1 min-w-0 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-[var(--sw-brand)] hover:bg-[var(--sw-brand-light)] text-left transition-colors">
                        <span className="w-6 h-6 rounded-lg bg-[var(--sw-brand)] text-white text-[11px] font-bold flex items-center justify-center">{step}</span>
                        <span className="block text-xs font-bold text-slate-800 mt-3">{label}</span>
                        <span className="block text-[10px] text-slate-400 mt-1">{owner}</span>
                      </button>
                      {index < list.length - 1 && <ArrowRight className="w-4 h-4 text-[var(--sw-brand)] self-center shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[var(--sw-brand)]" />
                    <h3 className="text-sm font-bold text-slate-900">资源底座</h3>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[var(--sw-brand-light)] border border-blue-100">
                      <span className="text-[10px] text-[var(--sw-brand-dark)]">可分配卡号</span>
                      <strong className="block text-lg font-mono text-slate-900 mt-1">20,000</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-500">启用产品档案</span>
                      <strong className="block text-lg font-mono text-slate-900 mt-1">2</strong>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">今日状态检查</h3>
                  </div>
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">审批流程</span>
                      <span className="text-emerald-700 font-semibold">已启用</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">异常核销</span>
                      <span className="text-slate-800 font-semibold">0 笔</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">即将到期卡券</span>
                      <span className="text-amber-700 font-semibold">128 张</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModule === 'foundation' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[var(--sw-brand)]" />
                    <h3 className="text-sm font-bold">客户管理</h3>
                  </div>
                  <button className="text-xs text-[var(--sw-brand)] font-semibold">查看全部</button>
                </div>
                <div className="mt-4 space-y-3">
                  {['湖北博钛智能科技', '武汉优页科技', '华中数智服务中心'].map((name, index) => (
                    <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs text-slate-800">{name}</strong>
                        <span className="block text-[10px] text-slate-400 mt-1">客户编号 KH202608{String(index + 1).padStart(4, '0')}</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">正常</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TicketCheck className="w-4 h-4 text-[var(--sw-brand)]" />
                    <h3 className="text-sm font-bold">产品档案</h3>
                  </div>
                  <button className="text-xs text-[var(--sw-brand)] font-semibold">新增档案</button>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    ['CP202608010001', '企业储值券', '启用'],
                    ['CP202608010002', '节日福利储值券', '启用'],
                  ].map(([code, name, status]) => (
                    <div key={code} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <strong className="text-xs text-slate-800">{name}</strong>
                        <span className="block text-[10px] text-slate-400 mt-1">{code} · 智慧翼福利商城</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{status}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 rounded-xl bg-[var(--sw-brand-light)] text-[11px] text-[var(--sw-brand-dark)]">MVP 产品类型先支持储值券，后续再扩展其他券型。</div>
              </div>
              <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[var(--sw-brand)]" />
                    <div>
                      <h3 className="text-sm font-bold">卡号库</h3>
                      <p className="text-[11px] text-slate-400 mt-1">平台 Admin 维护实体卡号资源；电子券不占用实体卡号。</p>
                    </div>
                  </div>
                  <button className="px-3 py-2 rounded-xl bg-[var(--sw-brand)] text-white text-xs font-semibold flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    生成卡号
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-4">
                  {[
                    ['号段', 'NO.202608000001 ~ NO.202608020000'],
                    ['生成数量', '20,000'],
                    ['已分配', '0'],
                    ['可分配', '20,000'],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400">{label}</span>
                      <strong className="block text-xs font-mono text-slate-800 mt-1 break-all">{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeModule === 'reserve' && (
            <div className="space-y-4">
              {showReserveForm && (
                <div className="bg-white border border-[var(--sw-brand)]/30 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">新增备券申请</h3>
                      <p className="text-[11px] text-slate-400 mt-1">选择客户、产品档案、商城、兑换方式与申请数量</p>
                    </div>
                    <button onClick={() => setShowReserveForm(false)} className="text-xs text-slate-500">
                      收起
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-3 mt-4">
                    {['备券名称', '客户名称', '产品档案', '适用商城', '兑换方式', '申请数量'].map((label, index) => (
                      <label key={label} className="text-[11px] font-medium text-slate-500">
                        <span className="block mb-1.5">{label}</span>
                        {index === 0 || index === 5 ? (
                          <input className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs outline-none focus:border-[var(--sw-brand)]" placeholder={index === 0 ? '请输入名称' : '请输入正整数'} />
                        ) : (
                          <select className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-[var(--sw-brand)]">
                            <option>请选择</option>
                            <option>{index === 1 ? '湖北博钛智能科技' : index === 2 ? '企业储值券' : index === 3 ? '智慧翼福利商城' : '仅输入券码'}</option>
                          </select>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setShowReserveForm(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs">
                      取消
                    </button>
                    <button onClick={() => setShowReserveForm(false)} className="px-3 py-2 rounded-lg bg-[var(--sw-brand)] text-white text-xs font-semibold">
                      提交审批
                    </button>
                  </div>
                </div>
              )}
              <DataToolbar query={query} setQuery={setQuery} placeholder="搜索备券编号、客户或备券名称" />
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {['备券编号', '客户名称', '备券名称', '产品档案', '兑换方式', '申请数量', '剩余', '审批状态', '创建时间', '操作'].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-mono text-slate-700">{item.id}</td>
                        <td className="px-4 py-3">{item.customer}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                        <td className="px-4 py-3">{item.product}</td>
                        <td className="px-4 py-3 whitespace-nowrap">仅输入券码</td>
                        <td className="px-4 py-3 font-mono">{item.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono">{item.remaining ?? '—'}</td>
                        <td className="px-4 py-3">
                          <StatusTag value={item.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.createdAt}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => (item.status === '待审核' ? setActiveModule('approval') : undefined)} className="text-[var(--sw-brand)] font-semibold">
                            {item.status === '待审核' ? '去审批' : '详情'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeModule === 'approval' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">是否启用卡券审批流程</h3>
                  <p className="text-[11px] text-slate-400 mt-1">关闭后备券申请直接通过；开启后按申请人、审批人节点流转。</p>
                </div>
                <button type="button" onClick={() => setApprovalEnabled((value) => !value)} aria-pressed={approvalEnabled} className={`w-12 h-7 rounded-full p-1 transition-colors ${approvalEnabled ? 'bg-[var(--sw-brand)]' : 'bg-slate-300'}`}>
                  <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${approvalEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">审批流程 1</h3>
                  <span className="text-[11px] text-emerald-700">{approvalEnabled ? '已启用' : '已关闭'}</span>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400">申请人</span>
                    <strong className="block text-xs mt-1">集团福利管理员</strong>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--sw-brand)]" />
                  <div className="flex-1 p-3 rounded-xl bg-[var(--sw-brand-light)] border border-blue-100">
                    <span className="text-[10px] text-[var(--sw-brand-dark)]">审批人</span>
                    <strong className="block text-xs mt-1 text-slate-900">集团运营负责人</strong>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">待我审批</h3>
                </div>
                {applications
                  .filter((item) => item.status === '待审核')
                  .map((item) => (
                    <div key={item.id} className="px-5 py-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs text-slate-900">{item.name}</strong>
                          <StatusTag value={item.status} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {item.customer} · {item.quantity.toLocaleString()} 张 · {item.mall}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateApplication(item.id, '已拒绝')} className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold">
                          拒绝
                        </button>
                        <button onClick={() => updateApplication(item.id, '已同意')} className="px-3 py-2 rounded-lg bg-[var(--sw-brand)] text-white text-xs font-semibold">
                          同意并生成资源
                        </button>
                      </div>
                    </div>
                  ))}
                {pendingCount === 0 && <div className="px-5 py-10 text-center text-xs text-slate-400">暂无待审批申请</div>}
              </div>
            </div>
          )}

          {activeModule === 'center' && (
            <div className="space-y-4">
              <DataToolbar query={query} setQuery={setQuery} placeholder="搜索批次号、卡券名称或客户" />
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {['发行批次', '卡券名称', '客户', '类型', '发放数量', '可用', '销售金额', '创建时间', '操作'].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['PH202608161620001', '员工生日福利卡', '武汉优页科技', '实体券', '414', '386', '¥124,200', '2026-08-16 16:20'],
                      ['PH202607221030006', '夏日关怀福利券', '湖北博钛智能科技', '电子券', '1,200', '104', '¥360,000', '2026-07-22 10:30'],
                    ].map((row) => (
                      <tr key={row[0]} className="border-t border-slate-100">
                        {row.map((cell, index) => (
                          <td key={`${row[0]}-${index}`} className={`px-4 py-3 ${index === 0 ? 'font-mono' : index === 1 ? 'font-semibold text-slate-900' : ''}`}>
                            {cell}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <button onClick={() => setActiveModule('query')} className="text-[var(--sw-brand)] font-semibold">
                            查看卡券
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeModule === 'operations' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">新建券操作任务</h3>
                <p className="text-[11px] text-slate-400 mt-1">先预览影响范围，再进入审计护栏确认执行。</p>
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-600 mb-2">操作类型</span>
                <div className="flex gap-2">
                  {(['激活', '禁用', '延期', '作废'] as OperationKind[]).map((kind) => {
                    const styles = kind === '激活' ? 'border-emerald-200 text-emerald-700' : kind === '禁用' ? 'border-orange-200 text-orange-700' : kind === '延期' ? 'border-blue-200 text-blue-700' : 'border-rose-200 text-rose-700';
                    return (
                      <button
                        key={kind}
                        onClick={() => {
                          setOperationKind(kind);
                          setOperationPreview(null);
                        }}
                        className={`px-4 py-2 rounded-xl border text-xs font-semibold ${styles} ${operationKind === kind ? 'ring-2 ring-[var(--sw-brand)]/20 bg-slate-50' : 'bg-white'}`}
                      >
                        {kind === '激活' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
                        ) : kind === '禁用' ? (
                          <Ban className="w-3.5 h-3.5 inline mr-1.5" />
                        ) : kind === '延期' ? (
                          <CalendarPlus className="w-3.5 h-3.5 inline mr-1.5" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 inline mr-1.5" />
                        )}
                        {kind}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-600 mb-2">选择方式</span>
                <div className="flex gap-4">
                  {(['券号', '券号段', '批次号'] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="radio"
                        checked={selectionMode === mode}
                        onChange={() => {
                          setSelectionMode(mode);
                          setOperationPreview(null);
                        }}
                        className="accent-[var(--sw-brand)]"
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </div>
              <div className="max-w-2xl">
                <label className="block text-[11px] font-semibold text-slate-600 mb-2">{selectionMode}</label>
                <div className="flex gap-2">
                  <input
                    value={operationTarget}
                    onChange={(event) => {
                      setOperationTarget(event.target.value);
                      setOperationPreview(null);
                    }}
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-[var(--sw-brand)]"
                    placeholder={selectionMode === '券号' ? '输入券号或券码，例如 QH26081616200018' : selectionMode === '券号段' ? '输入开始券号 ~ 结束券号' : '输入发行批次号'}
                  />
                  <button onClick={previewOperation} className="px-4 h-10 rounded-xl bg-[var(--sw-brand)] text-white text-xs font-semibold flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    预览影响
                  </button>
                </div>
                {operationMessage && <p className={`mt-2 text-[11px] ${operationMessage.startsWith('已提交') ? 'text-emerald-700' : 'text-rose-600'}`}>{operationMessage}</p>}
              </div>
              {operationPreview && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <div>
                      <strong className="text-xs text-slate-900">预计命中 {operationPreview.count.toLocaleString()} 张卡券</strong>
                      <p className="text-[11px] text-amber-800 mt-1">影响卡券余额合计 ¥{operationPreview.amount.toLocaleString()}；不可执行项将在提交时自动拦截。</p>
                    </div>
                  </div>
                  <button onClick={executeOperation} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold whitespace-nowrap">
                    进入审计确认
                  </button>
                </div>
              )}
            </div>
          )}

          {activeModule === 'query' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-[var(--sw-brand)]"
                    placeholder="搜索券号、券码、批次、客户或绑定用户"
                  />
                </div>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '全部' | VoucherStatus)} className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs">
                  <option>全部</option>
                  {(['未激活', '可使用', '已禁用', '已核销', '已作废'] as VoucherStatus[]).map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setQuery('');
                    setStatusFilter('全部');
                  }}
                  className="h-9 px-3 rounded-xl border border-slate-200 text-xs text-slate-600"
                >
                  重置
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {['卡号库编号', '券码', '卡券名称', '客户', '状态', '余额', '有效期', '绑定用户', '操作'].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVouchers.map((item) => (
                      <tr key={item.voucherCode} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-mono">{item.cardNo}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{item.voucherCode}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="px-4 py-3">{item.customer}</td>
                        <td className="px-4 py-3">
                          <StatusTag value={item.status} />
                        </td>
                        <td className="px-4 py-3 font-mono">¥{item.balance.toFixed(2)}</td>
                        <td className="px-4 py-3">{item.validUntil}</td>
                        <td className="px-4 py-3">{item.boundUser}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedVoucher(item)} className="text-[var(--sw-brand)] font-semibold">
                            详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredVouchers.length === 0 && <div className="py-12 text-center text-xs text-slate-400">没有符合条件的卡券</div>}
              </div>
              {selectedVoucher && (
                <div className="bg-white border border-[var(--sw-brand)]/30 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">单券完整档案</h3>
                        <StatusTag value={selectedVoucher.status} />
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">{selectedVoucher.voucherCode}</p>
                    </div>
                    <button onClick={() => setSelectedVoucher(null)} className="text-xs text-slate-500">
                      关闭
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {[
                      ['发行批次', selectedVoucher.batchNo],
                      ['卡号库编号', selectedVoucher.cardNo],
                      ['绑定用户', selectedVoucher.boundUser],
                      ['剩余余额', `¥${selectedVoucher.balance.toFixed(2)}`],
                    ].map(([label, value]) => (
                      <div key={label} className="p-3 rounded-xl bg-slate-50">
                        <span className="text-[10px] text-slate-400">{label}</span>
                        <strong className="block text-xs text-slate-800 mt-1 break-all">{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-l-2 border-[var(--sw-brand)] pl-4 text-[11px] text-slate-500">2026-08-16 16:20 生成卡券 → 2026-08-16 17:03 绑定用户 → 当前状态：{selectedVoucher.status}</div>
                </div>
              )}
            </div>
          )}

          {activeModule === 'consumption' && (
            <div className="space-y-4">
              <DataToolbar query={query} setQuery={setQuery} placeholder="搜索流水号、券码、客户或门店" />
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="今日核销金额" value="¥68,420" note="较昨日 +8.4%" icon={CircleDollarSign} tone="green" />
                <MetricCard label="今日核销笔数" value="1,096" note="平均单笔 ¥62.43" icon={ReceiptText} />
                <MetricCard label="核销异常" value="0" note="全部流水已入账" icon={CheckCircle2} tone="green" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {['流水号', '券码', '卡券名称', '客户', '门店', '核销金额', '核销后余额', '时间', '操作人'].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['HX202608170842018', 'QH26081616200018', '员工生日福利卡', '武汉优页科技', '武昌城市门店', '¥200.00', '¥100.00', '2026-08-17 08:42', '门店收银员 02'],
                      ['HX202608170815006', 'QH26072210300106', '夏日关怀福利券', '湖北博钛智能科技', '汉口合作门店', '¥300.00', '¥0.00', '2026-08-17 08:15', '门店收银员 06'],
                    ].map((row) => (
                      <tr key={row[0]} className="border-t border-slate-100">
                        {row.map((cell, index) => (
                          <td key={`${row[0]}-${index}`} className={`px-4 py-3 ${index < 2 ? 'font-mono' : index === 5 ? 'font-semibold text-emerald-700' : ''}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeModule === 'verify' && (
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)] gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-[var(--sw-brand)]" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">门店券码核销</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">扫描券二维码，或输入券号与券码</p>
                  </div>
                </div>
                <div className="mt-5 p-5 rounded-2xl bg-[#F7F9FC] border border-slate-200">
                  <label className="text-[11px] font-semibold text-slate-600">券码</label>
                  <div className="flex gap-2 mt-2">
                    <div className="relative flex-1">
                      <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        value={verifyCode}
                        onChange={(event) => {
                          setVerifyCode(event.target.value);
                          setVerifyState('idle');
                        }}
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-mono outline-none focus:border-[var(--sw-brand)]"
                      />
                    </div>
                    <button onClick={runVerify} className="px-4 h-10 rounded-xl bg-[var(--sw-brand)] text-white text-xs font-semibold">
                      校验卡券
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">本工作台不读取会员码；会员码只用于确认会员身份。</p>
                </div>
                {verifyState === 'error' && (
                  <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    未找到可使用的卡券，请检查券码或卡券状态。
                  </div>
                )}
                {(verifyState === 'matched' || verifyState === 'done') && (
                  <div className={`mt-4 p-4 rounded-xl border ${verifyState === 'done' ? 'bg-emerald-50 border-emerald-200' : 'bg-[var(--sw-brand-light)] border-blue-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-5 h-5 ${verifyState === 'done' ? 'text-emerald-600' : 'text-[var(--sw-brand)]'}`} />
                        <strong className="text-sm text-slate-900">{verifyState === 'done' ? '核销成功' : '卡券校验通过'}</strong>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">{verifyCode}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400">卡券名称</span>
                        <strong className="block mt-1">员工生日福利卡</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">当前余额</span>
                        <strong className="block mt-1 font-mono">{verifyState === 'done' ? '¥100.00' : '¥300.00'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">有效期</span>
                        <strong className="block mt-1">至 2026-12-31</strong>
                      </div>
                    </div>
                    {verifyState === 'matched' && (
                      <div className="mt-4 flex items-center justify-between pt-4 border-t border-blue-200">
                        <div>
                          <span className="text-[10px] text-slate-500">本次核销金额</span>
                          <strong className="block text-lg font-mono text-slate-900">¥200.00</strong>
                        </div>
                        <button onClick={confirmVerify} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold">
                          确认核销
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900">核销前校验</h3>
                  <div className="mt-4 space-y-3">
                    {['卡券已激活', '未被禁用或作废', '在有效期内', '剩余余额充足', '适用于当前商城'].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-[var(--sw-brand-ink)] rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-300" />
                    <strong className="text-sm">会员码边界</strong>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-3 leading-relaxed">小程序会员码用于识别用户身份；电子卡券页展示的券码才进入本页核销流程。两套凭证相互独立。</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

function DataToolbar({ query, setQuery, placeholder }: { query: string; setQuery: (value: string) => void; placeholder: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs outline-none focus:border-[var(--sw-brand)]" placeholder={placeholder} />
      </div>
      <button className="h-9 px-4 rounded-xl bg-[var(--sw-brand)] text-white text-xs font-semibold">搜索</button>
      <button onClick={() => setQuery('')} className="h-9 px-4 rounded-xl border border-slate-200 text-xs text-slate-600">
        重置
      </button>
    </div>
  );
}

const liveVoucherStatusLabel: Record<VoucherApiStatus, string> = {
  inactive: '未激活',
  active: '可使用',
  disabled: '已禁用',
  redeemed: '已核销',
  expired: '已过期',
  void: '已作废',
};

const liveVoucherStatusStyle: Record<VoucherApiStatus, string> = {
  inactive: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  disabled: 'bg-orange-50 text-orange-700 border-orange-200',
  redeemed: 'bg-blue-50 text-blue-700 border-blue-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  void: 'bg-rose-50 text-rose-700 border-rose-200',
};

function liveCurrency(cents: number): string {
  return `¥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function liveDate(value: string | null): string {
  if (!value) return '暂未接入';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function recordStatusLabel(value: string): string {
  return ({ submitted: '待审批', approved: '已批准', rejected: '已拒绝', issued: '已发行', active: '启用', inactive: '停用' } as Record<string, string>)[value] ?? value;
}

function LiveStateNotice({ loading, error, emptyLabel }: { loading: boolean; error: string | null; emptyLabel?: string }) {
  if (loading)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500" aria-live="polite">
        正在从正式服务读取卡券数据…
      </div>
    );
  if (error)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700" role="alert">
        <strong>未能获取正式卡券数据。</strong>
        <span className="block mt-1 text-xs">未展示任何测试样例；请检查正式身份、权限、服务和数据迁移状态后重试。</span>
      </div>
    );
  if (emptyLabel) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{emptyLabel}</div>;
  return null;
}

function LiveVoucherStatusTag({ status }: { status: VoucherApiStatus }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${liveVoucherStatusStyle[status]}`}>{liveVoucherStatusLabel[status]}</span>;
}

function LiveGuardedAction({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
          <p className="mt-3 text-[11px] font-medium text-amber-800">当前不会向服务器发出写请求，也不会显示测试数据。</p>
        </div>
      </div>
    </div>
  );
}

const LiveVoucherReadWorkstation: React.FC<{ sessionPermissions: string[]; writeEnabled: boolean }> = ({ sessionPermissions, writeEnabled }) => {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [overview, setOverview] = useState<LiveVoucherOverview | null>(null);
  const [programs, setPrograms] = useState<LiveVoucherProgram[]>([]);
  const [reserves, setReserves] = useState<LiveVoucherReserve[]>([]);
  const [batches, setBatches] = useState<LiveVoucherBatch[]>([]);
  const [vouchers, setVouchers] = useState<LiveVoucher[]>([]);
  const [redemptions, setRedemptions] = useState<LiveVoucherRedemption[]>([]);
  const [audits, setAudits] = useState<LiveVoucherAudit[]>([]);
  const [voidBalanceHolds, setVoidBalanceHolds] = useState<LiveVoucherVoidBalanceHold[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VoucherApiStatus | 'all'>('all');
  const [searchVersion, setSearchVersion] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [writeAction, setWriteAction] = useState<VoucherWriteAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleModuleItems = formalModuleItems.filter((item) => {
    if (item.id === 'audit') return sessionPermissions.includes('voucher.audit.read');
    if (item.id === 'reconciliation') return sessionPermissions.includes('voucher.reconcile');
    return true;
  });
  const activeMeta = visibleModuleItems.find((item) => item.id === activeModule) ?? visibleModuleItems[0] ?? formalModuleItems[0];

  useEffect(() => {
    if (activeModule === 'verify') {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      if (activeModule === 'overview') setOverview(await loadLiveVoucherOverview());
      if (activeModule === 'foundation') setPrograms((await loadLiveVoucherPrograms()).items);
      if (activeModule === 'reserve' || activeModule === 'approval') {
        const [reservePage, programPage] = await Promise.all([loadLiveVoucherReserves(), loadLiveVoucherPrograms()]);
        setReserves(reservePage.items);
        setPrograms(programPage.items);
      }
      if (activeModule === 'center') {
        const [batchPage, reservePage] = await Promise.all([loadLiveVoucherBatches(), loadLiveVoucherReserves()]);
        setBatches(batchPage.items);
        setReserves(reservePage.items);
      }
      if (activeModule === 'operations') setVouchers((await loadLiveVouchers()).items);
      if (activeModule === 'query') setVouchers((await loadLiveVouchers({ query: submittedQuery, status: statusFilter === 'all' ? undefined : statusFilter })).items);
      if (activeModule === 'consumption') setRedemptions((await loadLiveVoucherRedemptions()).items);
      if (activeModule === 'audit') setAudits((await loadLiveVoucherAudit()).items);
      if (activeModule === 'reconciliation') setVoidBalanceHolds((await loadLiveVoucherVoidBalanceHolds()).items);
    };
    void load()
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'VOUCHER_API_REQUEST_FAILED');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeModule, refreshVersion, searchVersion, statusFilter, submittedQuery]);

  const pendingReserveCount = reserves.filter((item) => item.status === 'submitted').length;
  const switchModule = (module: ModuleId) => setActiveModule(module);
  const runVoucherSearch = () => {
    setSubmittedQuery(queryInput);
    setSearchVersion((current) => current + 1);
  };
  const canWrite = (permission: string) => writeEnabled && sessionPermissions.includes(permission);
  const completedWrite = () => setRefreshVersion((current) => current + 1);

  return (
    <div className="min-h-full space-y-4 bg-[#F5F7FB] p-5 lg:p-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--sw-brand-ink)] via-[#102E61] to-[var(--sw-brand-dark)] p-5 text-white shadow-lg shadow-blue-950/10">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--sw-brand)]/25 blur-2xl" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sw-brand)] shadow-lg shadow-blue-900/40">
              <TicketCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">卡券运营台</h1>
                <span className="rounded-full border border-emerald-200/30 bg-emerald-300/15 px-2 py-0.5 font-mono text-[10px] text-emerald-100">正式受控数据</span>
              </div>
              <p className="mt-0.5 text-xs text-blue-100/80">只读数据链路已启用；写操作仍受二次认证、审计与灰度控制。</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-blue-100/80 xl:flex">
            <Database className="h-4 w-4 text-emerald-300" />
            <span>来源：服务端 API，不回退为测试样例</span>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="sticky top-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="px-3 pb-2 pt-2 text-[10px] font-semibold tracking-wider text-slate-400">卡券管理模块</div>
          <div className="space-y-1">
            {visibleModuleItems.map(({ id, label, owner, icon: Icon }) => {
              const active = activeModule === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchModule(id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-[var(--sw-brand-light)] text-[var(--sw-brand-dark)] ring-1 ring-[var(--sw-brand)]/20' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--sw-brand)]' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">{owner}</span>
                  </span>
                  {id === 'approval' && pendingReserveCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{pendingReserveCount}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">
            <strong className="mb-1 block text-slate-700">凭证边界</strong>门店只核销券码；会员码仅识别会员身份。
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{activeMeta.label}</h2>
                <span className="rounded-full bg-[var(--sw-brand-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sw-brand-dark)]">{activeMeta.owner}</span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-700">仅显示通过正式权限校验的服务端数据。</p>
            </div>
            <span className="text-[11px] text-slate-400">{loading ? '读取中…' : '只读模式'}</span>
          </div>

          {activeModule === 'overview' && (
            <div className="space-y-4">
              <LiveStateNotice loading={loading} error={error} />
              {!loading && !error && overview && (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="可使用卡券" value={overview.activeVoucherCount.toLocaleString('zh-CN')} note="正式数据" icon={TicketCheck} />
                    <MetricCard label="未激活卡券" value={overview.inactiveVoucherCount.toLocaleString('zh-CN')} note="正式数据" icon={ClipboardCheck} tone="amber" />
                    <MetricCard label="已禁用卡券" value={overview.disabledVoucherCount.toLocaleString('zh-CN')} note="正式数据" icon={Ban} tone="rose" />
                    <MetricCard label="未核销有效券余额" value={liveCurrency(overview.remainingValueCents)} note="含未激活和禁用券；不含到期及作废券" icon={CircleDollarSign} tone="green" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">卡券生命周期</h3>
                        <p className="mt-1 text-[11px] text-slate-400">最后更新：{liveDate(overview.updatedAt)}</p>
                      </div>
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">已核销：{overview.redeemedVoucherCount.toLocaleString('zh-CN')} 张</span>
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
                      {[
                        ['foundation', '产品档案'],
                        ['reserve', '备券申请'],
                        ['approval', '审批'],
                        ['center', '发行批次'],
                        ['query', '会员券资产'],
                        ['verify', '券码核销'],
                        ['consumption', '消费明细'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => switchModule(id as ModuleId)}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold text-slate-700 hover:border-[var(--sw-brand)] hover:bg-[var(--sw-brand-light)]"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeModule === 'foundation' && (
            <div>
              <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && programs.length === 0 ? '正式数据库中暂未创建可查看的卡券产品档案。' : undefined} />
              {!loading && !error && programs.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['产品编码', '产品名称', '面额', '默认有效期', '核销规则', '状态'].map((head) => (
                          <th key={head} className="px-4 py-3 text-left font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono">{item.programCode}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                          <td className="px-4 py-3 font-mono">{liveCurrency(item.denominationCents)}</td>
                          <td className="px-4 py-3">{item.defaultValidDays} 天</td>
                          <td className="px-4 py-3 text-slate-500">{item.redemptionPolicy}</td>
                          <td className="px-4 py-3">{recordStatusLabel(item.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(activeModule === 'reserve' || activeModule === 'approval') && (
            <div>
              <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && reserves.length === 0 ? '正式数据库中暂未有可查看的备券申请。' : undefined} />
              {!loading && !error && reserves.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['申请单号', '产品', '申请数量', '申请面值', '状态', '创建时间', ...(activeModule === 'approval' && canWrite('voucher.reserve.approve') ? ['操作'] : [])].map((head) => (
                          <th key={head} className="px-4 py-3 text-left font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reserves.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono">{item.requestNo}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{item.programName}</td>
                          <td className="px-4 py-3 font-mono">{item.requestedQuantity.toLocaleString('zh-CN')}</td>
                          <td className="px-4 py-3 font-mono">{liveCurrency(item.requestedValueCents)}</td>
                          <td className="px-4 py-3">{recordStatusLabel(item.status)}</td>
                          <td className="px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                          {activeModule === 'approval' && canWrite('voucher.reserve.approve') && (
                            <td className="px-4 py-3">
                              {item.status === 'submitted' ? (
                                <button type="button" onClick={() => setWriteAction({ kind: 'approval', reserve: item })} className="rounded-lg border border-[var(--sw-brand)]/30 bg-[var(--sw-brand-light)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--sw-brand-dark)]">
                                  审批
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">已处理</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4">
                {activeModule === 'reserve' && canWrite('voucher.reserve.create') ? (
                  <button type="button" onClick={() => setWriteAction({ kind: 'reserve' })} className="rounded-xl bg-[var(--sw-brand)] px-4 py-2.5 text-xs font-semibold text-white">
                    创建备券申请
                  </button>
                ) : activeModule === 'approval' && canWrite('voucher.reserve.approve') ? (
                  <p className="text-xs text-slate-500">只允许审批“待审批”记录；每次审批均需二次认证。</p>
                ) : (
                  <LiveGuardedAction title={activeModule === 'approval' ? '审批写操作尚未开放' : '备券申请写操作尚未开放'} description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
                )}
              </div>
            </div>
          )}

          {activeModule === 'center' && (
            <div>
              <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && batches.length === 0 ? '正式数据库中暂未有可查看的发行批次。' : undefined} />
              {!loading && !error && batches.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['批次号', '发行数量', '发行面值', '状态', '发行时间', '创建时间'].map((head) => (
                          <th key={head} className="px-4 py-3 text-left font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono">{item.batchNo}</td>
                          <td className="px-4 py-3 font-mono">{item.issuedQuantity.toLocaleString('zh-CN')}</td>
                          <td className="px-4 py-3 font-mono">{liveCurrency(item.issuedValueCents)}</td>
                          <td className="px-4 py-3">{recordStatusLabel(item.status)}</td>
                          <td className="px-4 py-3 text-slate-500">{liveDate(item.issuedAt)}</td>
                          <td className="px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4">
                {canWrite('voucher.issue') ? (
                  <button
                    type="button"
                    onClick={() => setWriteAction({ kind: 'issue' })}
                    disabled={!reserves.some((item) => item.status === 'approved')}
                    className="rounded-xl bg-[var(--sw-brand)] px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    发行电子券批次
                  </button>
                ) : (
                  <LiveGuardedAction title="发行写操作尚未开放" description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
                )}
              </div>
            </div>
          )}

          {activeModule === 'operations' && (
            <div>
              <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && vouchers.length === 0 ? '正式数据库中暂未有可管理的卡券。' : undefined} />
              {!loading && !error && vouchers.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['券码', '产品', '状态', '剩余余额', '版本', ...(canWrite('voucher.status.manage') ? ['操作'] : [])].map((head) => (
                          <th key={head} className="px-4 py-3 text-left font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono">{item.voucherCode}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{item.programName}</td>
                          <td className="px-4 py-3">
                            <LiveVoucherStatusTag status={item.status} />
                          </td>
                          <td className="px-4 py-3 font-mono">{liveCurrency(item.remainingCents)}</td>
                          <td className="px-4 py-3 font-mono text-slate-500">{item.version}</td>
                          {canWrite('voucher.status.manage') && (
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setWriteAction({ kind: 'status', voucher: item })}
                                disabled={item.status === 'redeemed' || item.status === 'expired' || item.status === 'void'}
                                className="rounded-lg border border-[var(--sw-brand)]/30 bg-[var(--sw-brand-light)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--sw-brand-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                状态操作
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4">
                {canWrite('voucher.status.manage') ? (
                  <p className="text-xs text-slate-500">每次操作带服务端版本校验和二次认证；作废将冻结未使用余额并生成财务人工对账项，不会自动退回企业余额。</p>
                ) : (
                  <LiveGuardedAction title="卡券状态操作尚未开放" description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
                )}
              </div>
            </div>
          )}

          {activeModule === 'query' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') runVoucherSearch();
                    }}
                    className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[var(--sw-brand)]"
                    placeholder="搜索券码、卡号或产品名称"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as VoucherApiStatus | 'all');
                    setSearchVersion((current) => current + 1);
                  }}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[var(--sw-brand)]"
                >
                  <option value="all">全部状态</option>
                  {Object.entries(liveVoucherStatusLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={runVoucherSearch} className="h-9 rounded-xl bg-[var(--sw-brand)] px-4 text-xs font-semibold text-white">
                  查询
                </button>
              </div>
              <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && vouchers.length === 0 ? '没有符合条件的正式卡券数据。' : undefined} />
              {!loading && !error && vouchers.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['券码', '卡号', '产品', '状态', '初始面值', '剩余余额', '有效期', '更新时间', ...(canWrite('voucher.status.manage') ? ['操作'] : [])].map((head) => (
                          <th key={head} className="px-4 py-3 text-left font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono">{item.voucherCode}</td>
                          <td className="px-4 py-3 font-mono text-slate-500">{item.cardNo ?? '电子券'}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{item.programName}</td>
                          <td className="px-4 py-3">
                            <LiveVoucherStatusTag status={item.status} />
                          </td>
                          <td className="px-4 py-3 font-mono">{liveCurrency(item.initialCents)}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{liveCurrency(item.remainingCents)}</td>
                          <td className="px-4 py-3 text-slate-500">{liveDate(item.expiresAt)}</td>
                          <td className="px-4 py-3 text-slate-500">{liveDate(item.updatedAt)}</td>
                          {canWrite('voucher.status.manage') && (
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setWriteAction({ kind: 'status', voucher: item })}
                                disabled={item.status === 'redeemed' || item.status === 'expired' || item.status === 'void'}
                                className="rounded-lg border border-[var(--sw-brand)]/30 bg-[var(--sw-brand-light)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--sw-brand-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                状态操作
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeModule === 'consumption' && (
            <div>
              <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && redemptions.length === 0 ? '正式数据库中暂未有可查看的核销流水。' : undefined} />
              {!loading && !error && redemptions.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['流水号', '券码', '核销金额', '核销前余额', '核销后余额', '商户流水号', '时间', ...(canWrite('voucher.redemption.reverse') ? ['操作'] : [])].map((head) => (
                          <th key={head} className="px-4 py-3 text-left font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {redemptions.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono">{item.redemptionNo}</td>
                          <td className="px-4 py-3 font-mono">{item.voucherCode}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{liveCurrency(item.amountCents)}</td>
                          <td className="px-4 py-3 font-mono">{liveCurrency(item.remainingBeforeCents)}</td>
                          <td className="px-4 py-3 font-mono">{liveCurrency(item.remainingAfterCents)}</td>
                          <td className="px-4 py-3 font-mono text-slate-500">{item.merchantReference}</td>
                          <td className="px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                          {canWrite('voucher.redemption.reverse') && (
                            <td className="px-4 py-3">
                              <button type="button" onClick={() => setWriteAction({ kind: 'reverse', redemption: item })} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                                申请冲正
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeModule === 'audit' && (
            <div>
              <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && audits.length === 0 ? '当前数据范围内暂未有卡券审计记录。' : undefined} />
              {!loading && !error && audits.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['时间', '操作', '资源', '操作者', '请求 ID', '授权证据'].map((head) => (
                          <th key={head} className="px-4 py-3 text-left font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {audits.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                          <td className="px-4 py-3 font-mono text-slate-800">{item.action}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-slate-600">{item.resourceType}</span>
                            {item.resourceId && <span className="ml-1 font-mono text-slate-400">· {item.resourceId}</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">{item.actorUserId ?? '系统'}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{item.requestId}</td>
                          <td className="px-4 py-3 text-slate-600">{typeof item.grantedVia?.permission === 'string' ? item.grantedVia.permission : '已记录'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">审计记录仅追加；该列表按服务端 Membership 数据范围过滤，并保留请求 ID、操作者和授权证据用于追溯。</p>
            </div>
          )}

          {activeModule === 'reconciliation' && (
            <div>
              <LiveStateNotice loading={loading} error={error} emptyLabel={!loading && !error && voidBalanceHolds.length === 0 ? '当前数据范围内没有待处理或已完成的作废余额对账项。' : undefined} />
              {!loading && !error && voidBalanceHolds.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['券码', '冻结余额', '作废原因', '状态', '对账参考号', '作废时间', ...(canWrite('voucher.reconcile') ? ['操作'] : [])].map((head) => (
                          <th key={head} className="px-4 py-3 text-left font-semibold">
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {voidBalanceHolds.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono">{item.voucherCode}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-amber-800">{liveCurrency(item.amountCents)}</td>
                          <td className="max-w-56 truncate px-4 py-3 text-slate-600" title={item.voidReason}>
                            {item.voidReason}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${item.status === 'open' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
                            >
                              {item.status === 'open' ? '待人工对账' : '已对账'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">{item.reconciliationReference ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{liveDate(item.createdAt)}</td>
                          {canWrite('voucher.reconcile') && (
                            <td className="px-4 py-3">
                              {item.status === 'open' ? (
                                <button type="button" onClick={() => setWriteAction({ kind: 'reconcile', voidHold: item })} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                                  处理对账
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">已完成</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">作废只冻结未使用余额。完成对账只写入财务处置凭据、操作者和审计记录；不会自动入账、退回企业余额或恢复卡券。</p>
              {!canWrite('voucher.reconcile') && (
                <div className="mt-4">
                  <LiveGuardedAction title="作废余额对账写操作尚未开放" description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
                </div>
              )}
            </div>
          )}

          {activeModule === 'verify' && (
            <div>
              {canWrite('voucher.redeem') ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">门店券码核销</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">核销必须提供券码、金额和门店交易参考号；服务器会锁定单券、校验余额并写入不可变流水。</p>
                    </div>
                    <button type="button" onClick={() => setWriteAction({ kind: 'redeem' })} className="rounded-xl bg-[var(--sw-brand)] px-4 py-2.5 text-xs font-semibold text-white">
                      发起核销
                    </button>
                  </div>
                </div>
              ) : (
                <LiveGuardedAction title="门店核销尚未开放" description="当前环境未开启写操作灰度，或当前身份没有对应服务端权限。" />
              )}
            </div>
          )}
        </div>
      </section>
      <VoucherWriteActionDialog
        key={
          writeAction
            ? `${writeAction.kind}:${writeAction.kind === 'status' ? writeAction.voucher.id : writeAction.kind === 'approval' ? writeAction.reserve.id : writeAction.kind === 'reverse' ? writeAction.redemption.id : writeAction.kind === 'reconcile' ? writeAction.voidHold.id : 'new'}`
            : 'closed'
        }
        action={writeAction}
        programs={programs}
        reserves={reserves}
        onClose={() => setWriteAction(null)}
        onCompleted={completedWrite}
      />
    </div>
  );
};

export const VoucherOperationsWorkstationV1: React.FC<VoucherOperationsProps> = ({ liveDataEnabled = false, sessionPermissions = [], writeEnabled = false, ...props }) =>
  liveDataEnabled ? <LiveVoucherReadWorkstation sessionPermissions={sessionPermissions} writeEnabled={writeEnabled} /> : <VoucherPrototypeWorkstation {...props} />;
