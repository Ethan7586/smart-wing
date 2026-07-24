import { env } from "cloudflare:workers";

export interface SmartWingEnv {
  DB: D1Database;
  APP_ENV?: string;
  AUTH_MODE?: string;
}

export function getRuntimeEnv(): SmartWingEnv {
  const runtime = env as unknown as Partial<SmartWingEnv>;
  if (!runtime.DB) {
    throw new Error(
      "D1 binding `DB` is unavailable. Configure .openai/hosting.json and the local Cloudflare binding."
    );
  }
  return runtime as SmartWingEnv;
}

export function getDb(): D1Database {
  return getRuntimeEnv().DB;
}

export async function firstOrNull<T>(
  statement: D1PreparedStatement
): Promise<T | null> {
  return statement.first<T>();
}

