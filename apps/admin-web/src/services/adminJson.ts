export interface AdminJsonOptions<T> extends RequestInit {
  /** Prefix shown to the operator when the request fails, e.g. `权限服务`. */
  label: string;
  /**
   * Optional boundary validation for read models.  JSON alone is not enough:
   * a proxy, a partial rollout, or a stale endpoint may still return `{}`.
   */
  validate?: (payload: unknown) => payload is T;
}

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasArrayProperties(value: unknown, properties: readonly string[]): value is Record<string, unknown[]> {
  return isJsonRecord(value) && properties.every((property) => Array.isArray(value[property]));
}

export function hasRecordProperties(value: unknown, properties: readonly string[]): value is Record<string, Record<string, unknown>> {
  return isJsonRecord(value) && properties.every((property) => isJsonRecord(value[property]));
}

function readErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.length > 0 ? message : null;
}

function parseJson(raw: string): unknown {
  if (raw.length === 0) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * The single admin fetch path.
 *
 * A 200 whose body is not JSON means the request never reached the API: the
 * Vite dev server and the CDN both answer unknown paths with the SPA shell.
 * Treating that as an empty object hands the caller a value that lies about
 * its type, and the failure only surfaces much later as `undefined.filter`
 * somewhere inside a workstation. Fail here instead, where the reason is known.
 */
export async function requestAdminJson<T>(url: string, options: AdminJsonOptions<T>): Promise<T> {
  const { label, validate, ...init } = options;
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const payload = parseJson(await response.text());

  if (!response.ok) {
    throw new Error(readErrorMessage(payload) ?? `${label}请求失败 (${response.status})`);
  }
  if (payload === null || typeof payload !== 'object') {
    throw new Error(`${label}返回了非预期内容，请确认登录状态与接口是否已部署`);
  }
  if (validate && !validate(payload)) {
    throw new Error(`${label}返回了不完整的数据，请确认接口版本与登录状态`);
  }
  return payload as T;
}
