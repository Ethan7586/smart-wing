import type { WorkerEnv } from "./types";

const COOKIE_NAME = "smart_wing_session";
const SESSION_SECONDS = 8 * 60 * 60;

interface SessionPayload {
  employeeNo: string;
  mallCode: string;
  expiresAt: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionCookie(
  env: WorkerEnv,
  employeeNo: string,
  mallCode: string
): Promise<string> {
  if (!env.SESSION_SIGNING_KEY || env.SESSION_SIGNING_KEY.length < 32) {
    throw new Error("SESSION_SIGNING_KEY_NOT_CONFIGURED");
  }
  const payload: SessionPayload = {
    employeeNo,
    mallCode,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encodedPayload = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(env.SESSION_SIGNING_KEY),
    new TextEncoder().encode(encodedPayload)
  );
  const value = `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function readSession(
  request: Request,
  env: WorkerEnv
): Promise<SessionPayload | null> {
  if (!env.SESSION_SIGNING_KEY) return null;
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;

  const [encodedPayload, encodedSignature] = cookie
    .slice(COOKIE_NAME.length + 1)
    .split(".");
  if (!encodedPayload || !encodedSignature) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(env.SESSION_SIGNING_KEY),
      Uint8Array.from(fromBase64Url(encodedSignature)).buffer,
      new TextEncoder().encode(encodedPayload)
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload))
    ) as SessionPayload;
    if (
      typeof payload.employeeNo !== "string" ||
      typeof payload.mallCode !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function verifyAccessCode(
  supplied: string,
  expected: string | undefined
): Promise<boolean> {
  if (!expected || supplied.length < 8 || supplied.length > 128) return false;
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(supplied)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}
