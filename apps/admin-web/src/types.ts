export type WorkstationId = 'cockpit' | 'product' | 'order' | 'enterprise' | 'mall' | 'voucher' | 'supplier' | 'finance' | 'membership' | 'qualification' | 'system';

export interface WorkstationMeta {
  id: WorkstationId;
  name: string;
  badgeCount: number;
  badgeColor?: 'red' | 'amber' | 'blue';
  icon: string;
}

/** Presentation-only profile resolved from the server-authorized role. */
export interface AdminProfile {
  username: string;
  displayName: string;
  role: string;
  permissionTags: string[];
}

// Product Status Lifecycle
export type ProductStatus = '草稿' | '已导入' | '待补全' | '待分类审核' | '待发布审核' | '已发布' | '已下架';

export interface ProductSKU {
  id: string;
  skuCode: string;
  specName: string; // e.g. "黑色 / 256G"
  costPrice: number;
  mallPrice: number;
  enterprisePrice: number;
  stock: number;
}

export interface ProductChecklist {
  category: boolean;
  price: boolean;
  stock: boolean;
  agreement: boolean;
  images: boolean;
  visibility: boolean;
}

export interface ProductVersionDiff {
  version: string;
  updatedAt: string;
  operator: string;
  reason: string;
  fieldChanges: {
    field: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
  }[];
}

export interface Product {
  id: string;
  spuCode: string;
  title: string;
  brand: string;
  supplierId: string;
  supplierName: string;
  categoryL1?: string;
  categoryL2?: string;
  categoryL3?: string;
  supplierCategory?: string;
  costPrice: number;
  mallPrice: number;
  enterprisePrice: number;
  stock: number;
  status: ProductStatus;
  riskLevel: '高' | '中' | '低';
  missingFields: string[];
  reviewer: string;
  visibleEnterprises: string[]; // ["ALL"] or array of enterprise IDs
  mainImage: string;
  secondaryImages: string[];
  skus: ProductSKU[];
  checklist: ProductChecklist;
  aiSuggestion?: {
    categoryL1: string;
    categoryL2: string;
    categoryL3: string;
    confidence: number;
    reasoning: string;
    accepted?: boolean;
    needsHumanReview?: boolean;
  };
  versions: ProductVersionDiff[];
}

// Order Fulfillment Types
export type OrderStatus = '待付款' | '库存预占' | '已支付' | '待发货' | '已发货' | '已签收' | '退款申请中' | '已退款' | '异常挂起';

export interface TimelineEvent {
  id: string;
  nodeName: string; // e.g. "创建", "库存预占", "支付", "供应商接单", "发货", "签收", "售后", "退款"
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'pending';
  operator: string;
  remark: string;
}

export interface RetryLog {
  attempt: number;
  timestamp: string;
  targetService: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  httpCode?: number;
  message: string;
}

export interface Order {
  id: string;
  /** Human-readable business identifier. Keep the database id for API mutations. */
  orderNo: string;
  parentOrderId?: string;
  enterpriseId: string;
  enterpriseName: string;
  employeeId: string;
  employeeName: string;
  employeeDept: string;
  productId: string;
  productTitle: string;
  productImage: string;
  specName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  corporateBudgetPaid: number;
  employeeSelfPaid: number;
  status: OrderStatus;
  isProblematic: boolean;
  problemType?: 'STOCK_CONFLICT' | 'SLA_TIMEOUT' | 'REFUND_DISPUTE' | 'PRICE_MISMATCH';
  problemSummary?: string;
  slaDeadline: string;
  createdAt: string;
  shippingAddress: string;
  timeline: TimelineEvent[];
  retryLogs: RetryLog[];
  benefitsCard: {
    welfarePlanName: string;
    quotaUsed: number;
    remainingQuota: number;
  };
  supplierId: string;
  supplierName: string;
}

// Enterprise Welfare Types
export interface WelfarePlan {
  id: string;
  name: string;
  budgetPool: number;
  spentAmount: number;
  cycle: '按月' | '按季' | '年度' | '节日专享';
  balanceSource: '企业公户预付' | '月度专项拨款' | 'HR福利基金';
  allowedCategoryL1s: string[];
  status: '进行中' | '已预警' | '已终止';
}

export interface DeptBudget {
  deptId: string;
  deptName: string;
  employeeCount: number;
  budgetAmount: number;
  spentAmount: number;
  status: 'NORMAL' | 'WARNING' | 'EXCEEDED';
}

