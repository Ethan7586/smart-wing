import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GuardrailModal } from './components/GuardrailModal';
import { CaseCenterDrawer } from './components/CaseCenterDrawer';
import { CommandPaletteModal } from './components/CommandPaletteModal';

// Workstations
import { CockpitWorkstation } from './components/workstations/CockpitWorkstation';
import { ProductGovernanceWorkstation } from './components/workstations/ProductGovernanceWorkstation';
import { OrderFulfillmentWorkstation } from './components/workstations/OrderFulfillmentWorkstation';
import { EnterpriseWelfareWorkstation } from './components/workstations/EnterpriseWelfareWorkstation';
import { SupplierGovernanceWorkstation } from './components/workstations/SupplierGovernanceWorkstation';
import { FinancialReconciliationWorkstation } from './components/workstations/FinancialReconciliationWorkstation';
import { SystemControlWorkstation } from './components/workstations/SystemControlWorkstation';

// Mock Datasets
import { INITIAL_ADMIN_ACCOUNTS, INITIAL_ENTERPRISES, INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_SUPPLIERS, INITIAL_CASES, INITIAL_FINANCE_DISCREPANCIES, INITIAL_SYSTEM_CONFIG } from './data/mockData';

import { WorkstationId, Order, Product, Enterprise, Supplier, CaseItem, CaseStatus, FinanceDiscrepancyRow, SystemConfig, GuardrailActionOptions, AdminAccount } from './types';

const SESSION_KEY = 'smart-wing-admin-session';

