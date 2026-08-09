> ⛔ **域名已作废（2026-08-09 标注）**：`zhudatuan.com` 已弃用。
> 现行域名：前台与业务 API `https://hbbtzn.com`，运营后台 `https://smart.hbbtzn.com`。
> 清单中的权限底座（RBAC + scope + 可吊销会话 + 审计）**至今仍未实施**，条目本身依然有效。

# zhudatuan.com 权限底座升级验收清单（可打勾交付）

> 适用：P0 内测通过后，RBAC+Scope+会话管理体系升级完成时的验收。  
> 验收人：__________  验收日期：__________  版本：v1.0

---

## 一、基线门禁（必须先通过）

| # | 检查项 | 通过标准 | 状态 | 验收人签字 |
|---|--------|----------|:----:|:---------:|
| 1.1 | `npm run quality` 全链路通过 | 0 error, 0 warning, test 全绿 | ⬜ | |
| 1.2 | `npm run verify:p0` 核心交易闭环回归 | 端到端下单/支付/售后流程可复测 | ⬜ | |
| 1.3 | 行数门禁 | 单文件 ≤ 299 行（`scripts/check-line-budget.mjs`） | ⬜ | |
| 1.4 | 未破坏主链路 | 订单金额计算、支付拆分、购物车状态机无变更 | ⬜ | |

---

## 二、数据层验收（membership + session + audit）

| # | 检查项 | 通过标准 | 状态 | 验收人签字 |
|---|--------|----------|:----:|:---------:|
| 2.1 | `members` 表已创建 | `\d members` 可见，含自然人基础字段 | ⬜ | |
| 2.2 | `memberships` 表已创建 | 含 `status`（active/pending/suspended/revoked） | ⬜ | |
| 2.3 | `role_assignments` 表已创建 | 含 `scope_type` / `scope_id` / `granted_at` / `expires_at` | ⬜ | |
| 2.4 | `sessions` 表已创建 | 含 `session_id` / `issued_at` / `expires_at` / `revoked_at` | ⬜ | |
| 2.5 | `audit_events` 表已创建 | 含 `request_id` 关联、可查询 | ⬜ | |
| 2.6 | 现有表未删除 | `users` / `orders` / `products` 等原表数据完整 | ⬜ | |
| 2.7 | RPC 函数已部署 | `api_resolve_actor_v2` / `api_check_permission` / `api_grant_role` / `api_revoke_role` / `api_create_session` / `api_revoke_session` / `api_write_audit` 可调用 | ⬜ | |

---

## 三、Worker 鉴权内核验收

| # | 检查项 | 通过标准 | 状态 | 验收人签字 |
|---|--------|----------|:----:|:---------:|
| 3.1 | `authorizationCore.ts` 已创建 | 文件存在，有 `authorize()` / `can()` / `assertActiveMembership()` | ⬜ | |
| 3.2 | `authorize()` 联合校验 | 同时校验：permission + scope + membership 状态 | ⬜ | |
| 3.3 | `can()` 兼容旧接口 | 旧路由调用 `can(actor, perm)` 行为不变 | ⬜ | |
| 3.4 | `resolveActor` 升级 | 调用 `api_resolve_actor_v2`，回传 `sessionId`，检查 membership 状态 | ⬜ | |
| 3.5 | Actor 类型扩展 | `Actor` 接口含 `sessionId` + `membershipStatus` | ⬜ | |
| 3.6 | 开发模式隔离 | `x-dev-employee-no` 仅在 `APP_ENV=development && AUTH_MODE=development` 生效 | ⬜ | |

---

## 四、路由加权验收（高敏感接口）

> 方法：对每个接口分别测试「正常权限通过」「权限不足拒绝」「scope 不匹配拒绝」「membership 非 active 拒绝」四种场景。

