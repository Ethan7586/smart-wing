import { apiError, json, methodNotAllowed } from './http';
import { authorizationScope, invalidBody, readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';

export interface ClientErrorInput {
  surface: 'admin' | 'storefront';
  route: string;
  message: string;
  stack: string | null;
  componentStack: string | null;
}

function text(value: unknown, maximumLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximumLength ? trimmed : null;
}

function optionalText(value: unknown, maximumLength: number): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value.slice(0, maximumLength) : null;
}

export function parseClientErrorInput(value: unknown): ClientErrorInput | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const surface = raw.surface === 'admin' || raw.surface === 'storefront' ? raw.surface : null;
  const route = text(raw.route, 200);
  const message = text(raw.message, 500);
  if (!surface || !route || !message) return null;
  return { surface, route, message, stack: optionalText(raw.stack, 8000), componentStack: optionalText(raw.componentStack, 8000) };
}

/**
 * Records a crash the browser could not recover from. The report is written
 * under the caller's own membership scope, so it can never be used to write
 * into another tenant, and the response carries only the fault code the
 * operator is asked to quote.
 */
export async function handleRecordClientError(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseClientErrorInput(body.value);
  if (!input) return apiError(422, 'INVALID_CLIENT_ERROR_INPUT', '故障上报内容不完整', requestId);

  const result = await callRpc<{ faultCode?: string }>(env, 'api_record_client_error', {
    ...authorizationScope(authorization),
    p_membership_id: authorization.membership.id,
    p_surface: input.surface,
    p_route: input.route,
    p_message: input.message,
    p_stack: input.stack,
    p_component_stack: input.componentStack,
    p_request_id: requestId,
  });

  return json({ faultCode: result?.faultCode ?? null, requestId }, { status: 201 });
}
