# 权限系统实施基线

## 不变量

1. 一个会话只绑定一个 `member_id + membership_id`；Cookie 中不包含权限列表或全部身份。
2. `commerce-api` 每个请求解析当前 Membership，状态、授权版本或角色变更立即生效。
3. 客户端只能提供资源 ID，不能提供 tenant、mall、supplier、owner 等 scope。服务端先加载资源行，再调用 `@smart-wing/authz` 的纯函数。
4. 员工订单读取必须命中 `self` scope；企业或商城 context 不能扩大成同事订单读取权限。
5. 高风险动作（退款、授予角色、租户管理）必须具备新鲜的 MFA step-up。
6. 每个敏感审计事件写入 `membership_id` 与 `granted_via`（角色、权限、实际命中的 scope）。
7. 供应商只访问自己的 `sub_orders`；收货信息的加密快照单独挂在子订单，不向供应商开放父订单。

## 现阶段数据库边界

当前 RPC 经 `SUPABASE_SERVICE_ROLE_KEY` 调用，Service Role 会绕过 Supabase RLS；因此现有 RLS 不是租户隔离的实际边界。新迁移仍保留该兼容路径，但把它明确标记为过渡态。

生产切换有两条可选路径：

- 目标方案：使用受限的用户数据库执行身份与经验证的请求声明，让 RLS 成为真实第二道防线；必须同时审查所有 `SECURITY DEFINER` RPC。
- 过渡方案：继续只允许 Service Role 调 RPC，但为每个 `api_*` 函数增加跨租户契约测试，使用 B 租户的 Membership 调用 A 租户资源必须返回空或拒绝。

不能只在 Service Role 请求中设置 JWT claims；这不会恢复 RLS。

## 发布顺序

1. 在隔离 Supabase 环境执行 `20260809093000_membership_authorization_foundation.sql`，检查回填 Membership 与 scope。
2. 执行 `20260809094000_supplier_fulfillment_pii_boundary.sql`，确认所有历史子订单已拥有独立收货快照。
3. 建立资源级 RPC 读取器：按订单/售后 ID 从数据库加载真实 scope。
4. 将路由改为 `resolveMembershipContext → load resource → decide`，随后才设置 `AUTH_MODE=membership`。
5. 接入凭据、找回、MFA 与单次核销 ticket；管理端会话使用独立 `__Host-hbbtzn_admin_session` Cookie。
6. 在预发布环境执行跨租户、角色回收、cookie shadowing、MFA 过期、供应商 PII 隔离测试。

`apps/auth-web` 是 UI 原型，不是第三个生产域名。上线时应分别部署到主站与后台的登录入口，且由各域签发自己的 host-only Cookie。
