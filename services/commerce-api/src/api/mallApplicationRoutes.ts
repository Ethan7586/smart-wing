import { PERMISSIONS } from '@smart-wing/api-contract';
import type { Permission } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { parseMallMutation } from './mallApplicationModel';
import { invalidBody, readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';

export async function handleMallApplicationCenter(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed(['GET', 'POST'], requestId);
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', '该身份不能访问商城应用台', requestId);
  if (request.method === 'POST') return mutate(request, env, authorization, requestId, 'create', '');
  const capabilities = {
    read: visible(authorization, PERMISSIONS.mallRead),
    manage: visible(authorization, PERMISSIONS.mallManage),
    decorate: visible(authorization, PERMISSIONS.mallDecorate),
    publish: visible(authorization, PERMISSIONS.mallPublish),
  };
  if (!Object.values(capabilities).some(Boolean)) return apiError(403, 'FORBIDDEN', '没有查看商城应用的权限', requestId);
  const center = await callRpc<Record<string, unknown>>(env, 'api_mall_application_center', {
    p_tenant_id: authorization.tenantId,
    p_enterprise_id: authorization.enterpriseId,
    p_actor_membership_id: authorization.membership.id,
  });
  return json({ ...center, capabilities, frozenRules: ['智慧翼主品牌', '五个底部导航', '会员码名称与安全语义'], requestId });
}

export async function handleMallApplicationMutation(request: Request, env: WorkerEnv, authorization: AuthorizationContext, targetMallId: string, action: 'save' | 'publish' | 'restore', requestId: string): Promise<Response> {
  const expectedMethod = action === 'save' ? 'PUT' : 'POST';
  if (request.method !== expectedMethod) return methodNotAllowed([expectedMethod], requestId);
  return mutate(request, env, authorization, requestId, action, targetMallId);
}

export async function loadPublishedMallExperience(env: WorkerEnv, authorization: AuthorizationContext): Promise<Record<string, unknown> | null> {
  return callRpc<Record<string, unknown> | null>(env, 'api_mall_application_experience', {
    p_tenant_id: authorization.tenantId,
    p_mall_id: authorization.mallId,
  });
}

async function mutate(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string, action: 'create' | 'save' | 'publish' | 'restore', targetMallId: string): Promise<Response> {
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', '该身份不能管理商城应用', requestId);
  const permission = permissionFor(action);
  const decision = authorize(authorization, permission);
  if (!decision.allowed) {
    const stepUp = decision.reason === 'STEP_UP_REQUIRED';
    return apiError(403, stepUp ? 'STEP_UP_REQUIRED' : 'FORBIDDEN', stepUp ? '该操作需要重新验证身份' : '没有执行该商城操作的权限', requestId);
  }
  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '商城变更必须提供有效的 Idempotency-Key', requestId);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseMallMutation(body.value, action, targetMallId);
  if (!input) return apiError(422, 'MALL_APPLICATION_INPUT_INVALID', '商城资料、页面配置、版本或变更原因无效', requestId);
  const requestHash = await sha256(JSON.stringify(input));
  const result = await callRpc<Record<string, unknown>>(env, 'api_mutate_mall_application', {
    p_action: input.action,
    p_tenant_id: authorization.tenantId,
    p_enterprise_id: authorization.enterpriseId,
    p_context_mall_id: authorization.mallId,
    p_actor_user_id: authorization.userId,
    p_actor_membership_id: authorization.membership.id,
    p_target_mall_id: input.targetMallId,
    p_payload: input.payload,
    p_expected_row_version: input.expectedRowVersion,
    p_source_version_id: input.sourceVersionId,
    p_reason: input.reason,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  return json({ ...result, requestId }, { status: action === 'create' ? 201 : 200 });
}

function permissionFor(action: 'create' | 'save' | 'publish' | 'restore'): Permission {
  if (action === 'create') return PERMISSIONS.mallManage;
  if (action === 'publish') return PERMISSIONS.mallPublish;
  return PERMISSIONS.mallDecorate;
}

function visible(authorization: AuthorizationContext, permission: Permission): boolean {
  const decision = authorize(authorization, permission);
  return decision.allowed || decision.reason === 'STEP_UP_REQUIRED';
}
