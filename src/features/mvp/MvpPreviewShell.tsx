import React from 'react';
import { LockKeyhole } from 'lucide-react';

export function isMvpPreviewHost(initialHost = '') {
  const host = initialHost || (typeof window !== 'undefined' ? window.location.hostname : '');
  return /(^|\.)zhijian\.homes(?::\d+)?$/i.test(host);
}

export function MvpPreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-gray-800">
      <div className="bg-[#FFF8E8] border-b border-[#F4D48A] text-[#8A5A00] text-xs py-2.5 px-4 text-center">
        <span className="inline-flex items-center gap-1.5"><LockKeyhole className="w-3.5 h-3.5" />智慧翼企业福利商城 MVP 内测中</span>
      </div>
      <div className="pointer-events-none select-none">{children}</div>
    </div>
  );
}
