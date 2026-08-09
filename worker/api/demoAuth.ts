import { callRpc } from './supabase';
import type { Actor, WorkerEnv } from './types';

export interface DemoAccount {
  username: string;
  password: string;
  employeeNo: string;
  mallCode: string;
  roles: string[];
  permissions: string[];
}

const DEFAULT_DEMO_MALL_CODE = 'SMART_WING_DEMO';

const DEFAULT_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: 'onewr',
    password: '123456',
    employeeNo: 'SW_DEMO_OWNER',
    mallCode: DEFAULT_DEMO_MALL_CODE,
    roles: ['owner'],
    permissions: ['order:read:own', 'order:create', 'finance:refund', 'finance:reconcile'],
  },
  {
    username: '李厚亿',
    password: '123456',
    employeeNo: 'SW_DEMO_OWNER',
    mallCode: DEFAULT_DEMO_MALL_CODE,
    roles: ['owner'],
    permissions: ['order:read:own', 'order:create', 'finance:refund', 'finance:reconcile'],
  },
  {
    username: '业主测试员',
    password: '123456',
    employeeNo: 'SW_DEMO_TESTER',
    mallCode: DEFAULT_DEMO_MALL_CODE,
    roles: ['tester'],
    permissions: ['order:read:own', 'order:create'],
  },
  {
    username: '福宝',
    password: '123456',
    employeeNo: 'SW_DEMO_MANAGER',
    mallCode: DEFAULT_DEMO_MALL_CODE,
    roles: ['admin'],
    permissions: ['order:read:own', 'order:create', 'finance:refund'],
  },
  {
    username: '经理1',
    password: '123456',
    employeeNo: 'SW_DEMO_OPS',
    mallCode: DEFAULT_DEMO_MALL_CODE,
    roles: ['manager'],
    permissions: ['order:read:own', 'order:create'],
  },
];

function normalizeAccount(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueStringList(values: string[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))];
}

export function getDemoAccounts(env: WorkerEnv): DemoAccount[] {
  const result = [...DEFAULT_DEMO_ACCOUNTS];
  if (!env.DEMO_USER_CREDENTIALS) return result;

  try {
    const custom = JSON.parse(env.DEMO_USER_CREDENTIALS) as DemoAccount[];
    if (!Array.isArray(custom)) return result;
    for (const item of custom) {
      if (!item || typeof item !== 'object') continue;
      const username = typeof item.username === 'string' ? item.username.trim() : '';
      const password = typeof item.password === 'string' ? item.password : '';
      if (!username || !password) continue;
      result.push({
        username,
        password,
        employeeNo: typeof item.employeeNo === 'string' && item.employeeNo.trim() ? item.employeeNo.trim() : `SW_DEMO_${username.toUpperCase()}`,
        mallCode: typeof item.mallCode === 'string' && item.mallCode.trim() ? item.mallCode.trim() : DEFAULT_DEMO_MALL_CODE,
        roles: uniqueStringList(Array.isArray(item.roles) ? item.roles : ['visitor']),
        permissions: uniqueStringList(Array.isArray(item.permissions) ? item.permissions : ['order:read:own', 'order:create']),
      });
    }
    return result;
  } catch {
    return result;
  }
}

export async function verifyDemoPassword(supplied: string, expected: string): Promise<boolean> {
  const [suppliedHash, expectedHash] = await Promise.all([crypto.subtle.digest('SHA-256', new TextEncoder().encode(supplied)), crypto.subtle.digest('SHA-256', new TextEncoder().encode(expected))]);
  const left = new Uint8Array(suppliedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function resolveDemoActor(env: WorkerEnv, account: DemoAccount): Promise<Actor | null> {
  const actor = await callRpc<Actor | null>(env, 'api_resolve_actor', {
    p_employee_no: account.employeeNo,
    p_mall_code: account.mallCode,
  }).catch(() => null);
  if (actor) return applyDemoPermissions(actor, account);

  if (!env.DEMO_FALLBACK_EMPLOYEE_NO) return null;
  const fallbackActor = await callRpc<Actor | null>(env, 'api_resolve_actor', {
    p_employee_no: env.DEMO_FALLBACK_EMPLOYEE_NO,
    p_mall_code: account.mallCode,
  }).catch(() => null);
  return fallbackActor ? applyDemoPermissions(fallbackActor, account) : null;
}

function applyDemoPermissions(actor: Actor, account: DemoAccount): Actor {
  return {
    ...actor,
    roles: uniqueStringList(account.roles.length ? account.roles : actor.roles),
    permissions: uniqueStringList(account.permissions.length ? account.permissions : actor.permissions),
  };
}
