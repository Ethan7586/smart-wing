import { PERMISSIONS, type Permission } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { invalidBody, readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';

type ControlSettingsInput = { expectedVersion: number; operationsNotice: string; orderAttentionThreshold: number };
type DistributionChannelInput = { code: string; name: string; distributorId: string; sourceReference: string };
type PartnerCatalogConnectionInput = { providerCode: string; displayName: string; externalCatalogReference: string };

export async function handleControlCenter(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const blocked = requireAdminRead(authorization, requestId, '智慧翼中控台', [PERMISSIONS.catalogRead, PERMISSIONS.orderRead]);
  if (blocked) return blocked;
  const broadScope = authorization.membership.scopeBindings.some((binding) => binding.kind !== 'self');
  const data = await callRpc<Record<string, unknown>>(env, 'api_admin_control_center', {
    p_tenant_id: authorization.tenantId,
    p_enterprise_id: authorization.enterpriseId,
    p_mall_id: authorization.mallId,
    p_user_id: broadScope ? null : authorization.userId,
  });
  return json({ ...data, capabilities: { canManageSettings: manageAllowed(authorization, PERMISSIONS.tenantManage) }, requestId });
}

export async function handleControlSettings(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'PUT') return methodNotAllowed(['PUT'], requestId);
  const denied = requireAdminManage(authorization, requestId, '中控配置');
  if (denied) return denied;
  const idempotencyKey = readIdempotencyKey(request, requestId);
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseControlSettingsInput(body.value);
  if (!input) return apiError(422, 'CONTROL_SETTINGS_INVALID', '中控配置内容或版本号无效', requestId);
  const setting = await callRpc<Record<string, unknown>>(env, 'api_save_admin_control_settings', {
    p_tenant_id: authorization.tenantId,
    p_mall_id: authorization.mallId,
    p_actor_user_id: authorization.userId,
    p_expected_version: input.expectedVersion,
    p_operations_notice: input.operationsNotice,
    p_order_attention_threshold: input.orderAttentionThreshold,
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256(JSON.stringify(input)),
  });
  return json({ setting, requestId });
}

export async function handleDistributionHub(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', '该身份不能访问渠道与分销系统', requestId);
  const mayRead = authorize(authorization, PERMISSIONS.orderRead).allowed || manageAllowed(authorization, PERMISSIONS.tenantManage);
  if (!mayRead) return apiError(403, 'FORBIDDEN', '没有查看渠道与分销数据的权限', requestId);
  if (!hasOperationalScope(authorization)) return apiError(403, 'FORBIDDEN', '当前权限范围不包含渠道运营数据', requestId);
  const data = await callRpc<Record<string, unknown>>(env, 'api_distribution_hub', {
    p_tenant_id: authorization.tenantId,
    p_enterprise_id: authorization.enterpriseId,
    p_mall_id: authorization.mallId,
  });
  return json({ ...data, capabilities: { canManageChannels: manageAllowed(authorization, PERMISSIONS.tenantManage), settlementWritable: false }, requestId });
}

export async function handleCreateDistributionChannel(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const denied = requireAdminManage(authorization, requestId, '渠道资料');
  if (denied) return denied;
  const idempotencyKey = readIdempotencyKey(request, requestId);
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseDistributionChannelInput(body.value);
  if (!input) return apiError(422, 'DISTRIBUTION_CHANNEL_INVALID', '渠道编码或资料不符合要求', requestId);
  const channel = await callRpc<Record<string, unknown>>(env, 'api_create_distribution_channel', {
    p_tenant_id: authorization.tenantId,
    p_enterprise_id: authorization.enterpriseId,
    p_mall_id: authorization.mallId,
    p_actor_user_id: authorization.userId,
    p_code: input.code,
    p_name: input.name,
    p_distributor_id: input.distributorId,
    p_source_reference: input.sourceReference,
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256(JSON.stringify(input)),
  });
  return json({ channel, requestId }, { status: 201 });
}

export async function handlePartnerCatalogHub(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', '该身份不能访问甲方商品池接入', requestId);
  const mayRead = authorize(authorization, PERMISSIONS.catalogRead).allowed || authorize(authorization, PERMISSIONS.commercialResourceRead).allowed || manageAllowed(authorization, PERMISSIONS.commercialResourceManage);
  if (!mayRead) return apiError(403, 'FORBIDDEN', '没有查看甲方商品池的权限', requestId);
  if (!hasOperationalScope(authorization)) return apiError(403, 'FORBIDDEN', '当前权限范围不包含该商城商品池', requestId);
  const data = await callRpc<Record<string, unknown>>(env, 'api_partner_catalog_hub', {
    p_tenant_id: authorization.tenantId,
    p_mall_id: authorization.mallId,
  });
  return json({ ...data, capabilities: { canManageConnections: manageAllowed(authorization, PERMISSIONS.commercialResourceManage), externalSyncWritable: false }, requestId });
}