export interface Enterprise {
  id: string;
  name: string;
  code: string;
  industry: string;
  contactPerson: string;
  contactPhone: string;
  employeeCount: number;
  status: '正常' | '已预警' | '解约中';
  exclusiveDiscountRate: number; // e.g. 0.88 for 88折
  welfarePlans: WelfarePlan[];
  deptBudgets: DeptBudget[];
  hrSyncInfo: {
    lastSyncTime: string;
    syncStatus: 'SUCCESS' | 'WARNING' | 'FAILED';
    syncedDeptsCount: number;
    syncedEmployeesCount: number;
  };
}

// Supplier Collaboration Types
export interface Supplier {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  contactPhone?: string;
  phone: string;
  qualityScore: number; // 0-100
  stockLatencyRate: number; // %
  fulfillmentSlaRate: number; // %
  overallRating: 'S级' | 'A级' | 'B级' | 'C级风险';
  pendingSettlementAmount: number;
  status: '合作中' | '暂停发货' | '审核中';
  riskGrade: 'GREEN' | 'YELLOW' | 'RED';
  agreementExpireDate: string;
  depositBalance: number;
  stockMode: 'API 实时扣减' | '挂单预留' | '预付按量分配';
  settlementStatus: 'SETTLED' | 'PENDING' | 'DISPUTE';
  categoryScope: string[];
  slaScore: number;
  slaMetrics: {
    avgDispatchHours: number;
    refundApprovalHours: number;
    stockoutRate: number;
    qualityReturnRate: number;
  };
  auditLogs: {
    id: string;
    operator: string;
    action: string;
    timestamp: string;
    reason: string;
  }[];
}

export interface SettlementStatement {
  id: string;
  statementNo: string;
  supplierId: string;
  supplierName: string;
  period: string; // e.g. "2026-07"
  totalOrdersCount: number;
  totalAmount: number;
  platformCommission: number;
  netPayable: number;
  status: '待确认' | '已确认' | '已支付' | '有争议';
  discrepancyReason?: string;
  createdAt: string;
}

// Financial Reconciliation Types
export interface FinanceDiscrepancyRow {
  id: string;
  orderId: string;
  reconcileDate: string;
  entityName: string;
  mallRecordAmount: number;
  thirdPartyAmount: number;
  diffAmount: number;
  diffType: '退款未回发' | '通道手续费偏差' | '企业公户扣减延迟' | '重复支付差异';
  status: 'UNRESOLVED' | 'RESOLVED';
  note?: string;
}

export interface ReconciliationItem {
  id: string;
  orderId: string;
  orderTime: string;
  enterpriseName: string;
  orderLedgerAmount: number;
  paymentLedgerAmount: number;
  accountLedgerAmount: number;
  varianceAmount: number; // orderLedgerAmount - paymentLedgerAmount
  discrepancyType: '匹配一致' | '单边账' | '金额偏离' | '支付渠道延迟';
  status: '正常' | '待处理' | '已生成Case' | '已平账';
  caseId?: string;
}

// System Config Types
export interface SystemConfig {
  refundSlaHours: number;
  stockoutPenaltyRate: number;
  budgetWarningThreshold: number;
  geminiCopilotEnabled: boolean;
  aiModelAlias: string;
  auditLogs: {
    id: string;
    operator: string;
    timestamp: string;
    parameterName: string;
    beforeValue: string;
    afterValue: string;
    reason: string;
  }[];
}

// Global Case Center Types
export type CasePriority = 'P0-紧急' | 'P1-高' | 'P2-中' | 'P3-低';
export type CaseStatus = '发现' | '分级' | '指派' | '处理' | '验证' | '关闭' | '复盘';

export interface CaseItem {
  id: string;
  caseNo: string;
  title: string;
  sourceWorkstation: WorkstationId;
  priority: CasePriority;
  status: CaseStatus;
  assignee: string;
  affectedAmount: number;
  affectedUsers: number;
  createdAt: string;
  slaMinutesRemaining: number;
  rootCause: string;
  relatedObjectId?: string;
  actionLogs: {
    timestamp: string;
    operator: string;
    action: string;
    remark: string;
  }[];
}

// Global Audit Log
export interface AuditLog {
  id: string;
  timestamp: string;
  operator: string;
  role: string;
  actionType: '退款' | '改价' | '预算调整' | '商品发布' | '分类修改' | '权限变更' | '强制关单' | '供应商重试';
  targetEntity: string;
  entityId: string;
  beforeValue: string;
  afterValue: string;
  reason: string;
  evidence: string;
}

// Guardrail Modal Options
export interface GuardrailActionOptions {
  title: string;
  actionType: string;
  targetEntityName: string;
  entityId: string;
  impactAmount?: number;
  impactUsers?: number;
  beforeValue?: string;
  afterValue?: string;
  evidencePlaceholder?: string;
  onConfirm: (reason: string, evidence: string) => void;
}
