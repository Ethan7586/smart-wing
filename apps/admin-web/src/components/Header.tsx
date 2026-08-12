import React from 'react';
import { Search, Bell, UserCheck, Sparkles, Command, Globe } from 'lucide-react';
import { AdminProfile } from '../types';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onOpenCaseCenter: () => void;
  activeCaseCount: number;
  unreadNotificationCount: number;
  onQuickCommand: (cmd: string) => void;
  activeWorkstationName?: string;
  language?: 'zh' | 'en';
  onToggleLanguage?: () => void;
  currentUser?: AdminProfile;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommandPalette,
  onOpenCaseCenter,
  activeCaseCount,
  unreadNotificationCount,
  onQuickCommand,
  activeWorkstationName = '经营驾驶舱',
  language = 'zh',
  onToggleLanguage,
  currentUser,
  onLogout,
}) => {
  const isEn = language === 'en';
  const displayName = currentUser?.displayName ?? (isEn ? 'Zhang Li' : '张立');
  const roleLabel = currentUser?.role ?? (isEn ? 'Admin' : '全量高权');
  const permissionLabel = currentUser?.permissionTags?.join(' / ') ?? (isEn ? 'Admin' : '管理员');

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 z-10">
      {/* Workstation Title Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-800 font-bold text-sm tracking-tight">{activeWorkstationName}</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 font-medium">{isEn ? 'Real-time Operations & Governance Dashboard' : '实时经营与闭环治理看板'}</span>
      </div>

      {/* Center & Right Search, Actions, Profile */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Search Bar Input / Command Palette Trigger */}
        <div className="relative group">
          <button
            onClick={onOpenCommandPalette}
            className="bg-slate-100 hover:bg-slate-100/80 border border-slate-200/80 rounded-full py-1.5 pl-9 pr-12 w-64 md:w-72 text-left focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)] text-xs transition-all cursor-pointer flex items-center justify-between text-slate-500"
          >
            <span className="truncate">{isEn ? 'Search orders, products, or AI commands...' : '搜索订单、商品或自然语言命令...'}</span>
            <div className="flex items-center gap-0.5 text-[10px] bg-white px-1.5 py-0.5 rounded-full border border-slate-200 text-slate-400 font-mono shadow-2xs">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </button>
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Quick Command Pills */}
        <div className="hidden xl:flex items-center gap-1.5">
          <button
            onClick={() => onQuickCommand('查看华北大区本月预算异常')}
            className="text-[11px] px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/60 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            🔥 {isEn ? 'North China Alert' : '华北大区预警'}
          </button>
          <button
            onClick={() => onQuickCommand('处理待分类商品')}
            className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            📦 {isEn ? '10 Unclassified Products' : '10件待分类'}
          </button>
        </div>

        {/* Case Center Trigger Pill */}
        <button
          onClick={onOpenCaseCenter}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>{isEn ? 'Cases' : 'Case 工单'}</span>
          {activeCaseCount > 0 && <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[#f59e0b] text-white font-bold">{activeCaseCount}</span>}
        </button>

        {/* Language Switcher Button */}
        {onToggleLanguage && (
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            title="Switch Language / 切换语言"
          >
            <Globe className="w-3.5 h-3.5 text-[var(--sw-brand)]" />
            <span>{isEn ? 'EN' : '中文'}</span>
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center" title={isEn ? 'Notifications' : '通知中心'}>
            <Bell className="w-4 h-4" />
          </button>
          {unreadNotificationCount > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-[#ef476f] rounded-full border-2 border-white" />}
        </div>

        <div className="h-4 w-px bg-slate-200 my-auto" />

        {/* Operator Profile */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--sw-brand)]/10 border border-[var(--sw-brand)]/30 text-[var(--sw-brand)] flex items-center justify-center font-bold text-xs shadow-2xs">{(displayName || '智').slice(0, 1)}</div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>{displayName}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 text-[var(--sw-brand)] border border-blue-200 font-semibold">COO</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <UserCheck className="w-2.5 h-2.5 text-[#15a46b]" />
              <span>
                {roleLabel}
                {permissionLabel ? ` · ${permissionLabel}` : ''}
              </span>
            </div>
            {onLogout && (
              <button type="button" onClick={onLogout} className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer mt-0.5">
                {isEn ? 'Logout' : '退出登录'}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
