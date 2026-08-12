import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { apiError, json, methodNotAllowed } from './http';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';

export async function handleQualificationCenter(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  if (authorization.membership.target !== 'admin') {
    return apiError(403, 'FORBIDDEN', '该身份不能访问员工资格中心', requestId);
  }
  const canReadEntitlements = authorize(authorization, PERMISSIONS.entitlementRead).allowed;
  const canReadLimits = authorize(authorization, PERMISSIONS.purchaseLimitRead).allowed;
  const canReadResources = authorize(authorization, PERMISSIONS.commercialResourceRead).allowed;
  if (!canReadEntitlements && !canReadLimits && !canReadResources) {
    return apiError(403, 'FORBIDDEN', '没有查看商业资源或员工资格策略的权限', requestId);
  }
  const hasMallScope = authorization.membership.scopeBindings.some(
    (binding) =>
      (binding.kind === 'mall' && binding.resourceId === authorization.mallId) ||
      (binding.kind === 'enterprise' && binding.resourceId === authorization.enterpriseId) ||
      (binding.kind === 'tenant' && binding.resourceId === authorization.tenantId) ||
      binding.kind === 'platform' ||
      binding.kind === 'distributor'
  );
  if (!hasMallScope) return apiError(403, 'FORBIDDEN', '当前管理员的数据范围不包含该商城', requestId);

  const center = await callRpc<Record<string, unknown>>(env, 'api_qualification_center', {
    p_tenant_id: authorization.tenantId,
    p_mall_id: authorization.mallId,
  });
  return json({
    ...center,
    capabilities: {
      readCommercialResources: canReadResources,
      manageCommercialResources: authorize(authorization, PERMISSIONS.commercialResourceManage).allowed,
      readEntitlements: canReadEntitlements,
      manageEntitlements: authorize(authorization, PERMISSIONS.entitlementManage).allowed,
      readPurchaseLimits: canReadLimits,
      managePurchaseLimits: authorize(authorization, PERMISSIONS.purchaseLimitManage).allowed,
    },
    requestId,
  });
}
