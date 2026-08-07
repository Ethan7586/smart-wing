# zhudatuan.com（smart wing）整体验收/对接交接包（给 Kimi）

生成时间：2026-08-05  
用途：把 `smart wing` 项目权限系统与生产交付的状态，直接交接给另一位 Kimi 账号，避免重复摸底。

## 一句话目标

在不重构主链路的前提下，把当前 MVP 从“演示级内测闭环”升级到“可审计的生产级闭环”：
- 鉴权从“仅 permission 列表”升级为“会员状态 + scope + 角色权限”
- 会话可吊销、会话状态可验证
- 高敏感操作服务端强校验
- 全量可复测、可追溯、可回滚

---

## 你现在接手的仓库与现状

- 目标代码仓库：`smart wing`
- 当前站点目标：`zhudatuan.com`
- 基线结论：P0 内测通过，主交易闭环可跑，但权限底座尚未完善。

重点文件：
- [P0验收清单](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/deliverables/P0-验收清单（zhudatuan.com-内测）.md)
- [生产型MVP开发说明](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/docs/生产型MVP开发说明.md)
- [路由总入口](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/worker/api/router.ts)
- [鉴权入口](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/worker/api/auth.ts)
- [Actor定义](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/worker/api/types.ts)
- [订单/售后/支付](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/worker/api/orderRoutes.ts)
- [会话实现](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/worker/api/session.ts)
- [SQL基线](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/supabase/migrations/20260724070000_production_mvp.sql)
- [质量门禁](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/package.json)
- [冒烟脚本](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/scripts/verify-p0.mjs)

可复用参考（成熟蓝本）：
- [mvp-preview 会员权限设计](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/mvp-preview/docs/membership-access-design.md)
- [mvp-preview 授权核心](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/mvp-preview/worker/api/authorizationCore.ts)
- [mvp-preview 会员路由](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/mvp-preview/worker/api/membershipRoutes.ts)
- [mvp-preview 会员权限迁移脚本](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/mvp-preview/supabase/migrations/20260731000001_membership_access_control.sql)

---

## 当前差距（必须先处理）

1. 鉴权只检查 `actor.permissions`，缺少 actor 状态和 scope 校验；
2. 无完整会员关系/角色授予范围管理表与审计链路；
3. 会话为签名 cookie，缺少 sessionId 与服务端吊销能力；
4. 管理动作没有统一走“授权 + 审计 + 事务”模型；
5. 对外依赖（SSO/支付/供应链）还在后续链路，不影响当前内部权限基线搭建。

---

## 对接执行清单（直接接手就能做）

### 阶段0：准备（0.5 天）
- 新建分支 `feat/authz-membership-bridge`
- 拉取当前最新主干
- 先跑基线：`npm run quality`（基线通过后再改）
- 备份现有 `smart wing` 的 `supabase/migrations` 与 `worker/api`

### 阶段1：数据与 RPC（1 天）
新增以下能力（保留现有表，不删旧模型）：
- `members`（自然人）
- `memberships`（身份关系 + 状态）
- `roles / permissions / role_permissions`
- `role_assignments`（含 `scope_type/scope_id/status/start/expire`）
- `sessions`（会话管理）
- `audit_events`（权限操作与关键变更）

新增/修订 RPC：
- 鉴权解析、管理权限校验、角色授予/回收、成员状态变更、审计写入

### 阶段2：Worker 鉴权内核（1 天）
在 Worker 侧建立/引入统一鉴权：
- 新增 `authorizationCore.ts`
- `authorize(actor, permission, scope)`：必须同时校验权限+scope+状态
- `can(actor, permission)` 兼容旧接口时仍调用 `authorize`
- `resolveActor` 补 sessionId 回传与状态检查

建议改造文件：
- [smart wing/worker/api/auth.ts](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/worker/api/auth.ts)
- [smart wing/worker/api/types.ts](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/worker/api/types.ts)

### 阶段3：路由逐步加权（1~2 天）
优先级从高到低：
1. `handleCreateOrder / handleInternalPayment / handleFinanceReconciliation`
2. `handleAfterSales / handleCreateAfterSale / handleExecuteRefund`
3. `handleCart / handleAddresses / handleAccountLedgers`
4. 补 `admin/membership` 管理接口（列表、状态、授权）

### 阶段4：会话与审计闭环（0.5 天）
- 每次请求返回 401/403 语义统一；
- 会话失效/吊销触发后端拒绝；
- 高敏感动作（`role`、`refund`、`finance`）写入 `audit_logs` 并关联 `requestId`。

### 阶段5：前端同步（1 天）
- 权限态展示（按钮显示/不可点）可做增强，不作为安全边界；
- 会话错误码文案统一；
- `MvpSessionBar` 与登录态提示与后端 401/403 对齐。

### 阶段6：验收与发布前检查（0.5 天）
- `npm run quality`
- `npm run verify:p0`
- 增加单测：
  - 非活跃会员禁止访问；
  - scope 不匹配被拦截；
  - 成员回收后权限即失效；
  - 会话吊销后请求被拒；
  - 关键审计事件可查；
  - 退款/财务接口仍能正确拒绝。

---

## 关键接口一览（当前）

- `GET /api/health`
- `GET /api/v1/products`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/session`
- `GET /api/v1/bootstrap`
- `GET /api/v1/accounts`
- `GET /api/v1/account-ledgers`
- `GET /api/v1/cart` / `DELETE /api/v1/cart/:itemId`
- `GET /api/v1/addresses` / `DELETE /api/v1/addresses/:id`
- `GET /api/v1/orders` / `POST /api/v1/orders`
- `POST /api/v1/orders/:id/payments/internal`
- `GET /api/v1/after-sales`
- `POST /api/v1/after-sales`
- `POST /api/v1/after-sales/:id/refund`
- `GET /api/v1/finance/reconciliation`

对应路由实现：
- [worker/api/router.ts](/C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing/worker/api/router.ts)

---

## 给 Kimi 的“直接提示词”（可复制）

> 你接手的是 `smart wing`，请先完整阅读交接包后执行。  
> 目标是把鉴权从 `actor.permissions` 升级到 `authorize(scope)`，并保证所有写操作服务端可追责。  
> 每做完一个里程碑，提交：`git diff`、执行命令结果、数据库变更记录、测试截图。

推荐命令顺序：
```bash
cd "C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing"
cp .env.example .env
npm install
npm run quality
```

---

## 附：当前风险说明（对外汇报必须提）

- 外部企业 SSO/微信真实身份未接入（当前为 demo 登录）；
- 外部支付渠道与供应商接口仍是外部资料依赖；
- Cloudflare 403 Challenge 可能影响自动化脚本（`verify:p0` 可能出现警示，但不代表接口逻辑故障）。

---

## 交接结论

`smart wing` 结构已足够稳定，可直接向“RBAC+scope+审计”的方向改造。  
请按上面阶段推进，不要改前后端主链路业务逻辑，只增强安全和权限边界，即可快速到 9.0+ 质检水平。

