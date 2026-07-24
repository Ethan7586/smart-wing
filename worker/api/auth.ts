import type { Actor, WorkerEnv } from "./types";

interface UserScopeRow {
  tenant_id: string;
  enterprise_id: string;
  mall_id: string;
  mall_code: string;
  user_id: string;
  employee_no: string;
}

interface CodeRow {
  code: string;
}

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

  const scope = await env.DB.prepare(
    `SELECT
       u.tenant_id,
       u.enterprise_id,
       m.id AS mall_id,
       m.code AS mall_code,
       u.id AS user_id,
       u.employee_no
     FROM users u
     JOIN malls m
       ON m.tenant_id = u.tenant_id
      AND m.enterprise_id = u.enterprise_id
     WHERE u.employee_no = ?
       AND m.code = ?
       AND u.status = 'active'
       AND m.status = 'active'
     LIMIT 1`
  )
    .bind(employeeNo, mallCode)
    .first<UserScopeRow>();

  if (!scope) {
    return null;
  }

  const [roleRows, permissionRows] = await Promise.all([
    env.DB.prepare(
      `SELECT r.code
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.tenant_id = ?
         AND ur.user_id = ?`
    )
      .bind(scope.tenant_id, scope.user_id)
      .all<CodeRow>(),
    env.DB.prepare(
      `SELECT DISTINCT p.code
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.tenant_id = ?
         AND ur.user_id = ?`
    )
      .bind(scope.tenant_id, scope.user_id)
      .all<CodeRow>(),
  ]);

  return {
    tenantId: scope.tenant_id,
    enterpriseId: scope.enterprise_id,
    mallId: scope.mall_id,
    mallCode: scope.mall_code,
    userId: scope.user_id,
    employeeNo: scope.employee_no,
    roles: roleRows.results.map((row) => row.code),
    permissions: permissionRows.results.map((row) => row.code),
  };
}

export function can(actor: Actor, permission: string): boolean {
  return actor.permissions.includes(permission);
}

