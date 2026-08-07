# Kimi 3 天冲刺指令：zhudatuan.com 权限底座升级

> 目标：将 `smart wing` 从演示级鉴权升级到可审计的生产级 RBAC+Scope+会话管理体系。  
> 原则：不重构主链路业务逻辑，只增强安全边界。  
> 基线：先跑 `npm run quality` 通过后再开始改代码。

---

## Day 1 — 数据层 + RPC（阶段 0→1）

### 上午（~3h）：环境准备 + 数据模型

```bash
cd "C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop/smart wing"
git checkout -b feat/authz-membership-bridge
cp .env.example .env
npm install
npm run quality          # 必须全绿后再继续
```

- [ ] 备份现有 `supabase/migrations/` 与 `worker/api/`
- [ ] 新建迁移文件 `supabase/migrations/20260805000001_membership_access_control.sql`
- [ ] 创建表 `members`（自然人基础信息）
- [ ] 创建表 `memberships`（身份关系 + 状态：active/pending/suspended/revoked）
- [ ] 创建表 `role_assignments`（含 `scope_type` / `scope_id` / `status` / `granted_at` / `expires_at`）
- [ ] 创建表 `sessions`（session_id / actor_id / issued_at / expires_at / revoked_at）
- [ ] 创建表 `audit_events`（权限操作与关键变更审计）

> 蓝本参考：`mvp-preview/supabase/migrations/20260731000001_membership_access_control.sql`

### 下午（~4h）：RPC 函数

- [ ] 新建/修订 Supabase RPC：
  - `api_resolve_actor_v2`（解析 actor + 校验 membership 状态 + scope）
  - `api_check_permission`（权限 + scope + 状态联合校验）
  - `api_grant_role`（角色授予，带审计写入）
  - `api_revoke_role`（角色回收，带审计写入）
  - `api_create_session`（服务端会话创建）
  - `api_revoke_session`（会话吊销）
  - `api_write_audit`（审计事件写入）
- [ ] 在本地 `supabase` CLI 执行迁移并验证表结构
- [ ] 跑通 `npm run quality`

**Day 1 交付物：**
- `git diff`（仅迁移 + RPC 文件）
- 本地 `supabase status` 截图或日志
- `npm run quality` 全绿截图

---

## Day 2 — Worker 鉴权内核 + 高敏感路由（阶段 2→3）

### 上午（~3h）：鉴权内核

- [ ] 新建 `worker/api/authorizationCore.ts`
  - `authorize(actor, permission, scope)` — 必须同时校验：权限位 + scope 匹配 + membership 状态为 active
  - `can(actor, permission)` — 兼容旧接口，内部调用 `authorize`
  - `assertActiveMembership(actor)` — 状态检查封装
- [ ] 修改 `worker/api/types.ts`
  - `Actor` 接口增加 `sessionId?: string`、 `membershipStatus: string`
- [ ] 修改 `worker/api/auth.ts`
  - `resolveActor` 升级：调用 `api_resolve_actor_v2`，回传 sessionId，检查 membership 状态
  - 开发模式 `x-dev-employee-no` 仅在 `APP_ENV=development && AUTH_MODE=development` 时生效

> 蓝本参考：`mvp-preview/worker/api/authorizationCore.ts`

### 下午（~4h）：路由加权（优先级 1→3）

按以下顺序逐个加权，每改一个跑一遍 `npm run quality`：

- [ ] `handleCreateOrder` — 增加 `authorize(actor, 'order:create', { type: 'mall', id: actor.mallId })`
- [ ] `handleInternalPayment` — 增加 `authorize(actor, 'payment:internal', ...)` + 审计写入
- [ ] `handleFinanceReconciliation` — 增加 `authorize(actor, 'finance:reconcile', ...)` + 审计写入
- [ ] `handleCreateAfterSale` — 增加 `authorize(actor, 'aftersale:create', ...)`
- [ ] `handleExecuteRefund` — 增加 `authorize(actor, 'refund:execute', ...)` + 审计写入
- [ ] `handleCart` / `handleAddresses` / `handleAccountLedgers` — 增加 `can()` 校验

**Day 2 交付物：**
- `git diff`（authorizationCore.ts + auth.ts + router.ts 加权）
- 关键接口 `curl` 测试记录（401/403 语义正确）
- `npm run quality` 全绿截图

---

## Day 3 — 会话闭环 + 审计 + 验收（阶段 4→6）

### 上午（~3h）：会话与审计闭环

- [ ] 修改 `worker/api/session.ts`
  - Cookie 中增加 `sessionId` 字段
  - `readSession` 增加服务端 `sessions` 表校验（是否被吊销 / 是否过期）
  - `clearSessionCookie` 同时标记 `sessions.revoked_at`
- [ ] 路由层统一错误响应：
  - 401 → `AUTHENTICATION_REQUIRED`（未登录或会话无效）
  - 403 → `AUTHORIZATION_DENIED`（权限不足或 scope 不匹配或 membership 非 active）
- [ ] 高敏感动作统一写入 `audit_logs`：
  - 角色授予 / 回收
  - 退款执行
  - 财务对账查询
  - 订单创建（可选，视性能要求）

### 下午（~4h）：前端对齐 + 验收

- [ ] 前端 `MvpSessionBar.tsx` 对齐后端 401/403 错误码文案
- [ ] 前端登录态提示与后端状态一致
- [ ] 新增单测（`vitest`）：
  - [ ] 非活跃会员（suspended）访问订单接口 → 期望 403
  - [ ] scope 不匹配（跨 mall 访问）→ 期望 403
  - [ ] 角色回收后权限即时失效 → 期望 403
  - [ ] 会话吊销后请求被拒 → 期望 401
  - [ ] 审计事件可查（通过 RPC 查询验证）
  - [ ] 退款接口无 `finance:reconcile` 权限 → 期望 403
- [ ] 跑通 `npm run quality`
- [ ] 跑通 `npm run verify:p0`

**Day 3 交付物：**
- `git diff`（完整权限升级分支）
- `npm run quality` + `npm run verify:p0` 全绿截图
- 单测覆盖率截图
- 审计日志查询验证截图

---

## 每日自检清单（每天结束时打勾）

| 检查项 | Day 1 | Day 2 | Day 3 |
|--------|-------|-------|-------|
| `npm run quality` 全绿 | ⬜ | ⬜ | ⬜ |
| 未修改主链路业务逻辑（订单/支付/购物车核心流程） | ⬜ | ⬜ | ⬜ |
| 所有新增代码有 TypeScript 类型 | ⬜ | ⬜ | ⬜ |
| 敏感操作有审计写入 | ⬜ | ⬜ | ⬜ |
| 单测新增/通过 | ⬜ | ⬜ | ⬜ |
| `git diff` 已提交并备注里程碑 | ⬜ | ⬜ | ⬜ |

---

## 阻塞升级条件（遇到任意一条先停手汇报）

1. `npm run quality` 出现非预期失败（不是当前正在改的文件引起）
2. 需要修改 `worker/api/orderRoutes.ts` 中的订单金额计算/支付拆分逻辑
3. 需要修改 `src/context/MallContext.tsx` 中的购物车/订单状态机
4. Supabase RPC 调用出现连接或权限错误（非代码问题）
5. 发现现有 P0 功能回归失败（如：下单流程走不通）

---

## 给交接人的一句提示

> 按日推进，每天只聚焦一个主题：Day 1 只碰数据，Day 2 只碰 Worker 鉴权，Day 3 只碰闭环与验收。不要跨日混做，保证每天结束时 `quality` 全绿。
