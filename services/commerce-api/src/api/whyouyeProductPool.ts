import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { apiError, json, methodNotAllowed } from './http';
import { invalidBody, readJsonBody } from './routerSupport';
import type { AuthorizationContext, WorkerEnv } from './types';
import { parseGeneralPoolInput, parseJdVopPoolInput } from './whyouyePoolInput';
import { integrationNotConfigured, postToWhyouye, readCredentials } from './whyouyeClient';

const EXTERNAL_WRITE_CONFIRMATION_HEADER = 'x-confirm-external-write';
const EXTERNAL_WRITE_CONFIRMATION_VALUE = 'commit';
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
