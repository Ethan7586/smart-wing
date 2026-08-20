import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { apiError, json, methodNotAllowed } from './http';
import { invalidBody, readJsonBody } from './routerSupport';
import type { AuthorizationContext, WorkerEnv } from './types';

const WHYOUYE_ORIGIN = 'https://mall.whyouye.com';
const EXTERNAL_WRITE_CONFIRMATION_HEADER = 'x-confirm-external-write';
const EXTERNAL_WRITE_CONFIRMATION_VALUE = 'commit';
const MAX_PRODUCT_IDS = 100;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

const GENERAL_POOL_SOURCES = new Set([1, 7, 11, 18, 26, 52, 54, 55, 63, 104, 108]);
const PRICE_WAYS = new Set(['adjust', 'fixed']);
const PRICE_TYPES = new Set(['markPrice', 'supplyPrice', 'priceSetting', 'jdSellPrice', 'eventPrice', 'packPrice', 'businessPrice']);
const PRICE_ADJUSTMENTS = new Set(['incr', 'desc']);
const PRICE_UNITS = new Set(['profit', 'rmb']);

type WriteMode = 'preview' | 'commit';

interface PoolPricing {
  priceWay: string;
  priceType: string;
  priceAdjust: string;
  priceVal: string;
  priceUnit: string;
  distribPriceWay: string;
  distribPriceType: string;
  distribPriceAdjust: string;
  distribPriceVal: string;
  distribPriceUnit: string;
  distribPriceSetting: string;
  salePriceSetting: string;
}

interface GeneralPoolInput {
  mode: WriteMode;
  source: number;
  remoteProductIds: string[];
  pricing: PoolPricing;
  /** Optional explicit target sites. Omit to let the partner resolve the current site from the credential context. */
  targetSiteIds: string[];
  /** 3=上架、4=下架；only passed through when the operator has made a choice. */
  operStatus: 3 | 4 | null;
}

interface JdVopPoolInput {
  mode: WriteMode;
  remoteProductIds: string[];
  targetPool: 'standard' | 'fresh';
}

interface WhyouyeCredentials {
  token: string;
  orgId: string;
  siteId: string;
  accountCode?: string;
}

const DEFAULT_PRICING: PoolPricing = {
  priceWay: 'adjust',
  priceType: 'supplyPrice',
  priceAdjust: 'incr',
  priceVal: '0',
  priceUnit: 'profit',
  distribPriceWay: 'adjust',
  distribPriceType: 'supplyPrice',
  distribPriceAdjust: 'incr',
  distribPriceVal: '0',
  distribPriceUnit: 'profit',
  distribPriceSetting: '',
  salePriceSetting: '',
};

/**
 * Adds existing partner catalogue IDs to the partner's general product pool.
 * It never claims to create an arbitrary partner product: their UI uses a
 * distinct, guarded file-import flow for that capability.
 */
export async function handleWhyouyeProductPoolEnroll(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  const permissionError = requireProductPoolWritePermission(request, authorization, requestId);
  if (permissionError) return permissionError;
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseGeneralPoolInput(body.value);
  if (!input) return apiError(422, 'INVALID_WHYOUYE_POOL_ENROLL_INPUT', '商品池写入参数不符合甲方接口约定', requestId);

  const payload = {
    distribPriceSetting: input.pricing.distribPriceSetting,
    salePriceSetting: input.pricing.salePriceSetting,
    source: input.source,
    productIds: input.remoteProductIds.join(','),
    priceWay: input.pricing.priceWay,
    priceType: input.pricing.priceType,
    priceAdjust: input.pricing.priceAdjust,
    priceVal: input.pricing.priceVal,
    priceUnit: input.pricing.priceUnit,
    distribPriceWay: input.pricing.distribPriceWay,
    distribPriceType: input.pricing.distribPriceType,
    distribPriceAdjust: input.pricing.distribPriceAdjust,
    distribPriceVal: input.pricing.distribPriceVal,
    distribPriceUnit: input.pricing.distribPriceUnit,
    ...(input.targetSiteIds.length ? { siteIds: input.targetSiteIds.join(',') } : {}),
    ...(input.operStatus !== null ? { operStatus: input.operStatus } : {}),
  };

  if (input.mode === 'preview') {
    return json({ mode: 'preview', endpoint: '/ybt-backend/product/siteproduct/orgBatchPrePick', productCount: input.remoteProductIds.length, payload, requestId });
  }
  const confirmationError = requireExternalWriteConfirmation(request, requestId);
  if (confirmationError) return confirmationError;
  const credentials = readCredentials(env);
  if (!credentials) return integrationNotConfigured(requestId);
  return postToWhyouye('/ybt-backend/product/siteproduct/orgBatchPrePick', payload, credentials, input.remoteProductIds.length, requestId);
}

