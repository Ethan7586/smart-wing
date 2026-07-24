import React from 'react';
import { LockKeyhole } from 'lucide-react';
import { useMall } from '../../context/MallContext';

export function isMvpPreviewHost() {
  return typeof window !== 'undefined' && /(^|\.)zhijian\.homes$/i.test(window.location.hostname);
}

export function MvpPreviewShell({ children }: { children: React.ReactNode }) {
  const { showToast } = useMall();
  const blockUnreleasedAction = (event: React.MouseEvent<HTMLDivElement>) => {
    const action = (event.target as HTMLElement).closest('a, button, [role="button"]');
    if (!action || action.closest('[data-mvp-preview-allowed="true"]')) return;
    event.preventDefault();
    event.stopPropagation();
    showToast('MVP 内测中：该功能完成联调后开放', 'info');
  };
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-gray-800" onClickCapture={blockUnreleasedAction}>
      <div className="bg-[#FFF8E8] border-b border-[#F4D48A] text-[#8A5A00] text-xs py-2.5 px-4 text-center">
        <span className="inline-flex items-center gap-1.5"><LockKeyhole className="w-3.5 h-3.5" />智慧翼企业福利商城 MVP 内测中</span>
      </div>
      {children}
    </div>
  );
}
