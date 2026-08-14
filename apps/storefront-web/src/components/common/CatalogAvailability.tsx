import React from 'react';
import { AlertCircle, AlertTriangle, Database, LoaderCircle } from 'lucide-react';
import type { CatalogSyncStatus, SessionStatus } from '../../context/MallContext.types';

type CatalogAvailabilityProps = {
  catalogSyncStatus: CatalogSyncStatus;
  sessionStatus: SessionStatus;
  productCount: number;
  onRetry?: () => void;
};

export function CatalogAvailability({ catalogSyncStatus, sessionStatus, productCount, onRetry }: CatalogAvailabilityProps) {
  if (sessionStatus === 'checking' || catalogSyncStatus === 'syncing') {
    return <CatalogState icon={<LoaderCircle className="h-10 w-10 animate-spin text-[var(--sw-brand)]" />} title="正在从商品数据库同步目录" message="同步完成前不展示本地缓存或演示商品。" tone="border-blue-200" />;
  }
  if (catalogSyncStatus === 'error') {
    const message = sessionStatus === 'guest' ? '请先登录企业账号，再从数据库读取有权限购买的商品。' : '商品接口同步失败，请稍后刷新重试。';
    return (
      <CatalogState
        icon={<AlertTriangle className="h-10 w-10 text-red-500" />}
        title="真实商品目录尚未加载"
        message={message}
        note="为避免把演示数据误认为真实库存，主 Shop 已关闭演示目录回退。"
        tone="border-red-200"
        onRetry={sessionStatus === 'authenticated' ? onRetry : undefined}
      />
    );
  }
  if (catalogSyncStatus === 'idle') {
    return <CatalogState icon={<Database className="h-10 w-10 text-amber-500" />} title="商品数据库等待连接" message="请登录企业账号；主 Shop 不再从浏览器缓存或演示目录补商品。" tone="border-amber-200" />;
  }
  if (productCount === 0) {
    return <CatalogState icon={<Database className="h-10 w-10 text-gray-400" />} title="数据库暂无可展示商品" message="当前企业与会员资格下没有已上架、可见的商品记录。" tone="border-gray-200" />;
  }
  return null;
}

export function MissingCatalogProduct({ catalogSyncStatus, onBack }: { catalogSyncStatus: CatalogSyncStatus; onBack: () => void }) {
  return (
    <div className="max-w-[960px] mx-auto px-4 py-20 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
      <h1 className="mt-4 text-lg font-bold text-gray-900">商品详情不可用</h1>
      <p className="mt-2 text-sm text-gray-500">{catalogSyncStatus === 'ready' ? '数据库中没有找到这件商品，可能已下架或不属于当前企业货盘。' : '真实商品目录尚未完成同步。'}</p>
      <button onClick={onBack} className="mt-5 rounded-lg bg-[var(--sw-brand)] px-5 py-2 text-sm font-bold text-white">
        返回商城首页
      </button>
    </div>
  );
}

function CatalogState({ icon, title, message, note, tone, onRetry }: { icon: React.ReactNode; title: string; message: string; note?: string; tone: string; onRetry?: () => void }) {
  return (
    <div className="max-w-[960px] mx-auto px-4 py-20">
      <div className={`rounded-lg border bg-white p-12 text-center shadow-sm ${tone}`}>
        <div className="flex justify-center">{icon}</div>
        <h1 className="mt-4 text-lg font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        {note ? <p className="mt-3 text-xs text-gray-400">{note}</p> : null}
        {onRetry ? (
          <button onClick={onRetry} className="mt-5 rounded-lg border border-[var(--sw-brand)] px-5 py-2 text-sm font-bold text-[var(--sw-brand)] hover:bg-blue-50">
            重新同步商品
          </button>
        ) : null}
      </div>
    </div>
  );
}
