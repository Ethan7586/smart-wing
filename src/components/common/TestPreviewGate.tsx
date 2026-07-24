import React from 'react';
import { LockKeyhole } from 'lucide-react';
import { useMall } from '../../context/MallContext';

export function TestPreviewGate({ children }: { children: React.ReactNode }) {
  const { showToast } = useMall();
  const isPreviewHost = typeof window !== 'undefined' && /(^|\.)zhijian\.homes$/i.test(window.location.hostname);
  if (!isPreviewHost) return <>{children}</>;
  const blockUnreleasedAction = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const action = target.closest('a, button, [role="button"]');
    if (!action || action.closest('[data-test-preview-allowed="true"]')) return;
    event.preventDefault();
    event.stopPropagation();
    showToast('内部测试站：该功能正在联调，MVP体验版开放后可使用', 'info');
  };
  return (
    <div onClickCapture={blockUnreleasedAction}>
      <div className="bg-[#FFF8E8] border-b border-[#F4D48A] text-[#8A5A00] text-xs py-2 px-4 text-center">
        <span className="inline-flex items-center gap-1.5"><LockKeyhole className="w-3.5 h-3.5" />内部测试环境：当前仅开放登录与首页预览</span>
      </div>
      {children}
    </div>
  );
}