/**
 * Reports only capability readiness, never the partner token or account code.
 * This gives the admin UI an honest signal before an operator starts a write.
 */
export function handleWhyouyeIntegrationStatus(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Response {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', '该身份不能查看甲方商品池对接状态', requestId);
  const canRead = authorize(authorization, PERMISSIONS.catalogRead).allowed || authorize(authorization, PERMISSIONS.productPublish).allowed;
  if (!canRead) return apiError(403, 'FORBIDDEN', '没有查看甲方商品池对接状态的权限', requestId);
  const genericPoolEnroll = Boolean(readCredentials(env));
  const jdVopPoolEnroll = Boolean(readCredentials(env, true));
  return json({
    provider: 'whyouye',
    capabilities: {
      generalPoolEnroll: genericPoolEnroll,
      jdVopPoolEnroll,
      catalogRead: false,
      arbitraryProductCreate: false,
      fileImport: false,
    },
    externalWritePolicy: 'explicit-confirmation',
    requestId,
  });
}

/** Adds existing JD VOP product IDs to the specific partner pool. */
export async function handleWhyouyeJdVopPoolEnroll(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  const permissionError = requireProductPoolWritePermission(request, authorization, requestId);
  if (permissionError) return permissionError;
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseJdVopPoolInput(body.value);
  if (!input) return apiError(422, 'INVALID_WHYOUYE_JD_VOP_POOL_ENROLL_INPUT', '京东商品池写入参数不符合甲方接口约定', requestId);

  const credentials = readCredentials(env, true);
  const payload = credentials?.accountCode
    ? { productIds: input.remoteProductIds, targetPool: input.targetPool, accountCode: credentials.accountCode }
    : { productIds: input.remoteProductIds, targetPool: input.targetPool, accountCode: '<configured-at-commit>' };
  if (input.mode === 'preview') {
    return json({ mode: 'preview', endpoint: '/ybt-backend/api/vop/product/addToPool', productCount: input.remoteProductIds.length, payload, requestId });
  }
  const confirmationError = requireExternalWriteConfirmation(request, requestId);
  if (confirmationError) return confirmationError;
  if (!credentials) return integrationNotConfigured(requestId, true);
  return postToWhyouye('/ybt-backend/api/vop/product/addToPool', payload, credentials, input.remoteProductIds.length, requestId);
}

function requireProductPoolWritePermission(request: Request, authorization: AuthorizationContext, requestId: string): Response | null {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (authorization.membership.target !== 'admin') return apiError(403, 'FORBIDDEN', '该身份不能写入甲方商品池', requestId);
  if (!authorize(authorization, PERMISSIONS.productPublish).allowed) return apiError(403, 'FORBIDDEN', '没有写入甲方商品池的权限', requestId);
  return null;
}

function requireExternalWriteConfirmation(request: Request, requestId: string): Response | null {
  if (request.headers.get(EXTERNAL_WRITE_CONFIRMATION_HEADER) !== EXTERNAL_WRITE_CONFIRMATION_VALUE) {
    return apiError(409, 'EXTERNAL_WRITE_CONFIRMATION_REQUIRED', '甲方商品池写入需要 x-confirm-external-write: commit 明确确认', requestId);
  }
  return null;
}

function parseGeneralPoolInput(value: unknown): GeneralPoolInput | null {
  if (!isRecord(value)) return null;
  const mode = parseMode(value.mode);
  const source = typeof value.source === 'number' && Number.isInteger(value.source) && GENERAL_POOL_SOURCES.has(value.source) ? value.source : null;
  const remoteProductIds = parseProductIds(value.remoteProductIds);
  const pricing = parsePricing(value.pricing);
  const targetSiteIds = parseOptionalProductIds(value.targetSiteIds, 20);
  const operStatus = value.operStatus === undefined ? null : value.operStatus === 3 || value.operStatus === 4 ? value.operStatus : null;
  return mode && source !== null && remoteProductIds && pricing && targetSiteIds !== null && (value.operStatus === undefined || operStatus !== null) ? { mode, source, remoteProductIds, pricing, targetSiteIds, operStatus } : null;
}

function parseJdVopPoolInput(value: unknown): JdVopPoolInput | null {
  if (!isRecord(value)) return null;
  const mode = parseMode(value.mode);
  const remoteProductIds = parseProductIds(value.remoteProductIds);
  const targetPool = value.targetPool === 'standard' || value.targetPool === 'fresh' ? value.targetPool : null;
  return mode && remoteProductIds && targetPool ? { mode, remoteProductIds, targetPool } : null;
}

function parseMode(value: unknown): WriteMode | null {
  if (value === undefined || value === 'preview') return 'preview';
  return value === 'commit' ? 'commit' : null;
}

function parseProductIds(value: unknown): string[] | null {
  return parseOptionalProductIds(value, MAX_PRODUCT_IDS, true);
}

function parseOptionalProductIds(value: unknown, maxLength: number, required = false): string[] | null {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length === 0 || value.length > maxLength) return null;
  const productIds = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => PRODUCT_ID_PATTERN.test(item));
  if (productIds.length !== value.length) return null;
  const uniqueIds = [...new Set(productIds)];
  return uniqueIds.length === productIds.length ? uniqueIds : null;
}

