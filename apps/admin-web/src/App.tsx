import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GuardrailModal } from './components/GuardrailModal';
import { CaseCenterDrawer } from './components/CaseCenterDrawer';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { loadAdminOverview, setLiveProductStatus, shipLiveOrder, type LiveOperationsSummary } from './services/catalog';

// Workstations
import { CockpitWorkstation } from './components/workstations/CockpitWorkstation';
import { ProductGovernanceWorkstation } from './components/workstations/ProductGovernanceWorkstation';
import { OrderFulfillmentWorkstation } from './components/workstations/OrderFulfillmentWorkstation';
import { EnterpriseWelfareWorkstation } from './components/workstations/EnterpriseWelfareWorkstation';
import { SupplierGovernanceWorkstation } from './components/workstations/SupplierGovernanceWorkstation';
import { FinancialReconciliationWorkstation } from './components/workstations/FinancialReconciliationWorkstation';
import { SystemControlWorkstation } from './components/workstations/SystemControlWorkstation';

// Mock Datasets
import { ADMIN_PROFILES, INITIAL_ENTERPRISES, INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_SUPPLIERS, INITIAL_CASES, INITIAL_FINANCE_DISCREPANCIES, INITIAL_SYSTEM_CONFIG } from './data/mockData';

import { WorkstationId, Order, Product, Enterprise, Supplier, CaseItem, CaseStatus, FinanceDiscrepancyRow, SystemConfig, GuardrailActionOptions, AdminProfile } from './types';

function allowedWorkstationsFor(permissions: string[]): WorkstationId[] {
  const allowed = new Set<WorkstationId>(['cockpit']);
  const has = (permission: string) => permissions.includes(permission);
  if (has('catalog.read') || has('product.publish')) allowed.add('product');
  if (has('order.read') || has('order.ship')) allowed.add('order');
  if (has('tenant.manage') || has('role.grant') || has('audit.read')) allowed.add('enterprise');
  if (has('tenant.manage') || has('product.publish')) allowed.add('supplier');
  if (has('finance.reconcile')) allowed.add('finance');
  if (has('tenant.manage') || has('role.grant')) allowed.add('system');
  return [...allowed];
}

function resolveAdminAccount(roles: unknown): AdminProfile | null {
  if (!Array.isArray(roles)) return null;
  const roleCodes = new Set(roles.filter((role): role is string => typeof role === 'string'));
  const username = roleCodes.has('platform_owner') ? 'onewr' : roleCodes.has('enterprise_manager') ? '经理1' : roleCodes.has('role-mall-admin') ? '福宝' : null;
  return username ? (ADMIN_PROFILES.find((account) => account.username === username) ?? null) : null;
}

export function App() {
  // Navigation & UI States
  const [activeWorkstation, setActiveWorkstation] = useState<WorkstationId>('cockpit');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isCaseCenterOpen, setIsCaseCenterOpen] = useState<boolean>(false);
  const [guardrailOptions, setGuardrailOptions] = useState<GuardrailActionOptions | null>(null);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  // Access is derived exclusively from the host-only smart.hbbtzn.com session.
  const [currentUser, setCurrentUser] = useState<AdminProfile | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<string[]>([]);
  const [isLiveCatalog, setIsLiveCatalog] = useState(false);
  const [liveOperations, setLiveOperations] = useState<LiveOperationsSummary | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

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

  useEffect(() => {
    let active = true;
    void loadAdminOverview()
      .then((payload) => {
        if (!active) return;
        const user = payload?.authenticated && payload?.authorization?.target === 'admin' ? resolveAdminAccount(payload.authorization.roles) : null;
        if (user) {
          setCurrentUser(user);
          setSessionPermissions(Array.isArray(payload?.authorization?.permissions) ? payload.authorization.permissions.filter((permission: unknown): permission is string => typeof permission === 'string') : []);
          setProducts(payload.products);
          setOrders(payload.orders);
          setLiveOperations(payload.summary);
          setIsLiveCatalog(true);
          setAuthChecking(false);
          return;
        }
        window.location.replace('https://hbbtzn.com/login/?target=admin');
      })
      .catch(() => {
        if (active) window.location.replace('https://hbbtzn.com/login/?target=admin');
      });
    return () => {
      active = false;
    };
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
    if (!allowedWorkstationsFor(sessionPermissions).includes(wsId)) return;
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

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    setCurrentUser(null);
    window.location.replace('https://hbbtzn.com/login/?target=admin');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <p className="text-sm text-slate-300">正在验证运营后台安全会话…</p>
      </div>
    );
  }

  if (!currentUser) return null;

  const allowedWorkstations = allowedWorkstationsFor(sessionPermissions);
  const visibleWorkstation = allowedWorkstations.includes(activeWorkstation) ? activeWorkstation : 'cockpit';

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
  }[visibleWorkstation];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] font-sans text-[13px] text-slate-700 antialiased selection:bg-[#1769ff] selection:text-white">
      {/* 1. Deep Navy Sidebar Navigation */}
      <Sidebar
        activeTab={visibleWorkstation}
        onSelectTab={(wsId) => {
          if (!allowedWorkstations.includes(wsId)) return;
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
        allowedWorkstations={allowedWorkstations}
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
          {visibleWorkstation === 'cockpit' && (
            <CockpitWorkstation orders={orders} products={products} enterprises={enterprises} liveOperations={liveOperations} onNavigateToWorkstation={handleNavigateToWorkstation} onOpenGuardrail={handleOpenGuardrail} language={language} />
          )}

          {visibleWorkstation === 'product' && (
            <ProductGovernanceWorkstation
              products={products}
              onUpdateProducts={setProducts}
              onOpenGuardrail={handleOpenGuardrail}
              initialFilterStatus={filterParams.key === 'status' ? filterParams.value : undefined}
              isLiveCatalog={isLiveCatalog}
              onSetProductStatus={setLiveProductStatus}
            />
          )}

          {visibleWorkstation === 'order' && (
            <OrderFulfillmentWorkstation
              orders={orders}
              onUpdateOrders={setOrders}
              onOpenGuardrail={handleOpenGuardrail}
              initialProblemType={filterParams.key === 'problemType' ? filterParams.value : undefined}
              isLiveOrders={isLiveCatalog}
              onShipOrder={shipLiveOrder}
            />
          )}

          {visibleWorkstation === 'enterprise' && <EnterpriseWelfareWorkstation enterprises={enterprises} onOpenGuardrail={handleOpenGuardrail} initialSearchName={filterParams.key === 'search' ? filterParams.value : undefined} />}

          {visibleWorkstation === 'supplier' && <SupplierGovernanceWorkstation suppliers={suppliers} onUpdateSuppliers={setSuppliers} onOpenGuardrail={handleOpenGuardrail} />}

          {visibleWorkstation === 'finance' && (
            <FinancialReconciliationWorkstation discrepancies={discrepancies} onUpdateDiscrepancies={setDiscrepancies} onOpenGuardrail={handleOpenGuardrail} initialFilterDiscrepancyOnly={filterParams.key === 'discrepancy'} />
          )}

          {visibleWorkstation === 'system' && <SystemControlWorkstation config={systemConfig} onUpdateConfig={setSystemConfig} onOpenGuardrail={handleOpenGuardrail} />}
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
