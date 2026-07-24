export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export function json(
  value: unknown,
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(value), { ...init, headers });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  headers?: HeadersInit
): Response {
  return json(
    { error: { code, message, requestId } } satisfies ApiErrorBody,
    { status, headers }
  );
}

export function methodNotAllowed(
  allowed: string[],
  requestId: string
): Response {
  return apiError(405, "METHOD_NOT_ALLOWED", "请求方法不受支持", requestId, {
    Allow: allowed.join(", "),
  });
}