export function App() {
  // Navigation & UI States
  const [activeWorkstation, setActiveWorkstation] = useState<WorkstationId>('cockpit');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isCaseCenterOpen, setIsCaseCenterOpen] = useState<boolean>(false);
  const [guardrailOptions, setGuardrailOptions] = useState<GuardrailActionOptions | null>(null);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  // Mock auth state
  const [currentUser, setCurrentUser] = useState<AdminAccount | null>(() => {
    try {
      const cached = window.localStorage.getItem(SESSION_KEY);
      if (!cached) {
        return null;
      }
      const parsed = JSON.parse(cached) as { username: string };
      return INITIAL_ADMIN_ACCOUNTS.find((account) => account.username === parsed?.username) ?? null;
    } catch {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Application Domain State (In-Memory Mock Single Source of Truth)
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [enterprises, setEnterprises] = useState<Enterprise[]>(INITIAL_ENTERPRISES);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [cases, setCases] = useState<CaseItem[]>(INITIAL_CASES);
  const [discrepancies, setDiscrepancies] = useState<FinanceDiscrepancyRow[]>(INITIAL_FINANCE_DISCREPANCIES);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(INITIAL_SYSTEM_CONFIG);

  // Sub-filter parameters for cross-workstation navigation
  const [filterParams, setFilterParams] = useState<{
    key?: string;
    value?: string;
  }>({});

  const handleToggleLanguage = () => {
    setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenGuardrail = (title: string, actionType: string, targetEntityName: string, entityId: string, impactAmount: number, onConfirm: (reason: string, evidence: string) => void) => {
    setGuardrailOptions({
      title,
      actionType,
      targetEntityName,
      entityId,
      impactAmount,
      onConfirm,
    });
  };

  const handleNavigateToWorkstation = (wsId: WorkstationId, filterKey?: string, filterValue?: string) => {
    setActiveWorkstation(wsId);
    if (filterKey && filterValue) {
      setFilterParams({ key: filterKey, value: filterValue });
    } else {
      setFilterParams({});
    }
  };

  const handleUpdateCaseStatus = (caseId: string, newStatus: CaseStatus, operator: string, note: string) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            status: newStatus,
            actionLogs: [
              ...c.actionLogs,
              {
                timestamp: new Date().toLocaleString('zh-CN'),
                operator,
                action: `状态流转至 [${newStatus}]`,
                remark: note,
              },
            ],
          };
        }
        return c;
      })
    );
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const user = INITIAL_ADMIN_ACCOUNTS.find((account) => account.username === loginForm.username.trim() && account.password === loginForm.password);

    if (!user) {
      setLoginError('账号或密码不正确，请重试。');
      return;
    }

    if (!user.canLoginAdmin) {
      setLoginError('该账号为商城账号，仅支持 https://www.hbbtzn.com 购物，不支持后台登录。');
      return;
    }

    setCurrentUser(user);
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username }));
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginForm({ username: '', password: '' });
    setLoginError('');
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/6 border border-white/15 rounded-xl p-6 space-y-5">
          <h1 className="text-2xl font-bold text-white">Smart Wing 管理后台</h1>
          <p className="text-sm text-slate-300">请选择角色并输入密码，登录后进入运营管理台。</p>

          <form onSubmit={handleLogin} className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-300">账号</span>
              <input
                className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:border-[#1769ff]"
                value={loginForm.username}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="例如：李厚亿 / 测试员 / 福宝"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">密码</span>
              <input
                type="password"
                className="mt-1 w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:border-[#1769ff]"
                value={loginForm.password}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="输入密码"
              />
            </label>
            {loginError && <p className="text-xs text-red-300">{loginError}</p>}
            <button type="submit" className="w-full rounded-md bg-[#1769ff] hover:bg-[#1452d4] text-white px-3 py-2 text-sm font-semibold cursor-pointer">
              登录后台
            </button>
          </form>

          <div className="space-y-2">
            <p className="text-xs text-slate-300">快速填充账号：</p>
            <div className="flex flex-wrap gap-2">
              {INITIAL_ADMIN_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  className="px-2 py-1.5 text-xs rounded-md bg-white/10 border border-white/20 hover:bg-white/15"
                  onClick={() => setLoginForm({ username: account.username, password: account.password })}
                >
                  {account.username}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">提示：当前内置账号均为演示密码，建议首次上生产环境时替换为正式鉴权服务。</p>
          </div>
        </div>
      </div>
    );
  }

  // Counts for Header badges
  const pendingOrdersCount = orders.filter((o) => o.isProblematic).length;
  const unclassifiedProductsCount = products.filter((p) => p.status === '待分类审核').length;
  const warningEnterprisesCount = enterprises.filter((e) => e.status === '已预警').length;
  const activeCasesCount = cases.filter((c) => c.status !== '关闭' && c.status !== '复盘').length;

  const isEn = language === 'en';

  const activeWorkstationName = {
    cockpit: isEn ? 'Cockpit' : '经营驾驶舱',
    product: isEn ? 'Products' : '商品治理台',
    order: isEn ? 'Orders' : '订单履约台',
    enterprise: isEn ? 'Enterprises' : '企业福利台',
    supplier: isEn ? 'Suppliers' : '供应商协同台',
    finance: isEn ? 'Finance' : '财务与对账台',
    system: isEn ? 'System Control' : '系统治理台',
  }[activeWorkstation];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] font-sans text-[13px] text-slate-700 antialiased selection:bg-[#1769ff] selection:text-white">
      {/* 1. Deep Navy Sidebar Navigation */}
      <Sidebar
        activeTab={activeWorkstation}
        onSelectTab={(wsId) => {
          setActiveWorkstation(wsId);
          setFilterParams({});
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        pendingOrdersCount={pendingOrdersCount}
        unclassifiedProductsCount={unclassifiedProductsCount}
        warningEnterprisesCount={warningEnterprisesCount}
        activeCaseCount={activeCasesCount}
        onOpenCaseCenter={() => setIsCaseCenterOpen(true)}
        language={language}
        currentUser={currentUser}
      />

      {/* Main Workspace Wrapper */}
      <div className="flex-1 flex flex-col min-w-[900px] overflow-hidden">
        {/* 2. Top Header Navigation Bar */}
        <Header
          activeWorkstationName={activeWorkstationName}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenCaseCenter={() => setIsCaseCenterOpen(true)}
          activeCaseCount={activeCasesCount}
          unreadNotificationCount={pendingOrdersCount + unclassifiedProductsCount}
          onQuickCommand={(cmd) => {
            if (cmd.includes('华北')) {
              handleNavigateToWorkstation('enterprise', 'search', '国家电网华北分公司');
            } else if (cmd.includes('待分类')) {
              handleNavigateToWorkstation('product', 'status', '待分类审核');
            }
          }}
          language={language}
          onToggleLanguage={handleToggleLanguage}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* 3. Main Workstation Area */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {activeWorkstation === 'cockpit' && (
            <CockpitWorkstation orders={orders} products={products} enterprises={enterprises} onNavigateToWorkstation={handleNavigateToWorkstation} onOpenGuardrail={handleOpenGuardrail} language={language} />
          )}

          {activeWorkstation === 'product' && (
            <ProductGovernanceWorkstation products={products} onUpdateProducts={setProducts} onOpenGuardrail={handleOpenGuardrail} initialFilterStatus={filterParams.key === 'status' ? filterParams.value : undefined} />
          )}

          {activeWorkstation === 'order' && (
            <OrderFulfillmentWorkstation orders={orders} onUpdateOrders={setOrders} onOpenGuardrail={handleOpenGuardrail} initialProblemType={filterParams.key === 'problemType' ? filterParams.value : undefined} />
          )}

          {activeWorkstation === 'enterprise' && <EnterpriseWelfareWorkstation enterprises={enterprises} onOpenGuardrail={handleOpenGuardrail} initialSearchName={filterParams.key === 'search' ? filterParams.value : undefined} />}

          {activeWorkstation === 'supplier' && <SupplierGovernanceWorkstation suppliers={suppliers} onUpdateSuppliers={setSuppliers} onOpenGuardrail={handleOpenGuardrail} />}

          {activeWorkstation === 'finance' && (
            <FinancialReconciliationWorkstation discrepancies={discrepancies} onUpdateDiscrepancies={setDiscrepancies} onOpenGuardrail={handleOpenGuardrail} initialFilterDiscrepancyOnly={filterParams.key === 'discrepancy'} />
          )}

          {activeWorkstation === 'system' && <SystemControlWorkstation config={systemConfig} onUpdateConfig={setSystemConfig} onOpenGuardrail={handleOpenGuardrail} />}
        </main>

        {/* System Footer Bar */}
        <footer className="h-9 bg-white border-t border-slate-200/80 px-6 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div>
            © 2026 Smart Wing {isEn ? 'Operations System' : '运营系统'} • {isEn ? 'Node' : '节点'}: BJ-01-PROD
          </div>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15a46b]"></span>
              {isEn ? 'Secure Connection' : '安全连接中'}
            </span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{isEn ? 'Gemini API L1 Authorized' : 'Gemini API L1 授权模式'}</span>
          </div>
        </footer>
      </div>

      {/* 4. Global Modals & Drawers */}
      <GuardrailModal options={guardrailOptions} onClose={() => setGuardrailOptions(null)} />

      <CaseCenterDrawer
        isOpen={isCaseCenterOpen}
        onClose={() => setIsCaseCenterOpen(false)}
        cases={cases}
        onUpdateCaseStatus={handleUpdateCaseStatus}
        onNavigateToWorkstation={(wsId, objId) => {
          handleNavigateToWorkstation(wsId, 'objectId', objId);
          setIsCaseCenterOpen(false);
        }}
      />

      <CommandPaletteModal isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} onNavigateWithFilter={handleNavigateToWorkstation} />
    </div>
  );
}
export default App;
