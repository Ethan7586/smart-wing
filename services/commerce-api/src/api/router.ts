import { handleAccountLedgers, handleAccounts, handleBootstrap } from './accountRoutes';
import { resolveAuthorizationContext } from './auth';
import { handleCart, handleDeleteCartItem } from './cartRoutes';
import { handleAddresses, handleDeleteAddress } from './addressRoutes';
import { apiError, json } from './http';
import { handleAfterSales, handleCreateAfterSale, handleCreateOrder, handleExecuteRefund, handleFinanceReconciliation, handleInternalPayment, handleOrders } from './orderRoutes';
import { handleHealth, handleLogin, handleLogout, handleProducts } from './publicRoutes';
import type { WorkerEnv } from './types';

const API_PREFIX = '/api/v1';
export async function routeApi(request: Request, env: WorkerEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/health' && !url.pathname.startsWith(`${API_PREFIX}/`)) {
    return null;
  }
  const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();

  try {
    if (url.pathname === '/api/health') return await handleHealth(request, env, requestId);
    if (url.pathname === `${API_PREFIX}/products`) {
      return await handleProducts(request, env, requestId);
    }
    if (url.pathname === `${API_PREFIX}/auth/login`) {
      return await handleLogin(request, env, requestId);
    }
    if (url.pathname === `${API_PREFIX}/auth/logout`) {
      return await handleLogout(request, requestId);
    }

    const authorization = await resolveAuthorizationContext(request, env);
    if (!authorization) {
      return apiError(401, 'AUTHENTICATION_REQUIRED', '生产身份认证尚未配置，服务端已拒绝匿名业务操作', requestId);
    }
    if (url.pathname === `${API_PREFIX}/bootstrap`) {
      return await handleBootstrap(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/auth/session`) {
      return json({ authenticated: true, authorization: publicAuthorization(authorization), requestId });
    }
    if (url.pathname === `${API_PREFIX}/accounts`) {
      return await handleAccounts(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/cart`) {
      return await handleCart(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/addresses`) {
      return await handleAddresses(request, env, authorization, requestId);
    }
    const addressMatch = url.pathname.match(/^\/api\/v1\/addresses\/([^/]+)$/);
    if (addressMatch) {
      return await handleDeleteAddress(request, env, authorization, decodeURIComponent(addressMatch[1]), requestId);
    }
    const cartItemMatch = url.pathname.match(/^\/api\/v1\/cart\/([^/]+)$/);
    if (cartItemMatch) {
      return await handleDeleteCartItem(request, env, authorization, decodeURIComponent(cartItemMatch[1]), requestId);
    }
    if (url.pathname === `${API_PREFIX}/account-ledgers`) {
      return await handleAccountLedgers(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/after-sales`) {
      return request.method === 'POST' ? await handleCreateAfterSale(request, env, authorization, requestId) : await handleAfterSales(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/orders`) {
      return request.method === 'POST' ? await handleCreateOrder(request, env, authorization, requestId) : await handleOrders(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/finance/reconciliation`) {
      return await handleFinanceReconciliation(request, env, authorization, requestId);
    }
    const refundMatch = url.pathname.match(/^\/api\/v1\/after-sales\/([^/]+)\/refund$/);
    if (refundMatch) {
      return await handleExecuteRefund(request, env, authorization, decodeURIComponent(refundMatch[1]), requestId);
    }
    const paymentMatch = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)\/payments\/internal$/);
    if (paymentMatch) {
      return await handleInternalPayment(request, env, authorization, decodeURIComponent(paymentMatch[1]), requestId);
    }
    return apiError(404, 'API_NOT_FOUND', '接口不存在', requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'api_request_failed',
        requestId,
        path: url.pathname,
        message,
      })
    );
    for (const [needle, status, code, text] of [
      ['IDEMPOTENCY_CONFLICT', 409, 'IDEMPOTENCY_CONFLICT', '相同幂等键不能用于不同请求'],
      ['INSUFFICIENT_INVENTORY', 409, 'INSUFFICIENT_INVENTORY', '部分商品库存不足'],
      ['INSUFFICIENT_ACCOUNT_BALANCE', 409, 'INSUFFICIENT_ACCOUNT_BALANCE', '账户余额不足'],
      ['ORDER_NOT_FOUND', 404, 'ORDER_NOT_FOUND', '订单不存在'],
      ['ORDER_NOT_PAYABLE', 409, 'ORDER_NOT_PAYABLE', '订单当前状态不可支付'],
      ['ACCOUNT_NOT_ACTIVE', 409, 'ACCOUNT_NOT_ACTIVE', '账户当前不可用'],
      ['PAYMENT_TOTAL_MISMATCH', 422, 'PAYMENT_TOTAL_MISMATCH', '账户扣款合计必须等于订单应付金额'],
      ['SKU_NOT_AVAILABLE', 422, 'SKU_NOT_AVAILABLE', '订单中存在无效商品'],
      ['INVALID_AFTER_SALE_INPUT', 422, 'INVALID_AFTER_SALE_INPUT', '售后申请信息不完整'],
      ['ORDER_NOT_AFTER_SALE_ELIGIBLE', 409, 'ORDER_NOT_AFTER_SALE_ELIGIBLE', '订单当前状态不可申请售后'],
      ['AFTER_SALE_AMOUNT_EXCEEDED', 422, 'AFTER_SALE_AMOUNT_EXCEEDED', '售后申请金额超过订单实付金额'],
      ['AFTER_SALE_ALREADY_EXISTS', 409, 'AFTER_SALE_ALREADY_EXISTS', '该订单已有处理中售后申请'],
      ['AFTER_SALE_NOT_REFUNDABLE', 409, 'AFTER_SALE_NOT_REFUNDABLE', '该售后当前不可退款'],
      ['REFUND_AMOUNT_EXCEEDED', 422, 'REFUND_AMOUNT_EXCEEDED', '退款金额超过可退金额'],
      ['REFUND_CHANNEL_UNSUPPORTED', 422, 'REFUND_CHANNEL_UNSUPPORTED', '订单含未接入退款通道，不能自动退款'],
      ['IDEMPOTENCY_KEY_INVALID', 422, 'IDEMPOTENCY_KEY_INVALID', '退款幂等键无效'],
    ] as const) {
      if (message.includes(needle)) return apiError(status, code, text, requestId);
    }
    return apiError(500, 'INTERNAL_ERROR', '服务暂时不可用', requestId);
  }
}

function publicAuthorization(context: import('./types').AuthorizationContext) {
  return {
    memberId: context.membership.memberId,
    membershipId: context.membership.id,
    target: context.membership.target,
    roles: context.roles,
    permissions: context.permissions,
  };
}
