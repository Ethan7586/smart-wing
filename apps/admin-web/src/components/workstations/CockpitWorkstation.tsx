import React, { useMemo } from 'react';
import { AlertCircle, ArrowRight, BadgeDollarSign, Boxes, CheckCircle2, ClipboardCheck, FileText, Package, ShoppingBag, Truck, UsersRound } from 'lucide-react';
import { Enterprise, Order, Product, WorkstationId } from '../../types';
import type { LiveOperationsSummary, SalesOverview } from '../../services/catalog';

interface CockpitWorkstationProps {
  orders: Order[];
  products: Product[];
  enterprises: Enterprise[];
  liveOperations: LiveOperationsSummary | null;
  onNavigateToWorkstation: (wsId: WorkstationId, filterKey?: string, filterValue?: string) => void;
  language?: 'zh' | 'en';
}

type PriorityItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  severity: 'urgent' | 'attention' | 'normal';
  actionLabel: string;
  action: () => void;
};

const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
const formatCurrency = (value: number) => `¥${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)}`;

export const CockpitWorkstation: React.FC<CockpitWorkstationProps> = ({ orders, products, enterprises, liveOperations, onNavigateToWorkstation, language = 'zh' }) => {
  const isEn = language === 'en';
  const sales = useMemo(() => liveOperations?.sales ?? (liveOperations ? null : deriveDemoSalesOverview(orders, products)), [liveOperations, orders, products]);

  const situation = useMemo(() => {
    const count = (statuses: Order['status'][]) => orders.filter((order) => statuses.includes(order.status)).length;
    const problemOrders = orders.filter((order) => order.isProblematic);
    const toShip = count(['已支付', '待发货']);
    const inTransit = count(['已发货']);
    const completed = count(['已签收']);
    const afterSales = count(['退款申请中', '已退款']);
    const pendingClassification = products.filter((product) => product.status === '待分类审核').length;
    const enterpriseWarnings = enterprises.filter((enterprise) => enterprise.status === '已预警').length;
    const totalBudget = enterprises.reduce((sum, enterprise) => sum + enterprise.welfarePlans.reduce((planSum, plan) => planSum + plan.budgetPool, 0), 0);
    const spentBudget = enterprises.reduce((sum, enterprise) => sum + enterprise.welfarePlans.reduce((planSum, plan) => planSum + plan.spentAmount, 0), 0);

    return {
      afterSales,
      catalogCount: liveOperations?.catalogCount ?? products.length,
      completed,
      enterpriseWarnings,
      inTransit,
      orderCount: liveOperations?.orderCount ?? orders.length,
      pendingClassification,
      problemOrders,
      spentBudget,
      stock: liveOperations?.availableStock ?? products.reduce((sum, product) => sum + product.stock, 0),
      toShip,
      totalBudget,
    };
  }, [enterprises, liveOperations, orders, products]);

  const priorityItems = useMemo<PriorityItem[]>(() => {
    const items: PriorityItem[] = situation.problemOrders.slice(0, 3).map((order) => ({
      id: order.id,
      title: order.problemSummary || order.productTitle,
      description: `${order.enterpriseName} · ${formatCurrency(order.totalAmount)} · ${order.supplierName}`,
      meta: `${isEn ? 'Order' : '订单'} ${order.id} · ${isEn ? 'SLA' : '处理时限'} ${order.slaDeadline.slice(5, 16)}`,
      severity: order.problemType === 'STOCK_CONFLICT' || order.problemType === 'SLA_TIMEOUT' ? ('urgent' as const) : ('attention' as const),
      actionLabel: isEn ? 'Handle order' : '处理订单',
      action: () => onNavigateToWorkstation('order', 'problemType', order.problemType),
    }));

    if (situation.pendingClassification > 0) {
      items.push({
        id: 'catalog-review',
        title: isEn ? `${situation.pendingClassification} products are waiting for category review` : `${situation.pendingClassification} 个商品待分类审核`,
        description: isEn ? 'Products remain unavailable until category and release review are complete.' : '完成分类与发布审核后，商品才能在员工商城展示。',
        meta: isEn ? 'Catalogue governance' : '商品治理',
        severity: 'attention',
        actionLabel: isEn ? 'Review products' : '审核商品',
        action: () => onNavigateToWorkstation('product', 'status', '待分类审核'),
      });
    }

    if (situation.enterpriseWarnings > 0) {
      items.push({
        id: 'budget-warning',
        title: isEn ? `${situation.enterpriseWarnings} enterprise welfare budgets need review` : `${situation.enterpriseWarnings} 个企业福利预算需要复核`,
        description: isEn ? 'Review budget balance and plan scope before the next order cycle.' : '请确认预算余额与福利计划范围，避免影响后续下单。',
        meta: isEn ? 'Enterprise welfare' : '企业福利',
        severity: 'normal',
        actionLabel: isEn ? 'Review budgets' : '查看预算',
        action: () => onNavigateToWorkstation('enterprise'),
      });
    }

    return items;
  }, [isEn, onNavigateToWorkstation, situation.enterpriseWarnings, situation.pendingClassification, situation.problemOrders]);

  const taskCount = priorityItems.length;
  const budgetUsage = situation.totalBudget > 0 ? Math.round((situation.spentBudget / situation.totalBudget) * 100) : 0;

  return (
    <div className="min-h-full bg-[#f7f8fa] px-5 py-6 text-slate-700 lg:px-7 lg:py-7">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <section className="order-1 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{isEn ? 'Operations workspace' : '运营工作台'}</p>
            <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-slate-900">{isEn ? 'Operations overview' : '经营概览'}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              {isEn ? 'Read sales and product performance first, then enter the right workspace to resolve fulfilment and governance issues.' : '先看销售与商品表现，再处理履约、商品治理和配置事项。'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {liveOperations ? (isEn ? 'Data is scoped to your current authorisation' : '数据已按当前权限范围加载') : isEn ? 'Current workspace data' : '当前工作台数据'}
          </div>
        </section>

        <SalesPerformanceSection sales={sales} isDemo={liveOperations === null} isEn={isEn} />

        <section className="order-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{isEn ? 'Start with what impacts operations' : '先处理影响经营的事项'}</h2>
                <p className="mt-1 text-xs text-slate-500">{isEn ? 'Sorted by impact on transactions and employee experience.' : '按对交易、履约和员工体验的影响排序。'}</p>
              </div>
              <button type="button" onClick={() => onNavigateToWorkstation('order')} className="inline-flex items-center gap-1 self-start text-xs font-medium text-[#1769ff] hover:text-blue-800 sm:self-auto">
                {isEn ? 'Open order workspace' : '进入订单工作台'} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {priorityItems.length > 0 ? (
                priorityItems.slice(0, 4).map((item) => <PriorityRow key={item.id} item={item} />)
              ) : (
                <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="mt-3 text-sm font-medium text-slate-900">{isEn ? 'Nothing needs attention right now' : '当前没有需要优先处理的事项'}</p>
                  <p className="mt-1 text-xs text-slate-500">{isEn ? 'Continue to watch mall operations and order fulfilment.' : '可继续关注商城经营与订单履约情况。'}</p>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{isEn ? 'At a glance' : '当前概况'}</h2>
            <p className="mt-1 text-xs text-slate-500">{isEn ? 'A concise view of the current operating scope.' : '当前授权范围内需要关注的经营信号。'}</p>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
              <OverviewMetric label={isEn ? 'Priority actions' : '优先事项'} value={formatNumber(taskCount)} tone={taskCount > 0 ? 'amber' : 'green'} />
              <OverviewMetric label={isEn ? 'Orders to ship' : '待发货订单'} value={formatNumber(situation.toShip)} tone={situation.toShip > 0 ? 'blue' : 'default'} />
              <OverviewMetric label={isEn ? 'After-sales' : '售后处理中'} value={formatNumber(situation.afterSales)} tone={situation.afterSales > 0 ? 'red' : 'default'} />
              <OverviewMetric label={isEn ? 'Budget alerts' : '预算预警'} value={formatNumber(situation.enterpriseWarnings)} tone={situation.enterpriseWarnings > 0 ? 'amber' : 'default'} />
            </div>
            <button type="button" onClick={() => onNavigateToWorkstation('enterprise')} className="mt-5 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3.5 py-3 text-left transition hover:bg-slate-100">
              <span>
                <span className="block text-xs font-medium text-slate-800">{isEn ? 'Enterprise welfare budget' : '企业福利预算'}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{isEn ? `${budgetUsage}% of the configured budget has been used` : `已使用配置预算的 ${budgetUsage}%`}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          </aside>
        </section>

        <section className="order-3 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{isEn ? 'Order fulfilment' : '订单履约'}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {isEn
                    ? `${situation.orderCount - situation.completed} of ${situation.orderCount} orders are not yet closed.`
                    : `${formatNumber(situation.orderCount)} 笔订单中，${formatNumber(situation.orderCount - situation.completed)} 笔尚未闭环。`}
                </p>
              </div>
              <button type="button" onClick={() => onNavigateToWorkstation('order')} className="text-xs font-medium text-[#1769ff] hover:text-blue-800">
                {isEn ? 'All orders' : '全部订单'}
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StageMetric icon={BadgeDollarSign} label={isEn ? 'Pending payment' : '待付款'} value={orders.filter((order) => ['待付款', '库存预占'].includes(order.status)).length} />
              <StageMetric icon={Package} label={isEn ? 'To ship' : '待发货'} value={situation.toShip} active />
              <StageMetric icon={Truck} label={isEn ? 'In transit' : '运输中'} value={situation.inTransit} />
              <StageMetric icon={CheckCircle2} label={isEn ? 'Completed' : '已签收'} value={situation.completed} />
            </div>
            <OrderVolumeChart orders={orders} isEn={isEn} />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{isEn ? 'Enterprise mall status' : '企业商城经营状态'}</h2>
                <p className="mt-1 text-xs text-slate-500">{isEn ? `${situation.enterpriseWarnings} enterprise welfare budget requires review.` : `${formatNumber(situation.enterpriseWarnings)} 个企业福利预算需要复核。`}</p>
              </div>
              <button type="button" onClick={() => onNavigateToWorkstation('enterprise')} className="self-start text-xs font-medium text-[#1769ff] hover:text-blue-800 sm:self-auto">
                {isEn ? 'All enterprises' : '全部企业'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">{isEn ? 'Enterprise' : '企业'}</th>
                    <th className="px-4 py-2.5 text-right">{isEn ? 'Employees' : '员工数'}</th>
                    <th className="px-4 py-2.5">{isEn ? 'Budget usage' : '预算使用'}</th>
                    <th className="px-5 py-2.5">{isEn ? 'Status' : '状态'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {enterprises.slice(0, 4).map((enterprise) => (
                    <EnterpriseRow key={enterprise.id} enterprise={enterprise} isEn={isEn} onClick={() => onNavigateToWorkstation('enterprise', 'search', enterprise.name)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="order-4 grid gap-5 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{isEn ? 'Order status mix' : '订单状态分布'}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {isEn ? `${situation.orderCount - situation.completed} orders still need fulfilment or after-sales follow-up.` : `${formatNumber(situation.orderCount - situation.completed)} 笔订单仍需履约或售后跟进。`}
                </p>
              </div>
              <span className="text-xs text-slate-400">{isEn ? 'Current scope' : '当前范围'}</span>
            </div>
            <OrderStatusDonut orders={orders} isEn={isEn} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{isEn ? 'Catalogue readiness' : '商品目录可售性'}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {isEn
                    ? `${situation.pendingClassification} of ${situation.catalogCount} products are not yet available to employees.`
                    : `${formatNumber(situation.catalogCount)} 个商品中，有 ${formatNumber(situation.pendingClassification)} 个暂未向员工展示。`}
                </p>
              </div>
              <button type="button" onClick={() => onNavigateToWorkstation('product', 'status', '待分类审核')} className="text-xs font-medium text-[#1769ff] hover:text-blue-800">
                {isEn ? 'Review catalogue' : '查看目录'}
              </button>
            </div>
            <CatalogueCompositionChart products={products} isEn={isEn} />
          </div>
        </section>

        <section className="order-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{isEn ? 'Catalogue health' : '商品与库存'}</h2>
                <p className="mt-1 text-xs text-slate-500">{isEn ? 'Keep the catalogue ready for employees to browse and order.' : '确保商品目录满足员工浏览和下单条件。'}</p>
              </div>
              <button type="button" onClick={() => onNavigateToWorkstation('product', 'status', '待分类审核')} className="text-xs font-medium text-[#1769ff] hover:text-blue-800">
                {isEn ? 'Manage products' : '商品治理'}
              </button>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100">
              <SimpleStat icon={Boxes} label={isEn ? 'Products' : '商品'} value={formatNumber(situation.catalogCount)} />
              <SimpleStat icon={ClipboardCheck} label={isEn ? 'Awaiting review' : '待审核'} value={formatNumber(situation.pendingClassification)} emphasis={situation.pendingClassification > 0} />
              <SimpleStat icon={ShoppingBag} label={isEn ? 'Available stock' : '可用库存'} value={formatNumber(situation.stock)} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{isEn ? 'Common operations' : '常用操作'}</h2>
              <p className="mt-1 text-xs text-slate-500">{isEn ? 'Go directly to the workflows used most often by operations teams.' : '直接进入运营团队高频使用的工作流。'}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QuickAction icon={Package} label={isEn ? 'Product review' : '商品审核'} onClick={() => onNavigateToWorkstation('product', 'status', '待分类审核')} />
              <QuickAction icon={Truck} label={isEn ? 'Order handling' : '订单处理'} onClick={() => onNavigateToWorkstation('order')} />
              <QuickAction icon={UsersRound} label={isEn ? 'Enterprise budgets' : '企业预算'} onClick={() => onNavigateToWorkstation('enterprise')} />
              <QuickAction icon={FileText} label={isEn ? 'Reconciliation' : '财务对账'} onClick={() => onNavigateToWorkstation('finance', 'discrepancy', 'true')} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

function PriorityRow({ item }: { item: PriorityItem }) {
  const style =
    item.severity === 'urgent'
      ? { icon: 'bg-rose-50 text-rose-600', label: '紧急', labelClass: 'bg-rose-50 text-rose-700' }
      : item.severity === 'attention'
        ? { icon: 'bg-amber-50 text-amber-600', label: '待关注', labelClass: 'bg-amber-50 text-amber-700' }
        : { icon: 'bg-blue-50 text-blue-600', label: '需复核', labelClass: 'bg-blue-50 text-blue-700' };
  return (
    <div className="flex gap-3 px-5 py-4">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.icon}`}>
        <AlertCircle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-sm font-medium leading-5 text-slate-900">{item.title}</h3>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.labelClass}`}>{style.label}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
        <p className="mt-1 text-[11px] text-slate-400">{item.meta}</p>
      </div>
      <button type="button" onClick={item.action} className="shrink-0 self-center rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#1769ff]">
        {item.actionLabel}
      </button>
    </div>
  );
}

function OverviewMetric({ label, value, tone }: { label: string; value: string; tone: 'amber' | 'blue' | 'red' | 'green' | 'default' }) {
  const valueClass = tone === 'amber' ? 'text-amber-600' : tone === 'blue' ? 'text-[#1769ff]' : tone === 'red' ? 'text-rose-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

function SalesPerformanceSection({ sales, isDemo, isEn }: { sales: SalesOverview | null; isDemo: boolean; isEn: boolean }) {
  return (
    <section className="order-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{isEn ? 'Sales performance' : '销售表现'}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{isEn ? 'See whether the mall is selling, what is selling, and where demand is concentrated.' : '一眼看出有没有成交、卖得最好的商品，以及需求集中在哪些品类。'}</p>
        </div>
        <span className={`self-start rounded-full px-2.5 py-1 text-[11px] font-medium ${isDemo ? 'bg-amber-50 text-amber-700' : sales ? 'bg-blue-50 text-[#1769ff]' : 'bg-slate-100 text-slate-500'}`}>
          {isDemo ? (isEn ? 'Demo data' : '演示数据') : sales ? (isEn ? 'Current authorised scope' : '当前授权范围') : isEn ? 'Order permission required' : '需订单查看权限'}
        </span>
      </div>

      {sales ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SalesMetric label={isEn ? 'Cumulative sales' : '累计销售额'} value={formatCents(sales.cumulativeSalesCents)} hint={isEn ? 'Paid amount less completed refunds' : '已扣除成功退款'} />
            <SalesMetric
              label={isEn ? 'Paid in last 30 days' : '近30日支付额'}
              value={formatCents(sales.periodSalesCents)}
              hint={isEn ? `${formatNumber(sales.periodPaidOrderCount)} paid orders` : `${formatNumber(sales.periodPaidOrderCount)} 笔支付订单`}
              accent
            />
            <SalesMetric label={isEn ? 'Effective orders' : '有效订单'} value={formatNumber(sales.paidOrderCount)} hint={isEn ? 'Orders with a remaining paid amount' : '仍有实收金额的订单'} />
            <SalesMetric
              label={isEn ? 'Average order value' : '客单价'}
              value={formatCents(sales.averageOrderValueCents)}
              hint={isEn ? `Completed refunds: ${formatCents(sales.refundedCents)}` : `累计成功退款 ${formatCents(sales.refundedCents)}`}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <div className="border-t border-slate-100 pt-5 xl:border-r xl:pr-6">
              <SalesTrendChart series={sales.trend} isEn={isEn} />
            </div>
            <div className="border-t border-slate-100 pt-5">
              <SalesCategoryDonut categories={sales.categories} isEn={isEn} />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <TopProducts products={sales.topProducts} activeProductCount={sales.activeProductCount} unsoldProductCount={sales.unsoldActiveProductCount} isEn={isEn} />
          </div>
        </>
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center">
          <ShoppingBag className="h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-800">{isEn ? 'Sales facts are not available for this session' : '当前会话没有可展示的销售数据'}</p>
          <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">
            {isEn ? 'Grant order read access to load cumulative sales, payment trend and product performance for the authorised scope.' : '授予订单查看权限后，系统才会加载当前授权范围内的累计销售额、支付趋势和商品表现。'}
          </p>
        </div>
      )}
    </section>
  );
}

function SalesMetric({ label, value, hint, accent = false }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${accent ? 'text-[#1769ff]' : 'text-slate-900'}`}>{value}</p>
      <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{hint}</p>
    </div>
  );
}

function SalesTrendChart({ series, isEn }: { series: SalesOverview['trend']; isEn: boolean }) {
  const maxValue = Math.max(...series.map((point) => point.salesCents), 1);
  const total = series.reduce((sum, point) => sum + point.salesCents, 0);
  const peak = series.reduce((highest, point) => (point.salesCents > highest.salesCents ? point : highest), series[0]);

  return (
    <figure aria-label={isEn ? 'Sales payment amount over the last seven days' : '最近七天支付额趋势'}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{isEn ? 'Payment amount trend' : '支付额趋势'}</h3>
          <p className="mt-1 text-xs text-slate-500">{isEn ? 'By payment date, last 7 days' : '按支付日期统计，最近 7 天'}</p>
        </div>
        <span className="text-xs text-slate-400">{isEn ? 'Payment amount' : '支付金额'}</span>
      </div>
      {series.length > 0 ? (
        <>
          <div className="mt-5 flex h-40 items-end gap-2 border-b border-slate-100 sm:gap-3">
            {series.map((point) => (
              <div key={point.date} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="mb-2 text-center text-[11px] font-medium text-slate-700">{point.salesCents ? compactCents(point.salesCents) : ''}</div>
                <div
                  className="mx-auto w-full max-w-12 rounded-t bg-[#1769ff]"
                  style={{ height: `${point.salesCents ? Math.max(7, Math.round((point.salesCents / maxValue) * 100)) : 2}%` }}
                  aria-label={`${point.date}: ${formatCents(point.salesCents)}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2 text-center text-[11px] text-slate-400 sm:gap-3">
            {series.map((point) => (
              <span key={point.date}>{shortDate(point.date)}</span>
            ))}
          </div>
          <figcaption className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <strong className="text-sm font-semibold text-slate-900">{isEn ? `${formatCents(total)} in 7 days` : `近 7 天支付 ${formatCents(total)}`}</strong>
            <span className="text-xs text-slate-500">
              {peak?.salesCents
                ? isEn
                  ? `${shortDate(peak.date)} was the peak day at ${formatCents(peak.salesCents)}.`
                  : `${shortDate(peak.date)} 是高点，当日支付 ${formatCents(peak.salesCents)}。`
                : isEn
                  ? 'No paid orders in the displayed period.'
                  : '图示周期内暂无支付订单。'}
            </span>
          </figcaption>
        </>
      ) : (
        <div className="mt-4">
          <EmptyChartMessage isEn={isEn} />
        </div>
      )}
    </figure>
  );
}

function SalesCategoryDonut({ categories, isEn }: { categories: SalesOverview['categories']; isEn: boolean }) {
  const colors = ['#1769ff', '#5bb9f4', '#7c6ee6', '#f2a54a', '#94a3b8'];
  const total = categories.reduce((sum, category) => sum + category.salesCents, 0);
  let cursor = 0;
  const gradient = categories
    .map((category, index) => {
      const start = total > 0 ? (cursor / total) * 100 : 0;
      cursor += category.salesCents;
      const end = total > 0 ? (cursor / total) * 100 : 100;
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    })
    .join(', ');
  const leading = categories[0];

  return (
    <figure aria-label={isEn ? 'Sales amount by category' : '按品类的支付金额占比'}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{isEn ? 'Category mix' : '品类销售占比'}</h3>
        <p className="mt-1 text-xs text-slate-500">{isEn ? 'By current product category and paid amount of orders with a remaining paid balance' : '按当前商品品类归集，统计仍有实收金额订单中的商品支付额'}</p>
      </div>
      {categories.length > 0 ? (
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
            <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white">
              <strong className="text-lg font-semibold text-slate-900">{leading ? `${Math.round(leading.share * 100)}%` : '—'}</strong>
              <span className="mt-0.5 text-[10px] text-slate-500">{isEn ? 'Top category' : '第一品类'}</span>
            </div>
          </div>
          <figcaption className="grid w-full max-w-64 gap-2.5">
            {categories.slice(0, 5).map((category, index) => (
              <div key={category.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index % colors.length] }} />
                <span className="min-w-0 flex-1 truncate text-slate-600">{category.name}</span>
                <span className="tabular-nums text-slate-400">{Math.round(category.share * 100)}%</span>
                <span className="w-14 text-right font-medium tabular-nums text-slate-800">{formatCents(category.salesCents)}</span>
              </div>
            ))}
          </figcaption>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyChartMessage isEn={isEn} />
        </div>
      )}
    </figure>
  );
}

function TopProducts({ products, activeProductCount, unsoldProductCount, isEn }: { products: SalesOverview['topProducts']; activeProductCount: number; unsoldProductCount: number; isEn: boolean }) {
  return (
    <section aria-label={isEn ? 'Top selling products' : '热销商品排行'}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{isEn ? 'Top selling products' : '热销商品 TOP 5'}</h3>
          <p className="mt-1 text-xs text-slate-500">{isEn ? 'Ranked by paid product amount across the current authorisation scope.' : '按当前授权范围内的商品支付额排序。'}</p>
        </div>
        <p className={`text-xs ${unsoldProductCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
          {isEn ? `${unsoldProductCount} of ${activeProductCount} active products have no sales record yet` : `${formatNumber(activeProductCount)} 款在售商品中，${formatNumber(unsoldProductCount)} 款暂未成交`}
        </p>
      </div>
      {products.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-y border-slate-100 bg-slate-50 text-[11px] font-medium text-slate-500">
              <tr>
                <th className="w-12 px-3 py-2.5">{isEn ? 'Rank' : '排名'}</th>
                <th className="px-3 py-2.5">{isEn ? 'Product' : '商品'}</th>
                <th className="px-3 py-2.5 text-right">{isEn ? 'Sales amount' : '支付额'}</th>
                <th className="px-3 py-2.5 text-right">{isEn ? 'Units' : '销量'}</th>
                <th className="px-3 py-2.5 text-right">{isEn ? 'Orders' : '订单数'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {products.map((product, index) => (
                <tr key={product.productId}>
                  <td className="px-3 py-3 font-medium text-slate-500">{index + 1}</td>
                  <td className="max-w-[360px] px-3 py-3 font-medium text-slate-800">
                    <span className="block truncate">{product.name}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-900">{formatCents(product.salesCents)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatNumber(product.quantity)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatNumber(product.orderCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyChartMessage isEn={isEn} />
        </div>
      )}
    </section>
  );
}

function EmptyChartMessage({ isEn }: { isEn: boolean }) {
  return <div className="flex min-h-36 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-xs text-slate-500">{isEn ? 'No paid order data in this scope yet.' : '当前范围内暂时没有可用于分析的支付订单。'}</div>;
}

function StageMetric({ icon: Icon, label, value, active = false }: { icon: React.ElementType; label: string; value: number; active?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${active ? 'border-blue-100 bg-blue-50/60' : 'border-slate-100 bg-white'}`}>
      <Icon className={`h-4 w-4 ${active ? 'text-[#1769ff]' : 'text-slate-400'}`} />
      <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{formatNumber(value)}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function orderDateKey(order: Order): string {
  return order.createdAtIso?.match(/^(\d{4}-\d{2}-\d{2})T/)?.[1] ?? '';
}

export function buildOrderVolumeSeries(orders: Order[]) {
  const dateKeys = orders.map(orderDateKey).filter(Boolean).sort();
  const latest = dateKeys.at(-1) || new Date().toISOString().slice(0, 10);
  const [year, month, day] = latest.split('-').map(Number);
  const latestDate = new Date(Date.UTC(year, month - 1, day));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(latestDate);
    date.setUTCDate(latestDate.getUTCDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`, value: orders.filter((order) => orderDateKey(order) === key).length };
  });
}

function OrderVolumeChart({ orders, isEn }: { orders: Order[]; isEn: boolean }) {
  const series = useMemo(() => buildOrderVolumeSeries(orders), [orders]);
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const peak = series.reduce((highest, item) => (item.value > highest.value ? item : highest), series[0]);

  return (
    <figure className="mt-6" aria-label={isEn ? 'Order volume over the last seven days' : '最近七天订单量'}>
      <div className="flex h-36 items-end gap-2 border-b border-slate-100 pb-0 sm:gap-3">
        {series.map((item) => (
          <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="mb-2 text-center text-xs font-medium text-slate-700">{item.value || ''}</div>
            <div className="mx-auto w-full max-w-10 rounded-t bg-[#1769ff] transition-[height]" style={{ height: `${item.value ? Math.max(8, Math.round((item.value / maxValue) * 100)) : 2}%` }} aria-label={`${item.label}: ${item.value}`} />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 text-center text-[11px] text-slate-400 sm:gap-3">
        {series.map((item) => (
          <span key={item.key}>{item.label}</span>
        ))}
      </div>
      <figcaption className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="text-sm font-semibold text-slate-900">{isEn ? `${total} new orders in 7 days` : `近 7 天新增 ${formatNumber(total)} 笔订单`}</strong>
        <span className="text-xs text-slate-500">
          {peak?.value ? (isEn ? `${peak.label} was the peak day with ${peak.value} orders.` : `${peak.label} 为高点，当日 ${peak.value} 笔。`) : isEn ? 'No orders in the displayed period.' : '图示周期内暂无订单。'}
        </span>
      </figcaption>
    </figure>
  );
}

function OrderStatusDonut({ orders, isEn }: { orders: Order[]; isEn: boolean }) {
  const slices = useMemo(() => {
    const groups = [
      { label: isEn ? 'To ship' : '待发货', statuses: ['待付款', '库存预占', '已支付', '待发货'] as Order['status'][], color: '#1769ff' },
      { label: isEn ? 'In transit' : '运输中', statuses: ['已发货'] as Order['status'][], color: '#5bb9f4' },
      { label: isEn ? 'Completed' : '已签收', statuses: ['已签收'] as Order['status'][], color: '#28a879' },
      { label: isEn ? 'After-sales' : '售后', statuses: ['退款申请中', '已退款'] as Order['status'][], color: '#f2a54a' },
      { label: isEn ? 'Exceptions' : '异常', statuses: ['异常挂起'] as Order['status'][], color: '#e85b76' },
    ];
    return groups.map((group) => ({ ...group, value: orders.filter((order) => group.statuses.includes(order.status)).length })).filter((group) => group.value > 0);
  }, [isEn, orders]);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let cursor = 0;
  const gradient = slices
    .map((slice) => {
      const start = total > 0 ? (cursor / total) * 100 : 0;
      cursor += slice.value;
      const end = total > 0 ? (cursor / total) * 100 : 100;
      return `${slice.color} ${start}% ${end}%`;
    })
    .join(', ');
  const openCount = orders.filter((order) => !['已签收', '已退款'].includes(order.status)).length;

  return (
    <figure className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-center" aria-label={isEn ? 'Order status distribution' : '订单状态分布'}>
      <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: total > 0 ? `conic-gradient(${gradient})` : '#e2e8f0' }}>
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white">
          <strong className="text-2xl font-semibold tracking-tight text-slate-900">{formatNumber(openCount)}</strong>
          <span className="mt-0.5 text-[11px] text-slate-500">{isEn ? 'Need follow-up' : '需跟进'}</span>
        </div>
      </div>
      <figcaption className="grid w-full max-w-60 gap-2.5">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.color }} />
            <span className="flex-1 text-slate-600">{slice.label}</span>
            <span className="text-slate-400">{total > 0 ? Math.round((slice.value / total) * 100) : 0}%</span>
            <span className="w-5 text-right font-medium tabular-nums text-slate-800">{slice.value}</span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

function CatalogueCompositionChart({ products, isEn }: { products: Product[]; isEn: boolean }) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    const pendingLabel = isEn ? 'Awaiting review' : '待分类审核';
    products.forEach((product) => {
      const category = product.status === '待分类审核' ? pendingLabel : product.categoryL1 || (isEn ? 'Other' : '其他');
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([label, value], index) => ({ label, value, color: label === pendingLabel ? '#f2a54a' : index === 1 ? '#1769ff' : index === 2 ? '#5bb9f4' : '#94a3b8' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [isEn, products]);
  const total = products.length || 1;

  return (
    <figure className="mt-5" aria-label={isEn ? 'Catalogue composition by category' : '商品目录按品类构成'}>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {categories.map((category) => (
          <span key={category.label} className="inline-block h-full" style={{ width: `${(category.value / total) * 100}%`, background: category.color }} />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {categories.map((category) => (
          <div key={category.label} className="flex items-center gap-3 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color }} />
            <span className="flex-1 text-slate-600">{category.label}</span>
            <span className="tabular-nums text-slate-400">{Math.round((category.value / total) * 100)}%</span>
            <span className="w-6 text-right font-medium tabular-nums text-slate-800">{category.value}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

function EnterpriseRow({ enterprise, isEn, onClick }: { enterprise: Enterprise; isEn: boolean; onClick: () => void }) {
  const budgetPool = enterprise.welfarePlans.reduce((sum, plan) => sum + plan.budgetPool, 0);
  const spentAmount = enterprise.welfarePlans.reduce((sum, plan) => sum + plan.spentAmount, 0);
  const usage = budgetPool > 0 ? Math.min(100, Math.round((spentAmount / budgetPool) * 100)) : 0;
  const attention = enterprise.status === '已预警';
  return (
    <tr className="cursor-pointer transition hover:bg-slate-50" onClick={onClick}>
      <td className="px-5 py-3.5">
        <p className="font-medium text-slate-800">{enterprise.name}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{enterprise.industry}</p>
      </td>
      <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-700">{formatNumber(enterprise.employeeCount)}</td>
      <td className="px-4 py-3.5">
        <div className="flex min-w-28 items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${attention ? 'bg-amber-500' : 'bg-[#1769ff]'}`} style={{ width: `${usage}%` }} />
          </div>
          <span className="tabular-nums text-slate-600">{usage}%</span>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${attention ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{attention ? (isEn ? 'Review' : '需复核') : isEn ? 'Normal' : '正常'}</span>
      </td>
    </tr>
  );
}

function SimpleStat({ icon: Icon, label, value, emphasis = false }: { icon: React.ElementType; label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <Icon className={`h-4 w-4 ${emphasis ? 'text-amber-500' : 'text-slate-400'}`} />
      <p className={`mt-3 text-xl font-semibold tracking-tight ${emphasis ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group rounded-lg border border-slate-100 px-3 py-3 text-left transition hover:border-blue-100 hover:bg-blue-50/60">
      <Icon className="h-4 w-4 text-slate-400 transition group-hover:text-[#1769ff]" />
      <span className="mt-4 block text-xs font-medium text-slate-700 group-hover:text-[#1769ff]">{label}</span>
    </button>
  );
}

function formatCents(cents: number): string {
  return formatCurrency(cents / 100);
}

function compactCents(cents: number): string {
  const yuan = cents / 100;
  if (yuan >= 10_000) return `¥${(yuan / 10_000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`;
  return formatCurrency(yuan);
}

function shortDate(value: string): string {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${Number(match[2])}/${Number(match[3])}` : value;
}

/** Test-login mode intentionally uses fixture orders only to demonstrate the layout.
 * Production always consumes the server-side aggregate supplied in LiveOperationsSummary. */
export function deriveDemoSalesOverview(orders: Order[], products: Product[]): SalesOverview {
  const paidOrders = orders.filter((order) => !['待付款', '库存预占', '已退款'].includes(order.status));
  const orderDay = orderDateKey;
  const latestDay = paidOrders.map(orderDay).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10);
  const [latestYear, latestMonth, latestDate] = latestDay.split('-').map(Number);
  const reference = new Date(Date.UTC(latestYear, latestMonth - 1, latestDate));
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(reference);
    date.setUTCDate(reference.getUTCDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const matching = paidOrders.filter((order) => orderDay(order) === key);
    return { date: key, salesCents: matching.reduce((sum, order) => sum + order.totalCents, 0), orderCount: matching.length };
  });
  const productCatalogue = new Map(products.map((product) => [product.id, product]));
  const productSales = new Map<string, { productId: string; name: string; salesCents: number; quantity: number; orderCount: number }>();
  const categorySales = new Map<string, number>();
  paidOrders.forEach((order) => {
    const product = productCatalogue.get(order.productId);
    const key = order.productId || order.productTitle;
    const existing = productSales.get(key) ?? { productId: key, name: order.productTitle || '未命名商品', salesCents: 0, quantity: 0, orderCount: 0 };
    const salesCents = order.totalCents;
    existing.salesCents += salesCents;
    existing.quantity += order.quantity;
    existing.orderCount += 1;
    productSales.set(key, existing);
    const category = product?.categoryL1 || '未分类';
    categorySales.set(category, (categorySales.get(category) ?? 0) + salesCents);
  });
  const categoryTotal = [...categorySales.values()].reduce((sum, value) => sum + value, 0);
  const categories = [...categorySales.entries()]
    .map(([name, salesCents]) => ({ name, salesCents, share: categoryTotal > 0 ? Math.round((salesCents / categoryTotal) * 10_000) / 10_000 : 0 }))
    .sort((a, b) => b.salesCents - a.salesCents || a.name.localeCompare(b.name));
  const topProducts = [...productSales.values()].sort((a, b) => b.salesCents - a.salesCents || b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 5);
  const activeProducts = products.filter((product) => product.status === '已发布');
  const soldActiveProductCount = activeProducts.filter((product) => productSales.has(product.id)).length;
  const cumulativeSalesCents = paidOrders.reduce((sum, order) => sum + order.totalCents, 0);

  return {
    asOf: latestDay,
    cumulativeSalesCents,
    paidOrderCount: paidOrders.length,
    averageOrderValueCents: paidOrders.length > 0 ? Math.round(cumulativeSalesCents / paidOrders.length) : 0,
    periodSalesCents: cumulativeSalesCents,
    periodPaidOrderCount: paidOrders.length,
    refundedCents: orders.filter((order) => order.status === '已退款').reduce((sum, order) => sum + order.totalCents, 0),
    activeProductCount: activeProducts.length,
    soldProductCount: soldActiveProductCount,
    unsoldActiveProductCount: Math.max(activeProducts.length - soldActiveProductCount, 0),
    trend,
    categories,
    topProducts,
  };
}
