import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { apiError, json, methodNotAllowed } from './http';
import { invalidBody, readJsonBody } from './routerSupport';
import type { AuthorizationContext, WorkerEnv } from './types';
import { isRecord } from './inputPrimitives';

/** Outbound access to the whyouye product-pool API. */
export const WHYOUYE_ORIGIN = 'https://mall.whyouye.com';
export interface WhyouyeCredentials {
  token: string;
  orgId: string;
  siteId: string;
  accountCode?: string;
}

export function readCredentials(env: WorkerEnv, requireAccountCode = false): WhyouyeCredentials | null {
  const token = env.WHYOUYE_API_TOKEN?.trim();
  const orgId = env.WHYOUYE_ORG_ID?.trim();
  const siteId = env.WHYOUYE_SITE_ID?.trim();
  const accountCode = env.WHYOUYE_ACCOUNT_CODE?.trim();
  if (!token || !orgId || !siteId || (requireAccountCode && !accountCode)) return null;
  return { token, orgId, siteId, ...(accountCode ? { accountCode } : {}) };
}

export function integrationNotConfigured(requestId: string, jdVop = false): Response {
  return apiError(503, 'WHYOUYE_INTEGRATION_NOT_CONFIGURED', jdVop ? '甲方京东商品池密钥尚未配置' : '甲方商品池密钥尚未配置', requestId);
}

export async function postToWhyouye(endpoint: string, payload: Record<string, unknown>, credentials: WhyouyeCredentials, productCount: number, requestId: string): Promise<Response> {
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

export async function summarizeRemoteResponse(response: Response): Promise<{ code: number | null; message: string | null }> {
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
