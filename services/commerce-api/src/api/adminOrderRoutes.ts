import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { AFTER_SALE_STATUSES, ORDER_STATUSES, parseAdminOrderQuery, type AdminOrderQuery } from './adminOrderQuery';
import { apiError, json, methodNotAllowed } from './http';
import { authorizationEvidence, authorizationScope } from './routerSupport';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';

type Page = { items: Array<Record<string, unknown>>; total: number; limit: number; offset: number };
type ExportKind = 'orders' | 'after_sales';

export async function handleAdminOrderPage(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  return handlePage(request, env, authorization, requestId, 'orders');
}

export async function handleAdminAfterSalePage(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  return handlePage(request, env, authorization, requestId, 'after_sales');
}

export async function handleAdminOrderExport(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  return handleExport(request, env, authorization, requestId, 'orders');
}

export async function handleAdminAfterSaleExport(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  return handleExport(request, env, authorization, requestId, 'after_sales');
}

async function handlePage(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string, kind: ExportKind): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const decision = authorize(authorization, PERMISSIONS.orderRead);
  if (!decision.allowed) return apiError(403, 'FORBIDDEN', '没有查看订单管理数据的权限', requestId);
  const query = parseQuery(request, kind, requestId);
  if (query instanceof Response) return query;
  const page = await callRpc<Page>(env, kind === 'orders' ? 'api_admin_order_page' : 'api_admin_after_sale_page', rpcParams(authorization, query));
  return json({ ...page, requestId });
}

async function handleExport(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string, kind: ExportKind): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const decision = authorize(authorization, PERMISSIONS.orderRead);
  if (!decision.allowed) return apiError(403, 'FORBIDDEN', '没有导出订单管理数据的权限', requestId);
  const query = parseQuery(request, kind, requestId);
  if (query instanceof Response) return query;
  const rows = await callRpc<Array<Record<string, unknown>>>(env, kind === 'orders' ? 'api_admin_order_export' : 'api_admin_after_sale_export', rpcParams(authorization, query));
  const rejectedForSize = rows.length > 5000;
  await callRpc<void>(env, 'api_record_order_export_audit', {
    p_tenant_id: authorization.tenantId,
    p_enterprise_id: authorization.enterpriseId,
    p_mall_id: authorization.mallId,
    p_operator_user_id: authorization.userId,
    p_export_type: kind,
    p_filters: { ...query, outcome: rejectedForSize ? 'rejected_too_large' : 'completed' },
    p_row_count: rows.length,
    p_request_id: requestId,
    p_membership_id: authorization.membership.id,
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  if (rejectedForSize) return apiError(413, 'EXPORT_TOO_LARGE', '导出结果超过 5000 行，请收窄筛选条件后重试', requestId);
  return new Response(`\ufeff${toCsv(kind, rows)}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${kind}-${dateStamp()}.csv"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cross-origin-resource-policy': 'same-site',
      'permissions-policy': 'camera=(), geolocation=(), microphone=()',
      'x-request-id': requestId,
    },
  });
}

function parseQuery(request: Request, kind: ExportKind, requestId: string): AdminOrderQuery | Response {
  const parsed = parseAdminOrderQuery(new URL(request.url), kind === 'orders' ? ORDER_STATUSES : AFTER_SALE_STATUSES);
  if (parsed.ok) return parsed.value;
  const message = parsed.code === 'INVALID_STATUS' ? '订单状态参数无效' : parsed.code === 'INVALID_DATE' ? '日期参数无效' : '查询参数无效';
  return apiError(422, parsed.code, message, requestId);
}

function rpcParams(authorization: AuthorizationContext, query: AdminOrderQuery) {
  const isAdministrative = authorization.membership.scopeBindings.some((binding) => binding.kind !== 'self');
  return {
    ...authorizationScope(authorization),
    p_user_id: isAdministrative ? null : authorization.userId,
    p_keyword: query.keyword,
    p_status: query.status,
    p_created_from: query.createdFrom,
    p_created_to: query.createdTo,
    p_sort: query.sort,
    p_limit: query.limit,
    p_offset: query.offset,
  };
}

export function toCsv(kind: ExportKind, rows: Array<Record<string, unknown>>): string {
  const columns =
    kind === 'orders'
      ? [
          ['订单号', 'orderNo'],
          ['商品', 'firstProductName'],
          ['商品种类（种）', 'lineCount'],
          ['数量', 'itemCount'],
          ['应付金额（元）', 'payableCents'],
          ['实付金额（元）', 'paidCents'],
          ['福利支付（元）', 'welfarePaidCents'],
          ['餐补支付（元）', 'mealPaidCents'],
          ['供应商', 'supplierNames'],
          ['订单状态', 'status'],
          ['下单时间', 'createdAt'],
        ]
      : [
          ['售后单号', 'afterSaleNo'],
          ['订单号', 'orderNo'],
          ['售后类型', 'type'],
          ['售后状态', 'status'],
          ['申请金额（元）', 'requestedAmountCents'],
          ['售后原因', 'reason'],
          ['申请时间', 'createdAt'],
        ];
  const header = columns.map(([label]) => quote(label)).join(',');
  const body = rows.map((row) => columns.map(([, key]) => quote(csvValue(row[key], key.endsWith('Cents')))).join(','));
  return [header, ...body].join('\r\n');
}

function csvValue(value: unknown, isCents: boolean): string {
  const text = Array.isArray(value) ? value.join('、') : value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return isCents && Number.isFinite(Number(value)) ? (Number(value) / 100).toFixed(2) : safe;
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}
