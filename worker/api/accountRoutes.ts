import { json, methodNotAllowed } from './http';
import { actorScope } from './routerSupport';
import { callRpc } from './supabase';
import type { Actor, WorkerEnv } from './types';

interface BootstrapRow {
  mallName: string;
  brandName: string;
  enterpriseName: string;
}

interface AccountRow {
  id: string;
  account_type: string;
  balance_cents: number;
  status: string;
  updated_at: string;
}

export async function handleBootstrap(request: Request, env: WorkerEnv, actor: Actor, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const scope = await callRpc<BootstrapRow | null>(env, 'api_bootstrap', actorScope(actor));
  return json({
    actor: {
      userId: actor.userId,
      employeeNo: actor.employeeNo,
      roles: actor.roles,
      permissions: actor.permissions,
    },
    scope: {
      tenantId: actor.tenantId,
      enterpriseId: actor.enterpriseId,
      mallId: actor.mallId,
      mallCode: actor.mallCode,
      mallName: scope?.mallName ?? '',
      brandName: scope?.brandName ?? '',
      enterpriseName: scope?.enterpriseName ?? '',
    },
    requestId,
  });
}

export async function handleAccounts(request: Request, env: WorkerEnv, actor: Actor, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const rows = await callRpc<AccountRow[]>(env, 'api_accounts', actorScope(actor, true));
  return json({
    items: rows.map((row) => ({
      id: row.id,
      type: row.account_type,
      balanceCents: Number(row.balance_cents),
      status: row.status,
      updatedAt: row.updated_at,
    })),
    requestId,
  });
}

export async function handleAccountLedgers(request: Request, env: WorkerEnv, actor: Actor, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const rows = await callRpc<Array<Record<string, unknown>>>(env, 'api_account_ledgers', actorScope(actor, true));
  return json({ items: rows, requestId });
}
