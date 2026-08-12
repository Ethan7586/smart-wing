import { handleAccountLedgers, handleAccounts, handleBootstrap } from './accountRoutes';
import { resolveAuthorizationContext } from './auth';
import { handleCart, handleDeleteCartItem } from './cartRoutes';
import { handleAddresses, handleDeleteAddress } from './addressRoutes';
import { apiError, json } from './http';
import { handleAfterSales, handleCreateAfterSale, handleCreateOrder, handleExecuteRefund, handleFinanceReconciliation, handleInternalPayment, handleOrders, handleShipOrder } from './orderRoutes';
import { handleAdminCatalog, handleAdminOverview, handleSetProductStatus } from './adminRoutes';
import { handleHealth, handleLogin, handleLogout, handleProducts } from './publicRoutes';
import { handleHomeSnapshot } from './homeRoutes';
import { handleSimulationBenefitIssue, handleSimulationMixedPayment, handleSimulationRecharge, handleSimulationWallet } from './paymentSimulationRoutes';
import { handleMembershipAccess, handleMembershipStatus, handlePermissionCommandCenter } from './permissionAdminRoutes';
import { handleStepUp } from './stepUpRoutes';
import { handleQualificationCenter } from './qualificationAdminRoutes';
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
    if (url.pathname === `${API_PREFIX}/products`) {
      return await handleProducts(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/bootstrap`) {
      return await handleBootstrap(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/home`) {
      return await handleHomeSnapshot(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/auth/session`) {
      return json({ authenticated: true, authorization: publicAuthorization(authorization), requestId });
    }
    if (url.pathname === `${API_PREFIX}/auth/step-up`) {
      return await handleStepUp(request, env, authorization, requestId);
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
    if (url.pathname === `${API_PREFIX}/simulation/wallet`) {
      return await handleSimulationWallet(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/simulation/recharges`) {
      return await handleSimulationRecharge(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/simulation/benefits`) {
      return await handleSimulationBenefitIssue(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/after-sales`) {
      return request.method === 'POST' ? await handleCreateAfterSale(request, env, authorization, requestId) : await handleAfterSales(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/orders`) {
      return request.method === 'POST' ? await handleCreateOrder(request, env, authorization, requestId) : await handleOrders(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/admin/products`) {
      return await handleAdminCatalog(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/admin/overview`) {
      return await handleAdminOverview(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/admin/access-control`) {
      return await handlePermissionCommandCenter(request, env, authorization, requestId);
    }
    if (url.pathname === `${API_PREFIX}/admin/qualification-center`) {
      return await handleQualificationCenter(request, env, authorization, requestId);
    }
    const membershipAccessMatch = url.pathname.match(/^\/api\/v1\/admin\/memberships\/([^/]+)\/access$/);
    if (membershipAccessMatch) {
      return await handleMembershipAccess(request, env, authorization, decodeURIComponent(membershipAccessMatch[1]), requestId);
    }
    const membershipStatusMatch = url.pathname.match(/^\/api\/v1\/admin\/memberships\/([^/]+)\/status$/);
    if (membershipStatusMatch) {
      return await handleMembershipStatus(request, env, authorization, decodeURIComponent(membershipStatusMatch[1]), requestId);
    }
    const productStatusMatch = url.pathname.match(/^\/api\/v1\/admin\/products\/([^/]+)\/status$/);
    if (productStatusMatch) {
      return await handleSetProductStatus(request, env, authorization, decodeURIComponent(productStatusMatch[1]), requestId);
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
    const simulatedPaymentMatch = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)\/payments\/simulated$/);
    if (simulatedPaymentMatch) {
      return await handleSimulationMixedPayment(request, env, authorization, decodeURIComponent(simulatedPaymentMatch[1]), requestId);
    }
    const shipMatch = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)\/ship$/);
    if (shipMatch) {
      return await handleShipOrder(request, env, authorization, decodeURIComponent(shipMatch[1]), requestId);
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
      ['ORDER_NOT_SHIPPABLE', 409, 'ORDER_NOT_SHIPPABLE', '订单当前状态不可发货'],
      ['PRODUCT_NOT_FOUND', 404, 'PRODUCT_NOT_FOUND', '商品不存在'],
      ['INVALID_PRODUCT_STATUS_INPUT', 422, 'INVALID_PRODUCT_STATUS_INPUT', '商品状态参数无效'],
      ['ACCOUNT_NOT_ACTIVE', 409, 'ACCOUNT_NOT_ACTIVE', '账户当前不可用'],
      ['PAYMENT_TOTAL_MISMATCH', 422, 'PAYMENT_TOTAL_MISMATCH', '账户扣款合计必须等于订单应付金额'],
      ['SKU_NOT_AVAILABLE', 422, 'SKU_NOT_AVAILABLE', '订单中存在无效商品'],
      ['SKU_NOT_ELIGIBLE', 403, 'SKU_NOT_ELIGIBLE', '当前员工资格不能购买该商品'],
      ['CITY_NOT_ELIGIBLE', 403, 'CITY_NOT_ELIGIBLE', '当前城市不在该商品的可售范围'],
      ['PURCHASE_LIMIT_EXCEEDED', 409, 'PURCHASE_LIMIT_EXCEEDED', '已超过该商品的限购数量或金额'],
      ['INVALID_AFTER_SALE_INPUT', 422, 'INVALID_AFTER_SALE_INPUT', '售后申请信息不完整'],
      ['ORDER_NOT_AFTER_SALE_ELIGIBLE', 409, 'ORDER_NOT_AFTER_SALE_ELIGIBLE', '订单当前状态不可申请售后'],
      ['AFTER_SALE_AMOUNT_EXCEEDED', 422, 'AFTER_SALE_AMOUNT_EXCEEDED', '售后申请金额超过订单实付金额'],
      ['AFTER_SALE_ALREADY_EXISTS', 409, 'AFTER_SALE_ALREADY_EXISTS', '该订单已有处理中售后申请'],
      ['AFTER_SALE_NOT_REFUNDABLE', 409, 'AFTER_SALE_NOT_REFUNDABLE', '该售后当前不可退款'],
      ['REFUND_AMOUNT_EXCEEDED', 422, 'REFUND_AMOUNT_EXCEEDED', '退款金额超过可退金额'],
      ['REFUND_CHANNEL_UNSUPPORTED', 422, 'REFUND_CHANNEL_UNSUPPORTED', '订单含未接入退款通道，不能自动退款'],
      ['IDEMPOTENCY_KEY_INVALID', 422, 'IDEMPOTENCY_KEY_INVALID', '退款幂等键无效'],
      ['SELF_ACCESS_MUTATION_FORBIDDEN', 409, 'SELF_ACCESS_MUTATION_FORBIDDEN', '不能修改自己的会员权限'],
      ['OWNER_MEMBERSHIP_PROTECTED', 409, 'OWNER_MEMBERSHIP_PROTECTED', 'Owner 身份受保护，不能通过日常后台修改'],
      ['OWNER_ROLE_PROTECTED', 409, 'OWNER_ROLE_PROTECTED', 'Owner 角色受保护，不能通过日常后台授予或撤销'],
      ['ROLE_GRANT_EXCEEDS_ACTOR', 403, 'ROLE_GRANT_EXCEEDS_ACTOR', '不能授予自己尚未拥有的角色权限'],
      ['SCOPE_GRANT_EXCEEDS_ACTOR', 403, 'SCOPE_GRANT_EXCEEDS_ACTOR', '不能授予超出自己管理范围的数据范围'],
      ['TARGET_MEMBERSHIP_OUTSIDE_ACTOR_SCOPE', 403, 'TARGET_MEMBERSHIP_OUTSIDE_ACTOR_SCOPE', '目标会员不在当前管理员的数据范围内'],
      ['ACCESS_CHANGE_REASON_REQUIRED', 422, 'ACCESS_CHANGE_REASON_REQUIRED', '必须填写有效的变更原因'],
      ['MEMBERSHIP_STATUS_INVALID', 422, 'MEMBERSHIP_STATUS_INVALID', '会员状态无效'],
      ['MEMBERSHIP_NOT_FOUND', 404, 'MEMBERSHIP_NOT_FOUND', '会员身份不存在或不在当前管理范围'],
      ['MEMBERSHIP_SCOPE_KIND_RESERVED', 422, 'MEMBERSHIP_SCOPE_KIND_RESERVED', '该数据范围尚未启用'],
      ['MEMBERSHIP_SCOPE_OUTSIDE_TENANT', 422, 'MEMBERSHIP_SCOPE_OUTSIDE_TENANT', '数据范围不属于当前会员上下文'],
      ['ROLE_NOT_FOUND', 422, 'ROLE_NOT_FOUND', '角色不存在或不属于当前平台'],
      ['PERMISSION_NOT_FOUND', 422, 'PERMISSION_NOT_FOUND', '权限代码不存在'],
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