function parsePricing(value: unknown): PoolPricing | null {
  if (value === undefined) return { ...DEFAULT_PRICING };
  if (!isRecord(value)) return null;
  const result: PoolPricing = { ...DEFAULT_PRICING };
  for (const key of ['priceWay', 'priceType', 'priceAdjust', 'priceUnit', 'distribPriceWay', 'distribPriceType', 'distribPriceAdjust', 'distribPriceUnit'] as const) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (typeof candidate !== 'string') return null;
    result[key] = candidate;
  }
  for (const key of ['priceVal', 'distribPriceVal'] as const) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    const normalized = normalizeNonNegativeDecimal(candidate);
    if (!normalized) return null;
    result[key] = normalized;
  }
  for (const key of ['distribPriceSetting', 'salePriceSetting'] as const) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (typeof candidate !== 'string' || candidate.length > 200) return null;
    result[key] = candidate;
  }
  return PRICE_WAYS.has(result.priceWay) &&
    PRICE_TYPES.has(result.priceType) &&
    PRICE_ADJUSTMENTS.has(result.priceAdjust) &&
    PRICE_UNITS.has(result.priceUnit) &&
    PRICE_WAYS.has(result.distribPriceWay) &&
    PRICE_TYPES.has(result.distribPriceType) &&
    PRICE_ADJUSTMENTS.has(result.distribPriceAdjust) &&
    PRICE_UNITS.has(result.distribPriceUnit)
    ? result
    : null;
}

function normalizeNonNegativeDecimal(value: unknown): string | null {
  const candidate = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d+(?:\.\d{1,4})?$/.test(candidate)) return null;
  return candidate;
}

function readCredentials(env: WorkerEnv, requireAccountCode = false): WhyouyeCredentials | null {
  const token = env.WHYOUYE_API_TOKEN?.trim();
  const orgId = env.WHYOUYE_ORG_ID?.trim();
  const siteId = env.WHYOUYE_SITE_ID?.trim();
  const accountCode = env.WHYOUYE_ACCOUNT_CODE?.trim();
  if (!token || !orgId || !siteId || (requireAccountCode && !accountCode)) return null;
  return { token, orgId, siteId, ...(accountCode ? { accountCode } : {}) };
}

function integrationNotConfigured(requestId: string, jdVop = false): Response {
  return apiError(503, 'WHYOUYE_INTEGRATION_NOT_CONFIGURED', jdVop ? '甲方京东商品池密钥尚未配置' : '甲方商品池密钥尚未配置', requestId);
}

async function postToWhyouye(endpoint: string, payload: Record<string, unknown>, credentials: WhyouyeCredentials, productCount: number, requestId: string): Promise<Response> {
  let remote: Response;
  try {
    remote = await fetch(`${WHYOUYE_ORIGIN}${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        token: `${credentials.token}.${credentials.orgId}.${credentials.siteId}`,
        'x-request-id': requestId,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return apiError(502, 'WHYOUYE_REMOTE_UNAVAILABLE', '甲方商品平台暂时不可访问，未确认写入结果', requestId);
  }

  const summary = await summarizeRemoteResponse(remote);
  if (!remote.ok || summary.code === null || summary.code !== 0) {
    return apiError(502, 'WHYOUYE_REMOTE_REJECTED', summary.message ?? '甲方商品平台拒绝了写入请求', requestId);
  }
  console.info(JSON.stringify({ event: 'whyouye_product_pool_enrolled', requestId, endpoint, productCount }));
  return json({ mode: 'commit', endpoint, productCount, remote: { httpStatus: remote.status, code: summary.code, message: summary.message }, requestId }, { status: 201 });
}

async function summarizeRemoteResponse(response: Response): Promise<{ code: number | null; message: string | null }> {
  try {
    const value: unknown = await response.json();
    if (!isRecord(value)) return { code: null, message: null };
    const code = typeof value.code === 'number' ? value.code : null;
    const message = typeof value.msg === 'string' ? value.msg.slice(0, 300) : typeof value.message === 'string' ? value.message.slice(0, 300) : null;
    return { code, message };
  } catch {
    return { code: null, message: null };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
