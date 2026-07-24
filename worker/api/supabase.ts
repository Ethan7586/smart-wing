import type { WorkerEnv } from "./types";

const MAX_ERROR_BODY = 2_000;

export function isSupabaseConfigured(env: WorkerEnv): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function callRpc<T>(
  env: WorkerEnv,
  functionName: string,
  parameters: Record<string, unknown> = {}
): Promise<T> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const response = await fetch(
    `${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/${encodeURIComponent(functionName)}`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(parameters),
    }
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, MAX_ERROR_BODY);
    throw new Error(`SUPABASE_RPC_FAILED:${functionName}:${response.status}:${detail}`);
  }

  return (await response.json()) as T;
}
