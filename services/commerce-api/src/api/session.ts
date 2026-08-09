import type { WorkerEnv } from './types';

export type SessionTarget = 'storefront' | 'admin';

const SESSION_SECONDS = 8 * 60 * 60;
const COOKIE_NAMES: Record<SessionTarget, string> = {
  storefront: '__Host-hbbtzn_store_session',
  admin: '__Host-hbbtzn_admin_session',
};

export interface SessionPayload {
  sessionId: string;
  employeeNo: string;
  mallCode: string;
  target: SessionTarget;
  membershipId: string;
  memberId: string;
  authzVersion: number;
  stepUpAt?: number;
  expiresAt: number;
}

export interface SessionOptions {
  target?: SessionTarget;
  membershipId: string;
  memberId: string;
  authzVersion: number;
  stepUpAt?: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function targetForRequest(request: Request): SessionTarget {
  return new URL(request.url).hostname === 'smart.hbbtzn.com' ? 'admin' : 'storefront';
}

function signingSecret(env: WorkerEnv, target: SessionTarget): string | undefined {
  return target === 'admin' ? env.ADMIN_SESSION_SIGNING_KEY : env.SESSION_SIGNING_KEY;
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function cookieAttributes(maxAge: number): string {
  // __Host- cookies deliberately omit Domain and force host-only Path=/ scope.
  return `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function createSessionCookie(env: WorkerEnv, employeeNo: string, mallCode: string, options: SessionOptions): Promise<string> {
  const target = options.target ?? 'storefront';
  const secret = signingSecret(env, target);
  if (!secret || secret.length < 32) throw new Error('SESSION_SIGNING_KEY_NOT_CONFIGURED');

  const payload: SessionPayload = {
    sessionId: crypto.randomUUID(),
    employeeNo,
    mallCode,
    target,
    membershipId: options.membershipId,
    memberId: options.memberId,
    authzVersion: options.authzVersion,
    ...(options.stepUpAt ? { stepUpAt: options.stepUpAt } : {}),
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), new TextEncoder().encode(encodedPayload));
  return `${COOKIE_NAMES[target]}=${encodedPayload}.${toBase64Url(new Uint8Array(signature))}; ${cookieAttributes(SESSION_SECONDS)}`;
}

export function clearSessionCookie(request: Request): string {
  return `${COOKIE_NAMES[targetForRequest(request)]}=; ${cookieAttributes(0)}`;
}

export async function readSession(request: Request, env: WorkerEnv): Promise<SessionPayload | null> {
  const target = targetForRequest(request);
  const secret = signingSecret(env, target);
  if (!secret) return null;
  const cookieName = COOKIE_NAMES[target];
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`));
  if (!cookie) return null;

  const [encodedPayload, encodedSignature] = cookie.slice(cookieName.length + 1).split('.');
  if (!encodedPayload || !encodedSignature) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await signingKey(secret), Uint8Array.from(fromBase64Url(encodedSignature)).buffer, new TextEncoder().encode(encodedPayload));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload))) as SessionPayload;
    if (
      typeof payload.sessionId !== 'string' ||
      typeof payload.employeeNo !== 'string' ||
      typeof payload.mallCode !== 'string' ||
      typeof payload.memberId !== 'string' ||
      typeof payload.membershipId !== 'string' ||
      !Number.isInteger(payload.authzVersion) ||
      payload.authzVersion < 1 ||
      payload.target !== target ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
