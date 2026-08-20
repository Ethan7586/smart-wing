import { Building2, MapPin, QrCode, Store, Ticket, UserRound } from 'lucide-react';
import type { MallApplicationConfig } from '../../services/mallApplications';

const icons = { enterprise: Building2, city: MapPin, voucher: Ticket, partner: Store };
const themeClass = {
  'smart-blue': 'from-[var(--sw-brand)] to-[var(--sw-brand-dark)]',
  'city-blue': 'from-[var(--sw-brand-dark)] to-[var(--sw-sidebar-top)]',
  'festival-blue': 'from-[var(--sw-brand)] to-[var(--sw-sidebar-top)]',
};

export function MallPhonePreview({ config }: { config: MallApplicationConfig }) {
  const entries = [...config.entries].filter((item) => item.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  const segments = [...config.segments].filter((item) => item.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="mx-auto w-[306px] rounded-3xl border-[8px] border-slate-900 bg-slate-50 shadow-2xl">
      <div className="flex h-7 items-center justify-between rounded-t-2xl bg-white px-5 text-xs font-bold text-slate-800">
        <span>8:12</span>
        <span className="h-2 w-16 rounded-full bg-slate-900" />
        <span>5G</span>
      </div>
      <div className="h-[558px] overflow-hidden px-4 pb-14 pt-3 text-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold">{config.mallDisplayName}</p>
            <p className="mt-0.5 text-xs text-blue-700">智慧翼 · 企业福利商城</p>
          </div>
          <div className="flex h-8 w-14 items-center justify-center rounded-full bg-slate-200 text-xs">•••</div>
        </div>
        <div className="mt-3 truncate rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-400">搜索福利商品、品牌或附近门店</div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">福利卡余额</p>
          <p className="mt-1 text-2xl font-bold">¥0.00</p>
          <p className="mt-3 truncate border-t border-slate-100 pt-2 text-xs text-blue-700">{config.announcement}</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl bg-white px-2 py-3 shadow-sm">
          {entries.map((entry) => {
            const Icon = icons[entry.key];
            return (
              <div key={entry.key} className="text-center">
                <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-1 truncate text-xs">{entry.label}</p>
              </div>
            );
          })}
        </div>
        <div className={`mt-3 rounded-2xl bg-gradient-to-br ${themeClass[config.themePreset]} p-4 text-white`}>
          <p className="text-lg font-bold">{config.hero.title}</p>
          <p className="mt-1 truncate text-xs text-white/80">{config.hero.subtitle}</p>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">合作卖场</p>
            <p className="text-xs text-slate-400">共 {config.partners.length} 家</p>
          </div>
          <div className="mt-2 flex gap-2 overflow-hidden">
            {config.partners.slice(0, 5).map((partner) => (
              <div key={partner} className="min-w-10 text-center">
                <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                  <Store className="h-4 w-4 text-slate-500" />
                </span>
                <p className="mt-1 truncate text-xs">{partner}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {segments.slice(0, 2).map((segment) => (
            <div key={segment.key} className="rounded-xl bg-white p-3">
              <p className="truncate text-xs font-bold">{segment.title}</p>
              <p className="mt-1 truncate text-xs text-slate-400">{segment.description}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="-mt-12 flex h-12 items-center justify-around rounded-b-2xl border-t border-slate-200 bg-white text-xs text-slate-500">
        <span>首页</span>
        <span>分类</span>
        <span className="-mt-5 flex h-12 w-12 flex-col items-center justify-center rounded-full border bg-white text-blue-600 shadow">
          <QrCode className="h-5 w-5" />
          会员码
        </span>
        <span>订单</span>
        <span>
          <UserRound className="mx-auto h-4 w-4" />
          我的
        </span>
      </div>
    </div>
  );
}