| # | 接口 | `authorize` 已加 | 正常通过 | 无权限→403 | 跨 scope→403 | 非 active→403 | 审计写入 |
|---|------|:---------------:|:-------:|:---------:|:------------:|:-------------:|:-------:|
| 4.1 | `POST /api/v1/orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.2 | `POST /api/v1/orders/:id/payments/internal` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.3 | `GET /api/v1/finance/reconciliation` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.4 | `POST /api/v1/after-sales` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.5 | `POST /api/v1/after-sales/:id/refund` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.6 | `PUT /api/v1/cart` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.7 | `PUT /api/v1/addresses` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 4.8 | `GET /api/v1/account-ledgers` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

---

## 五、会话管理验收

| # | 检查项 | 通过标准 | 状态 | 验收人签字 |
|---|--------|----------|:----:|:---------:|
| 5.1 | Cookie 含 `sessionId` | 登录后响应头 `set-cookie` 含 sessionId 字段 | ⬜ | |
| 5.2 | 会话服务端校验 | `readSession` 查询 `sessions` 表确认未吊销/未过期 | ⬜ | |
| 5.3 | 会话吊销生效 | 调用 `api_revoke_session` 后，原 Cookie 请求返回 401 | ⬜ | |
| 5.4 | 登出即吊销 | `POST /api/v1/auth/logout` 同时标记 `sessions.revoked_at` | ⬜ | |
| 5.5 | 过期会话拒绝 | 修改 `sessions.expires_at` 为过去时间，请求返回 401 | ⬜ | |

---

## 六、错误码统一验收

| # | 场景 | 期望状态码 | 期望错误码 | 实际结果 | 状态 |
|---|------|-----------|-----------|----------|:----:|
| 6.1 | 未登录访问业务接口 | 401 | `AUTHENTICATION_REQUIRED` | | ⬜ |
| 6.2 | 登录但 membership 为 suspended | 403 | `AUTHORIZATION_DENIED` | | ⬜ |
| 6.3 | 登录但无权限位 | 403 | `AUTHORIZATION_DENIED` | | ⬜ |
| 6.4 | 登录但 scope 不匹配（跨 mall） | 403 | `AUTHORIZATION_DENIED` | | ⬜ |
| 6.5 | 会话已吊销 | 401 | `AUTHENTICATION_REQUIRED` | | ⬜ |
| 6.6 | 幂等性冲突 | 409 | `IDEMPOTENCY_CONFLICT` | | ⬜ |
| 6.7 | 库存不足 | 409 | `INSUFFICIENT_INVENTORY` | | ⬜ |
| 6.8 | 余额不足 | 409 | `INSUFFICIENT_ACCOUNT_BALANCE` | | ⬜ |

---

## 七、审计日志验收

| # | 检查项 | 通过标准 | 状态 | 验收人签字 |
|---|--------|----------|:----:|:---------:|
| 7.1 | 角色授予写入审计 | `api_grant_role` 后 `audit_events` 有记录 | ⬜ | |
| 7.2 | 角色回收写入审计 | `api_revoke_role` 后 `audit_events` 有记录 | ⬜ | |
| 7.3 | 退款执行写入审计 | `handleExecuteRefund` 后 `audit_events` 有记录 | ⬜ | |
| 7.4 | 财务对账写入审计 | `handleFinanceReconciliation` 后 `audit_events` 有记录 | ⬜ | |
| 7.5 | 审计记录含 `requestId` | 每条审计可与 HTTP 请求关联 | ⬜ | |
| 7.6 | 审计记录可查询 | 通过 RPC 或 SQL 可按时间/用户/操作类型筛选 | ⬜ | |

---

## 八、前端对齐验收

| # | 检查项 | 通过标准 | 状态 | 验收人签字 |
|---|--------|----------|:----:|:---------:|
| 8.1 | `MvpSessionBar` 对齐 401 | 会话过期/无效时前端提示"登录已失效，请重新登录" | ⬜ | |
| 8.2 | `MvpSessionBar` 对齐 403 | 权限不足时前端提示"暂无权限访问此功能" | ⬜ | |
| 8.3 | 登录态提示一致 | 前端显示的登录状态与后端 `session` 接口返回一致 | ⬜ | |
| 8.4 | 未破坏原有 UI | 首页/分类/购物车/订单页视觉与交互无退化 | ⬜ | |

---

## 九、单测新增验收

| # | 测试用例 | 通过标准 | 状态 | 验收人签字 |
|---|----------|----------|:----:|:---------:|
| 9.1 | 非活跃会员禁止访问订单 | `suspended` 用户 `POST /api/v1/orders` → 403 | ⬜ | |
| 9.2 | scope 不匹配被拦截 | mall A 用户访问 mall B 商品 → 403 | ⬜ | |
| 9.3 | 角色回收后权限失效 | revoke 后原权限接口 → 403 | ⬜ | |
| 9.4 | 会话吊销后请求被拒 | revoke session 后任意业务接口 → 401 | ⬜ | |
| 9.5 | 关键审计事件可查 | 操作后通过 RPC 查询到对应审计记录 | ⬜ | |
| 9.6 | 退款接口权限拒绝 | 无 `refund:execute` 权限 → 403 | ⬜ | |
| 9.7 | 原有 P0 单测未退化 | `npm run test` 原有用例全部通过 | ⬜ | |

---

## 十、交付物清单

| # | 交付物 | 状态 | 备注 |
|---|--------|:----:|------|
| 10.1 | Git 分支 `feat/authz-membership-bridge` 完整 diff | ⬜ | |
| 10.2 | 数据库迁移文件（含回滚语句） | ⬜ | |
| 10.3 | RPC 函数定义文档 | ⬜ | |
| 10.4 | `npm run quality` 全绿截图 | ⬜ | |
| 10.5 | `npm run verify:p0` 通过截图 | ⬜ | |
| 10.6 | 单测覆盖率报告 | ⬜ | |
| 10.7 | 接口测试记录（curl/Postman/脚本） | ⬜ | |
| 10.8 | 审计日志查询验证截图 | ⬜ | |
| 10.9 | 本验收清单（全部打勾） | ⬜ | |

---

## 验收结论

| 项目 | 结果 |
|------|------|
| 验收通过项数 | ____ / 60 |
| 验收不通过项数 | ____ |
| 遗留风险项 | ________________ |
| 是否允许合并到主干 | ⬜ 是  ⬜ 否（需修复后复验） |

**验收人签字：**________________  **日期：**________________

---

> 使用说明：每完成一项在「状态」列打勾（替换 ⬜ 为 ✅），全部打勾后本清单即为交付凭证。
