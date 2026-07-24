import { apiError } from "./http";
import type { Actor } from "./types";

export function actorScope(
  actor: Actor,
  includeUser = false
): Record<string, string> {
  return {
    p_tenant_id: actor.tenantId,
    p_enterprise_id: actor.enterpriseId,
    p_mall_id: actor.mallId,
    ...(includeUser ? { p_user_id: actor.userId } : {}),
  };
}

export function invalidBody(
  tooLarge: boolean,
  requestId: string
): Response {
  return apiError(
    tooLarge ? 413 : 400,
    tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_JSON",
    tooLarge ? "请求内容超过允许大小" : "请求内容不是有效 JSON",
    requestId
  );
}

export async function readJsonBody(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  const maximumBytes = 32 * 1024;
  const declaredLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10
  );
  if (declaredLength > maximumBytes) return { ok: false, tooLarge: true };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    return { ok: false, tooLarge: true };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}
