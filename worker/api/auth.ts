import type { Actor, WorkerEnv } from "./types";
import { callRpc } from "./supabase";

/**
 * 生产环境默认拒绝匿名写入。
 *
 * 当前仅在显式设置 APP_ENV=development 且 AUTH_MODE=development 时，
 * 使用 x-dev-employee-no 进行本地联调。真实上线必须替换为经过签名验证的
 * 企业 SSO/微信身份适配器，绝不能信任浏览器自行提交的用户标识。
 */
export async function resolveActor(
  request: Request,
  env: WorkerEnv
): Promise<Actor | null> {
  if (env.APP_ENV !== "development" || env.AUTH_MODE !== "development") {
    return null;
  }

  const employeeNo = request.headers.get("x-dev-employee-no");
  const mallCode =
    request.headers.get("x-mall-code") ??
    new URL(request.url).searchParams.get("mall");

  if (!employeeNo || !mallCode) {
    return null;
  }

  return callRpc<Actor | null>(env, "api_resolve_actor", {
    p_employee_no: employeeNo,
    p_mall_code: mallCode,
  });
}

export function can(actor: Actor, permission: string): boolean {
  return actor.permissions.includes(permission);
}