export async function handleCreatePartnerCatalogConnection(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', '该身份不能配置甲方商品池', requestId);
  const decision = authorize(authorization, PERMISSIONS.commercialResourceManage);
  if (!decision.allowed) return apiError(403, decision.reason === 'STEP_UP_REQUIRED' ? 'STEP_UP_REQUIRED' : 'FORBIDDEN', decision.reason === 'STEP_UP_REQUIRED' ? '该操作需要重新验证身份' : '没有配置甲方商品池的权限', requestId);
  if (!hasOperationalScope(authorization)) return apiError(403, 'FORBIDDEN', '当前权限范围不包含该商城商品池', requestId);
  const idempotencyKey = readIdempotencyKey(request, requestId);
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parsePartnerCatalogConnectionInput(body.value);
  if (!input) return apiError(422, 'PARTNER_CATALOG_CONNECTION_INVALID', '接入资料格式无效', requestId);
  const connection = await callRpc<Record<string, unknown>>(env, 'api_create_partner_catalog_connection', {
    p_tenant_id: authorization.tenantId,
    p_mall_id: authorization.mallId,
    p_actor_user_id: authorization.userId,
    p_provider_code: input.providerCode,
    p_display_name: input.displayName,
    p_external_catalog_reference: input.externalCatalogReference,
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256(JSON.stringify(input)),
  });
  return json({ connection, requestId }, { status: 201 });
}

function requireAdminRead(authorization: AuthorizationContext, requestId: string, label: string, required: readonly Permission[]): Response | null {
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', `该身份不能访问${label}`, requestId);
  if (required.some((permission) => !authorization.permissions.includes(permission))) return apiError(403, 'FORBIDDEN', `没有读取${label}的权限`, requestId);
  if (!hasOperationalScope(authorization)) return apiError(403, 'FORBIDDEN', `当前权限范围不包含${label}数据`, requestId);
  return null;
}

function requireAdminManage(authorization: AuthorizationContext, requestId: string, label: string): Response | null {
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', `该身份不能修改${label}`, requestId);
  const decision = authorize(authorization, PERMISSIONS.tenantManage);
  if (!decision.allowed) return apiError(403, decision.reason === 'STEP_UP_REQUIRED' ? 'STEP_UP_REQUIRED' : 'FORBIDDEN', decision.reason === 'STEP_UP_REQUIRED' ? '该操作需要重新验证身份' : `没有修改${label}的权限`, requestId);
  if (!hasOperationalScope(authorization)) return apiError(403, 'FORBIDDEN', `当前权限范围不包含${label}`, requestId);
  return null;
}

function manageAllowed(authorization: AuthorizationContext, permission: typeof PERMISSIONS.tenantManage | typeof PERMISSIONS.commercialResourceManage): boolean {
  const decision = authorize(authorization, permission);
  return decision.allowed || decision.reason === 'STEP_UP_REQUIRED';
}

function hasOperationalScope(authorization: AuthorizationContext): boolean {
  return authorization.membership.scopeBindings.some(
    (binding) =>
      binding.kind === 'platform' ||
      binding.kind === 'distributor' ||
      (binding.kind === 'tenant' && binding.resourceId === authorization.tenantId) ||
      (binding.kind === 'enterprise' && binding.resourceId === authorization.enterpriseId) ||
      (binding.kind === 'mall' && binding.resourceId === authorization.mallId)
  );
}

function readIdempotencyKey(request: Request, requestId: string): string | Response {
  const key = request.headers.get('idempotency-key');
  if (!key || key.length < 8 || key.length > 120) return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '写入请求必须提供有效的 Idempotency-Key', requestId);
  return key;
}

function parseControlSettingsInput(value: unknown): ControlSettingsInput | null {
  if (!isRecord(value)) return null;
  const expectedVersion = value.expectedVersion;
  const operationsNotice = typeof value.operationsNotice === 'string' ? value.operationsNotice.trim() : null;
  const threshold = value.orderAttentionThreshold;
  if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0 || operationsNotice === null || operationsNotice.length > 600 || !Number.isSafeInteger(threshold) || (threshold as number) < 0 || (threshold as number) > 100000) return null;
  return { expectedVersion: expectedVersion as number, operationsNotice, orderAttentionThreshold: threshold as number };
}

function parseDistributionChannelInput(value: unknown): DistributionChannelInput | null {
  if (!isRecord(value)) return null;
  const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const distributorId = typeof value.distributorId === 'string' ? value.distributorId.trim() : '';
  const sourceReference = typeof value.sourceReference === 'string' ? value.sourceReference.trim() : '';
  if (!/^[A-Z0-9_-]{2,64}$/.test(code) || name.length < 2 || name.length > 120 || distributorId.length > 180 || sourceReference.length > 200) return null;
  return { code, name, distributorId, sourceReference };
}

function parsePartnerCatalogConnectionInput(value: unknown): PartnerCatalogConnectionInput | null {
  if (!isRecord(value)) return null;
  const providerCode = typeof value.providerCode === 'string' ? value.providerCode.trim().toLowerCase() : '';
  const displayName = typeof value.displayName === 'string' ? value.displayName.trim() : '';
  const externalCatalogReference = typeof value.externalCatalogReference === 'string' ? value.externalCatalogReference.trim() : '';
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(providerCode) || displayName.length < 2 || displayName.length > 120 || externalCatalogReference.length > 200) return null;
  return { providerCode, displayName, externalCatalogReference };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
