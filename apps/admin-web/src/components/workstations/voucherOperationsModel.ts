/** Module registry, status vocabulary and formatters for the voucher workstation. */
import React from 'react';
import { Building2, CircleDollarSign, ClipboardCheck, ClipboardList, FileSearch, Layers3, ReceiptText, RefreshCcw, ScanLine, ShieldCheck, TicketCheck } from 'lucide-react';
import { type VoucherApiStatus } from '../../services/vouchers';

export type ModuleId = 'overview' | 'foundation' | 'reserve' | 'approval' | 'center' | 'operations' | 'query' | 'consumption' | 'verify' | 'audit' | 'reconciliation';

export const moduleItems: Array<{ id: ModuleId; label: string; owner: string; icon: React.ElementType }> = [
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
export const formalModuleItems: Array<{ id: ModuleId; label: string; owner: string; icon: React.ElementType }> = [...moduleItems, { id: 'reconciliation', label: '作废余额对账', owner: '财务', icon: CircleDollarSign }];

export const liveVoucherStatusLabel: Record<VoucherApiStatus, string> = {
  inactive: '未激活',
  active: '可使用',
  disabled: '已禁用',
  redeemed: '已核销',
  expired: '已过期',
  void: '已作废',
};

export const liveVoucherStatusStyle: Record<VoucherApiStatus, string> = {
  inactive: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  disabled: 'bg-orange-50 text-orange-700 border-orange-200',
  redeemed: 'bg-blue-50 text-blue-700 border-blue-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  void: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function liveCurrency(cents: number): string {
  return `¥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function liveDate(value: string | null): string {
  if (!value) return '暂未接入';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

export function recordStatusLabel(value: string): string {
  return ({ submitted: '待审批', approved: '已批准', rejected: '已拒绝', issued: '已发行', active: '启用', inactive: '停用' } as Record<string, string>)[value] ?? value;
}
