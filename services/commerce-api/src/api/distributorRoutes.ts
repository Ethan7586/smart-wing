import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize, isMembershipTarget } from './auth';
import { sha256 } from './crypto';
import { parseAttachDistributorTenant, parseCreateDistributor } from './distributorModel';
import { apiError, json, methodNotAllowed } from './http';
import { invalidBody, readJsonBody } from './routerSupport';
import { requireIdempotencyKey } from '../lib/idempotency';
import { attachDistributorTenant, createDistributor, loadDistributorCenter, loadPlatformDistributors } from '../services/distributorService';
import type { AuthorizationContext, WorkerEnv } from './types';

export async function handlePlatformDistributors(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed(['GET', 'POST'], requestId);
  const permission = request.method === 'GET' ? PERMISSIONS.distributorRead : PERMISSIONS.distributorManage;
  const denied = platformDecision(authorization, permission, requestId);
  if (denied) return denied;
  if (request.method === 'GET') return json({ ...(await loadPlatformDistributors(env, authorization)), requestId });

  const mutation = await mutationInput(request, requestId);
  if (!mutation.ok) return mutation.response;
  const input = parseCreateDistributor(mutation.body);
  if (!input) return apiError(422, 'DISTRIBUTOR_INPUT_INVALID', '分销商资料或变更原因无效', requestId);
  const result = await createDistributor(env, authorization, input, {
    requestId,
    requestHash: await sha256(JSON.stringify(input)),
    idempotencyKey: mutation.idempotencyKey,
    userAgent: userAgent(request),
  });
  return json({ ...result, requestId }, { status: 201 });
}

export async function handlePlatformDistributorAttachment(request: Request, env: WorkerEnv, authorization: AuthorizationContext, distributorId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const denied = platformDecision(authorization, PERMISSIONS.distributorTenantAttach, requestId);
  if (denied) return denied;
  const mutation = await mutationInput(request, requestId);
  if (!mutation.ok) return mutation.response;
  const input = parseAttachDistributorTenant(mutation.body);
  if (!input || !validId(distributorId)) {
    return apiError(422, 'DISTRIBUTOR_TENANT_ATTACHMENT_INVALID', '分销商挂载资料或变更原因无效', requestId);
  }
  const result = await attachDistributorTenant(env, authorization, distributorId, input, {
    requestId,
    requestHash: await sha256(JSON.stringify({ distributorId, ...input })),
    idempotencyKey: mutation.idempotencyKey,
    userAgent: userAgent(request),
  });
  return json({ ...result, requestId });
}

export async function handleDistributorCenter(request: Request, env: WorkerEnv, authorization: AuthorizationContext, view: 'overview' | 'tenants' | 'tenant', requestId: string, tenantId: string | null = null): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  if (!isMembershipTarget(authorization, 'admin') || !authorization.distributorId) {
    return apiError(403, 'DISTRIBUTOR_SCOPE_FORBIDDEN', '当前身份没有分销商数据范围', requestId);
  }
  const decision = authorize(authorization, PERMISSIONS.distributorRead);
  if (!decision.allowed) return apiError(403, 'DISTRIBUTOR_SCOPE_FORBIDDEN', '当前身份没有分销商查看权限', requestId);
  if (tenantId !== null && !validId(tenantId)) return apiError(422, 'DISTRIBUTOR_TENANT_NOT_FOUND', '租户不存在或不属于当前分销商', requestId);
  const center = await loadDistributorCenter(env, authorization, tenantId);
  if (view === 'overview') return json({ overview: center.overview, metricDefinition: center.metricDefinition, requestId });
  if (view === 'tenants') return json({ items: center.tenants, metricDefinition: center.metricDefinition, requestId });
  const items = Array.isArray(center.tenants) ? center.tenants : [];
  return json({ tenant: items[0] ?? null, metricDefinition: center.metricDefinition, requestId });
}

function platformDecision(authorization: AuthorizationContext, permission: typeof PERMISSIONS.distributorRead | typeof PERMISSIONS.distributorManage | typeof PERMISSIONS.distributorTenantAttach, requestId: string): Response | null {
  const platformScope = authorization.membership.scopeBindings.find((scope) => scope.kind === 'platform');
  if (!isMembershipTarget(authorization, 'admin') || !platformScope) {
    return apiError(403, 'DISTRIBUTOR_PLATFORM_SCOPE_REQUIRED', '仅平台管理员可执行该操作', requestId);
  }
  const decision = authorize(authorization, permission, { tenantId: authorization.tenantId, orgUnitPath: [platformScope] });
  if (decision.allowed) return null;
  const stepUp = decision.reason === 'STEP_UP_REQUIRED';
  return apiError(403, stepUp ? 'STEP_UP_REQUIRED' : 'FORBIDDEN', stepUp ? '该操作需要重新验证身份' : '没有执行该操作的权限', requestId);
}

async function mutationInput(request: Request, requestId: string): Promise<{ ok: true; body: unknown; idempotencyKey: string } | { ok: false; response: Response }> {
  const key = requireIdempotencyKey(request, { requestId, action: '分销商变更', minLength: 8, maxLength: 120, message: '分销商变更必须提供有效的 Idempotency-Key' });
  if (!key.ok) return { ok: false, response: key.response };
  const body = await readJsonBody(request);
  if (!body.ok) return { ok: false, response: invalidBody(body.tooLarge, requestId) };
  return { ok: true, body: body.value, idempotencyKey: key.key };
}

function validId(value: string): boolean {
  if (value.length === 0 || value.length > 120 || value.includes('/') || value.includes('\\')) return false;
  return [...value].every((character) => character.charCodeAt(0) >= 32);
}

function userAgent(request: Request): string {
  return (request.headers.get('user-agent') ?? '').slice(0, 300);
}
