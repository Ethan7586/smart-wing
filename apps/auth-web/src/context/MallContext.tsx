/**
 * 智慧翼企业福利商城 - MallContext 状态上下文
 * 技术服务方：雍彻科技
 */

import React, { createContext, useContext, useState } from 'react';
import { DomainType, MallContextType, ScreenType } from '../types';

const MallContext = createContext<MallContextType | undefined>(undefined);

export const MallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentDomain, setDomain] = useState<DomainType>(() => (window.location.hostname === 'smart.hbbtzn.com' ? 'smart.hbbtzn.com' : 'hbbtzn.com'));
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('login');
  const [screenParams, setScreenParams] = useState<Record<string, any>>({});
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  const navigateTo = (screen: ScreenType, params?: Record<string, any>) => {
    setCurrentScreen(screen);
    setScreenParams(params || {});
  };

  return (
    <MallContext.Provider
      value={{
        currentDomain,
        setDomain,
        currentScreen,
        screenParams,
        navigateTo,
        acceptedTerms,
        setAcceptedTerms,
        activeSession,
        setActiveSession,
      }}
    >
      {children}
    </MallContext.Provider>
  );
};

export const useMallContext = (): MallContextType => {
  const context = useContext(MallContext);
  if (!context) {
    throw new Error('useMallContext must be used within a MallProvider');
  }
  return context;
};
