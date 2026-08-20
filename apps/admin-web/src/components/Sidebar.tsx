import React from 'react';
import { LayoutDashboard, PackageCheck, Truck, Building2, Handshake, Receipt, ShieldCheck, Sparkles, ChevronLeft, ChevronRight, UsersRound, BadgeCheck, TicketCheck, PanelsTopLeft } from 'lucide-react';
import { WorkstationId, WorkstationMeta, AdminProfile } from '../types';

interface SidebarProps {
  activeTab: WorkstationId;
  onSelectTab: (tab: WorkstationId) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  pendingOrdersCount?: number;
  unclassifiedProductsCount?: number;
  warningEnterprisesCount?: number;
  pendingCounts?: Record<WorkstationId, number>;
  activeCaseCount?: number;
  onOpenCaseCenter?: () => void;
  language?: 'zh' | 'en';
  currentUser?: AdminProfile;
  allowedWorkstations?: WorkstationId[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
  pendingOrdersCount = 0,
  unclassifiedProductsCount = 0,
  warningEnterprisesCount = 0,
  pendingCounts = {} as Partial<Record<WorkstationId, number>>,
  activeCaseCount = 3,
  onOpenCaseCenter,
  language = 'zh',
  currentUser,
  allowedWorkstations,
}) => {
  const isEn = language === 'en';
  const userName = currentUser?.displayName ?? (isEn ? 'Zhang Li' : '张立');
  const roleText = currentUser?.role ?? (isEn ? 'COO' : '高级运营总监 (COO)');

  const allWorkstations: WorkstationMeta[] = [
    {
      id: 'cockpit',
      name: isEn ? 'Cockpit' : '经营驾驶舱',
      badgeCount: pendingOrdersCount || pendingCounts.cockpit || 0,
      badgeColor: 'red',
      icon: 'LayoutDashboard',
    },
    {
      id: 'product',
      name: isEn ? 'Products' : '商品治理台',
      badgeCount: unclassifiedProductsCount || pendingCounts.product || 0,
      badgeColor: 'amber',
      icon: 'PackageCheck',
    },
    {
      id: 'order',
      name: isEn ? 'Order Management' : '订单管理系统',
      badgeCount: pendingOrdersCount || pendingCounts.order || 0,
      badgeColor: 'red',
      icon: 'Truck',
    },
    {
      id: 'enterprise',
      name: isEn ? 'Enterprises' : '企业福利台',
      badgeCount: warningEnterprisesCount || pendingCounts.enterprise || 0,
      badgeColor: 'amber',
      icon: 'Building2',
    },
    {
      id: 'mall',
      name: isEn ? 'Mall Applications' : '商城应用台',
      badgeCount: pendingCounts.mall || 0,
      badgeColor: 'blue',
      icon: 'PanelsTopLeft',
    },
    {
      id: 'voucher',
      name: isEn ? 'Vouchers' : '卡券运营台',
      badgeCount: pendingCounts.voucher || 0,
      badgeColor: 'amber',
      icon: 'TicketCheck',
    },
    {
      id: 'supplier',
      name: isEn ? 'Suppliers' : '供应商协同台',
      badgeCount: pendingCounts.supplier || 1,
      badgeColor: 'blue',
      icon: 'Handshake',
    },
    {
      id: 'finance',
      name: isEn ? 'Finance' : '财务与对账台',
      badgeCount: pendingCounts.finance || 3,
      badgeColor: 'red',
      icon: 'Receipt',
    },
    {
      id: 'membership',
      name: isEn ? 'Members & Access' : '会员与权限',
      badgeCount: pendingCounts.membership || 0,
      badgeColor: 'blue',
      icon: 'UsersRound',
    },
    {
      id: 'qualification',
      name: isEn ? 'Qualification' : '员工资格',
      badgeCount: pendingCounts.qualification || 0,
      badgeColor: 'blue',
      icon: 'BadgeCheck',
    },
    {
      id: 'system',
      name: isEn ? 'System Control' : '系统治理台',
      badgeCount: pendingCounts.system || 0,
      badgeColor: 'blue',
      icon: 'ShieldCheck',
    },
  ];
  const workstations = allWorkstations.filter((workstation) => !allowedWorkstations || allowedWorkstations.includes(workstation.id));

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard':
        return <LayoutDashboard className="w-4 h-4" />;
      case 'PackageCheck':
        return <PackageCheck className="w-4 h-4" />;
      case 'Truck':
        return <Truck className="w-4 h-4" />;
      case 'Building2':
        return <Building2 className="w-4 h-4" />;
      case 'TicketCheck':
        return <TicketCheck className="w-4 h-4" />;
      case 'PanelsTopLeft':
        return <PanelsTopLeft className="w-4 h-4" />;
      case 'Handshake':
        return <Handshake className="w-4 h-4" />;
      case 'Receipt':
        return <Receipt className="w-4 h-4" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4" />;
      case 'UsersRound':
        return <UsersRound className="w-4 h-4" />;
      case 'BadgeCheck':
        return <BadgeCheck className="w-4 h-4" />;
      default:
        return <LayoutDashboard className="w-4 h-4" />;
    }
  };

  return (
    <aside
      className={`${isCollapsed ? 'w-16' : 'w-[220px]'} h-full bg-gradient-to-b from-[var(--sw-sidebar-top)] to-[var(--sw-brand-ink)] text-slate-300 flex flex-col shrink-0 select-none transition-all duration-300 relative z-20 shadow-xl border-r border-white/10`}
    >
      {/* Brand Logo Header */}
      <div className="p-4 flex items-center justify-between mb-2 border-b border-white/10">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img src="/brand/brand-mark.svg" alt="" className="h-8 w-8 shrink-0 rounded-lg shadow-md shadow-blue-500/30" />
          {!isCollapsed && (
            <div className="whitespace-nowrap overflow-hidden">
              <span className="font-bold text-white tracking-tight text-sm block leading-tight">智慧翼 Smart Wing</span>
              <span className="text-[10px] text-slate-400 font-medium">{isEn ? 'Welfare Operations' : '福利平台治理系统'}</span>
            </div>
          )}
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isCollapsed ? (isEn ? 'Expand' : '展开边栏') : isEn ? 'Collapse' : '折叠边栏'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto">
        {!isCollapsed && <div className="px-2 pb-2 text-[10px] font-semibold text-slate-400/80 tracking-wider uppercase">{isEn ? 'Workstations' : '工作台工作流'}</div>}

        {workstations.map((ws) => {
          const isActive = activeTab === ws.id;
          return (
            <button
              key={ws.id}
              onClick={() => onSelectTab(ws.id)}
              title={isCollapsed ? ws.name : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-lg cursor-pointer transition-colors text-xs font-medium ${
                isActive ? 'bg-[var(--sw-brand)]/20 text-white font-semibold border border-[var(--sw-brand)]/40 shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={isActive ? 'text-[var(--sw-brand)]' : 'opacity-70'}>{renderIcon(ws.icon)}</span>
                {!isCollapsed && <span className="truncate">{ws.name}</span>}
              </div>

              {!isCollapsed && ws.badgeCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${ws.badgeColor === 'red' ? 'bg-[#ef476f] text-white' : ws.badgeColor === 'amber' ? 'bg-[#f59e0b] text-white' : 'bg-[var(--sw-brand)] text-white'}`}>
                  {ws.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Case Center Access */}
      {!isCollapsed && onOpenCaseCenter && (
        <div className="px-3 py-2 border-t border-white/10">
          <button onClick={onOpenCaseCenter} className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition-colors text-xs border border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium text-[11px]">Case 工单中心</span>
            </div>
            <span className="bg-[#f59e0b] text-slate-950 font-bold text-[10px] px-1.5 rounded-full">{activeCaseCount}</span>
          </button>
        </div>
      )}

      {/* User Footer */}
      <div className="mt-auto p-3 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-500 border border-white/20 overflow-hidden shrink-0 flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br from-blue-500 to-indigo-600">
            {(userName || '智').slice(0, 1)}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">{userName}</div>
              <div className="text-[10px] text-slate-400 truncate">{roleText}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
