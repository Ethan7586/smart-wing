'use client';

import React from 'react';
import { MallProvider, useMall } from '../context/MallContext';
import { mallService } from '../services/mallService';

const MobileFrame = React.lazy(() => import('../components/mobile/MobileFrame').then(({ MobileFrame }) => ({ default: MobileFrame })));
const TabletFrame = React.lazy(() => import('../components/mobile/TabletFrame').then(({ TabletFrame }) => ({ default: TabletFrame })));
const LaptopFrame = React.lazy(() => import('../components/laptop/LaptopFrame').then(({ LaptopFrame }) => ({ default: LaptopFrame })));

function DeviceShowcaseContent() {
  const { appMode } = useMall();
  if (appMode === 'mini-program' || appMode === 'android-app') return <MobileFrame />;
  if (appMode === 'tablet-app') return <TabletFrame />;
  if (appMode === 'laptop-web') return <LaptopFrame />;
  return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">该展示入口不存在</div>;
}

export function DeviceShowcase() {
  return (
    <MallProvider showcaseService={mallService}>
      <React.Suspense fallback={<div className="min-h-screen bg-slate-950" aria-busy="true" />}>
        <DeviceShowcaseContent />
      </React.Suspense>
    </MallProvider>
  );
}
