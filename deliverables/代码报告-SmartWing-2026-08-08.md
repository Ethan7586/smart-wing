# Smart Wing 智慧翼企业福利商城 —— 完整代码报告（重写/续写交接版）

> ⚠️ **本报告部分内容已过期（2026-08-09 复核后标注）**
>
> **1. 域名全部变更。** 文中所有 `zhudatuan.com` 均已弃用。现行：
> 商城前台与业务 API `https://hbbtzn.com`（实测 health `ok`）；运营后台 `https://smart.hbbtzn.com`
> （独立静态 SPA，`/api/v1/*` 落 index.html 兜底，**尚无真实认证 API**）。
>
> **2. 第 7 章前四条 P0 已全部被修复**（2026-08-09 逐条实测确认）：
> - 7.1 router 少 `await` → [worker/api/router.ts](../worker/api/router.ts) 全部 14 处已改 `return await`
> - 7.2 `showToast` 未 memo 导致请求风暴 → 已改 `useCallback`，effect 依赖全部稳定
> - 7.3 预览壳锁死站点 → `src/features/mvp/` 整目录已删除，全库零引用
> - 7.4 Node 下 `env=undefined` → `worker/index.ts` 已加 `resolveEnv()` 回落 `process.env`
>
> **3. 仍然成立、尚未处理**：权限模型只有 permissions 白名单（无 scope / 无状态校验 / 会话不可吊销，
> `accountRoutes` 中 `can()` 命中 0 次）、前后端类目表漂移（`mallMappers` 仍缺 `service` 键）、
> 死代码 `db/` + `drizzle/` + `index.html` + `src/main.tsx` 仍在、`audit:prod` 仍有 2 个 postcss 中危。
>
> **4. 新增发现**：`scripts/verify-p0.mjs` 原先存在假绿缺陷（四项全被 Cloudflare 拦截、一项未验到仍报
> "通过"并 exit 0），已于 2026-08-09 修复为：失败 exit 1、未验证 exit 2，并改用 curl 原生 TLS 绕过指纹拦截。
>
> **5. 从未验证过的部分**：运营后台的账号与权限矩阵。截至标注时点，`smart.hbbtzn.com` 没有认证 API，
> 无法验证任何后台角色权限。
>
> **6. 第 2.2 节"三套部署目标冲突"的权重已过时**：实际只有一套在跑。生产为阿里云 ECS +
> Caddy + 单 Node 进程（SSR 与 API 同源）。文中分析过的 `deploy/nginx.conf` 与
> `deploy/deploy-aliyun.sh` 已于 2026-08-09 删除（描述的是被取代的旧方案），现行方案以
> `deploy/DEPLOY-阿里云.md` + `deploy/Caddyfile` 为准。

生成时间：2026-08-08
分析对象：`C:\Users\Ethan\Desktop\01-Projects\03-client-and-contract-projects\02-pre-contract\Shop\smart wing`
分析方式：全量源码通读 + 实际执行质量门禁 + 本地生产构建 + 本地起服务探测接口
用途：作为**新 session 从零/接续编写完整代码**的唯一事实来源（single source of truth）

> 本报告与目录上层的 `SmartWing_全面分析报告.md`（2026-08-05，偏 SEO/UI/部署）不重复。
> 本报告只讲**代码事实、契约、缺陷、重写顺序**。所有结论均标注证据来源，可复核。

---

## 0. 一页纸结论

| 维度 | 结论 |
|---|---|
| 代码质量基线 | 高于同类 MVP。金额用整数分、幂等键、审计只追加、RLS 全开、PII 加密 —— 数据层设计是这个项目最值钱的部分 |
| 类型/测试/构建 | 实测通过：`tsc --noEmit` 0 错；`vitest` 8 文件 26 用例全绿；`vinext build` 成功 |
| 完整质量门禁 | **实测不通过**。`npm run quality` 会在 3 处失败（格式 3 个 md、行数 1 个 md、生产依赖审计 2 个中危） |
| 运行时 | **有 1 个致命级、2 个高危级缺陷**（详见第 7 章 P0），其中错误映射失效与前端请求死循环已实证/可推证 |
| 部署 | **三套互相冲突的部署目标同时存在**（Cloudflare Workers / Vercel / 阿里云 PM2），当前阿里云路径跑不通 API |
| 权限 | 只有 `permissions` 数组白名单，没有 scope、没有会员状态、会话不可吊销（交接包已识别，尚未做） |
| 建议 | **不推倒重来**。保留 `supabase/migrations` + `worker/api` 契约，重写 `src/` 前端与 Worker 的错误/鉴权内核 |

**给新 session 的一句话**：数据库和 API 契约是资产，直接继承；前端状态层和部署层是负债，重写。

---

## 1. 工程事实（实测）

### 1.1 规模

| 区域 | 文件数 | 行数 | 说明 |
|---|---|---|---|
| `src/` | 110 | 14,503 | 前端全部（16 屏幕 / 32 组件 / 31 功能模块 / 8 mock 数据文件） |
| `worker/` | 19 | 1,121 | 边缘 API 全部（含 4 个测试文件） |
| `supabase/migrations/` | 21 | 2,477 | 生产数据库唯一权威 |
| `drizzle/` | 4 | 516 | **D1 遗留，已死** |
| `app/` | 4 | 43 | Next App Router 入口壳 |
| `scripts/` | 5 | 350 | 目录导入 / 行数门禁 / P0 冒烟 |
| `db/` | 2 | 75 | **D1 遗留，已死（零引用）** |

### 1.2 技术栈（`package.json`）

- 运行时要求 `node >= 22.13.0`（本机实测 v25.9.0，可用）
- React 19.2.8 / react-dom 19.2.8 / next 16.2.11（仅作类型与 App Router 约定）
- 构建器 **vinext 0.0.50**（Cloudflare 出品的 "Next.js on Vite"），Vite 8.1.5
- Tailwind CSS 4.2.1（`@tailwindcss/postcss`）
- 数据库 Supabase PostgreSQL（`ap-northeast-1` 东京），通过 REST `/rest/v1/rpc/*` 调用
- 测试 vitest 4.1.10（`environment: node`）
- 部署工具链同时存在 wrangler 4 / vercel.json / deploy 目录的 pm2+nginx

### 1.3 质量门禁实测结果

`npm run quality` = `check:format && check:lines && lint && test && build && audit:prod`

| 步骤 | 结果 | 详情 |
|---|---|---|
| `check:format`（prettier） | ❌ 失败 | `deploy/DEPLOY-阿里云.md`、`HANDOFF-Kimi-zhudatuan-2026-08-05.md`、`对接包-权限系统与生产对接-给-Kimi-账号-2026-08-05.md` |
| `check:lines`（<299 行） | ❌ 失败 | `deploy/DEPLOY-阿里云.md` 312 行 |
| `lint`（`tsc --noEmit`） | ✅ 通过 | 0 错误 |
| `test`（vitest） | ✅ 通过 | 8 文件 / 26 用例 / 406ms |
| `build`（vinext build） | ✅ 通过 | 5 阶段全过，产出 `dist/client` + `dist/server` |
| `audit:prod` | ❌ 失败 | postcss ≤8.5.22 GHSA-fxqj-rqcc-2cmp（2 个 moderate，经 next 传递） |

> 注意：`npm run lint` **没有 ESLint**。项目里没有任何 eslint 配置，`node_modules/.bin` 里也没有 eslint/oxlint 二进制。
> "lint" 实际只是类型检查。`tsconfig.json` 也未开 `noUnusedLocals`，所以未使用的导入不会报错
> （例：`src/context/MallContext.tsx:2` 导入了从未使用的 `UserCoupon`、`OrderStatus`）。

### 1.4 Git 状态（重要风险）

```
HEAD = 861d329 feat: harden internal payment refunds and reconciliation
工作区：139 个已跟踪文件被修改（+4071 / −6748），28 个未跟踪文件
```

未跟踪但属于**真实功能代码**的文件（未进版本库，丢失即不可恢复）：

- `worker/api/addressRoutes.ts`、`worker/api/cartRoutes.ts`
- `worker/api/http.test.ts`、`worker/api/publicRoutes.test.ts`
- `supabase/migrations/20260725090000_server_cart.sql`
- `supabase/migrations/20260725100000_encrypted_address_book.sql`
- `supabase/migrations/20260726110000_delete_delivery_address.sql`
- `src/features/catalog/categoryCatalogSearch.ts`、`src/features/product/ProductDetailActionPanel.tsx`
- `src/screens/CategoryPageData.ts`、`src/screens/MvpDeliveryPage.tsx`、`src/utils/inventory.ts`
- `scripts/verify-p0.mjs`、`vercel.json`、`deploy/`、`.github/`

大规模 diff 的主因是 `.prettierrc.json` 把 `printWidth` 设成 **240**，全库被重新折行；
真实逻辑变更混在里面，无法用 `git diff` 区分。

**新 session 第一件事：先提交或打标签固化当前工作区，再动手。**

---

## 2. 运行时架构（含三套部署目标的冲突）

### 2.1 请求链路（Cloudflare Workers 路径 —— 唯一能跑通的路径）

```
浏览器
  │  fetch(同源 /api/**, credentials: 'same-origin')
  ▼
worker/index.ts  ── default { fetch(request, env, ctx) }
  │   1) routeApi(request, env)  → 命中 /api/health 或 /api/v1/* 就返回
  │   2) 否则交给 vinext/server/app-router-entry（SSR / RSC）
  ▼
worker/api/router.ts  ── 路径匹配 + resolveActor + 错误映射
  ▼
worker/api/*Routes.ts ── 权限判定 can() + 输入校验 + PII 加解密
  ▼
worker/api/supabase.ts ── POST {SUPABASE_URL}/rest/v1/rpc/{fn}
                          header 带 service_role key（仅服务端持有）
  ▼
Supabase PostgreSQL ── security definer RPC（事务/行锁/幂等/审计）
```

关键设计（这是对的，务必保留）：

- 浏览器永远拿不到数据库密钥；所有写操作都在一个 `security definer` 函数里完成事务
- 27+ 张业务表全部 `enable row level security` 且 `revoke all from anon, authenticated`
- 所有 RPC 都 `revoke ... from public, anon, authenticated` 再 `grant execute ... to service_role`

### 2.2 三套部署目标同时存在（必须二选一）

| 目标 | 证据 | 状态 |
|---|---|---|
| **Cloudflare Workers** | `vite.config.ts` + `@cloudflare/vite-plugin` + `dist/server/wrangler.json` | ✅ 唯一能跑通 API 的路径 |
| **Vercel** | `vercel.json`：`framework: nextjs` / `outputDirectory: dist/client` | ❌ 目录与框架声明互相矛盾；Vercel 不会执行 Worker |
| **阿里云 ECS** | `deploy/`：pm2 + systemd + nginx + `deploy-aliyun.sh` | ❌ 见下方实测 |

### 2.3 实测证据：阿里云/Node 路径下 API 全线 500

本地执行 `npm run build` 后 `npm run start`（即 `vinext start`，与 pm2/systemd 用的是同一条命令），探测结果：

| 请求 | 状态码 | 响应体 |
|---|---|---|
| `GET /` | 200 | 250,573 字节，SSR 正常 |
| `GET /mini-program` | 200 | 250,904 字节，SSR 正常 |
| `GET /api/health` | **500** | 裸文本 `Internal Server Error`（不是 JSON） |
| `GET /api/v1/products?...` | **500** | 裸文本 `Internal Server Error` |
| `GET /api/v1/auth/session` | **500** | `{"error":{"code":"INTERNAL_ERROR",...}}` |

**根因**：`node_modules/vinext/dist/server/prod-server.js` 的 `resolveAppRouterHandler` 这样调用：

```js
workerEntry.fetch(request, void 0, createNodeExecutionContext())
//                          ^^^^^^ env 恒为 undefined
```

`worker/index.ts:7` 把这个 `undefined` 直接传给 `routeApi(request, env)`，
下游 `env.SUPABASE_URL` / `env.SESSION_SIGNING_KEY` 全部抛 `TypeError`。
代码里**没有任何 `process.env` 兜底**。

结论：`deploy/` 那套（pm2 起 `vinext start` + nginx 把 `/api/` 反代到 Cloudflare Worker）
是"前端在阿里云、API 在 Cloudflare"的拼接方案，而且 `deploy/nginx.conf` 里的
`proxy_pass https://your-worker.your-account.workers.dev/api/` **占位符从未替换**。

另一个连带问题：`deploy/nginx.conf` 只 `listen 80`（HTTPS 段全被注释），
而会话 cookie 是 `Secure`（`worker/api/session.ts:41`）。
**纯 HTTP 下浏览器会丢弃该 cookie —— 登录接口返回 200，但用户永远处于未登录态。**

---

## 3. 代码模块地图

### 3.1 `worker/` —— 边缘 API（1,121 行，19 文件）

| 文件 | 行 | 职责 | 备注 |
|---|---|---|---|
| `index.ts` | 13 | Worker 入口，API 优先于 SSR | |
| `api/router.ts` | 108 | 路径匹配、`resolveActor`、错误码映射表 | **含 P0 缺陷，见 7.1** |
| `api/auth.ts` | 34 | `resolveActor()` + `can(actor, permission)` | 权限模型过于简单，见 7.4 |
| `api/session.ts` | 72 | HMAC-SHA256 签名 cookie（8h）、`verifyAccessCode` 常量时间比较 | 无 sessionId，不可吊销 |
| `api/types.ts` | 24 | `WorkerEnv` / `Actor` / `RequestContext` | |
| `api/http.ts` | 35 | JSON 响应 + 7 个安全响应头 + 统一错误信封 | 设计良好 |
| `api/supabase.ts` | 48 | RPC 调用封装，错误体截断 2KB | |
| `api/crypto.ts` | 43 | AES-256-GCM 加解密 + SHA-256 | |
| `api/validation.ts` | 117 | 下单/支付/售后/退款入参校验 | 有对应单测 |
| `api/routerSupport.ts` | 27 | `actorScope()`、32KB body 上限 | |
| `api/publicRoutes.ts` | 132 | health / login / logout / products | |
| `api/accountRoutes.ts` | 57 | bootstrap / accounts / account-ledgers | **缺 `can()` 权限判定** |
| `api/orderRoutes.ts` | 133 | orders / payment / after-sales / refund / reconciliation | |
| `api/cartRoutes.ts` | 44 | 服务端购物车 CRUD | |
| `api/addressRoutes.ts` | 56 | 加密地址簿 CRUD | |
| `api/*.test.ts` | 4 文件 | session / http / publicRoutes / validation | **无 router / order / cart / address 测试** |

### 3.2 `src/` —— 前端（14,503 行，110 文件）

```
src/
├── App.tsx                     五端分发 + MVP 预览壳判定
├── main.tsx + ../index.html    【死代码】遗留的 Vite SPA 入口，构建不引用
├── context/
│   ├── MallContext.tsx         281 行，全局状态中枢（含 P0 缺陷，见 7.2）
│   ├── MallContext.types.ts    Context 契约（56 个字段）
│   ├── useDeviceNavigation.ts  hash 路由 + 五端模式切换
│   ├── useProductionSync.ts    启动时拉目录/会话/账户/订单/流水
│   ├── mallMappers.ts          API DTO → 前端领域模型（含类目漂移，见 7.5）
│   └── checkoutSelectedCart.ts 移动端结算链路（与 PC 端不是同一条，见 6.2）
├── services/
│   ├── productionApi.ts        255 行，唯一的服务端访问层（契约见第 5 章）
│   ├── mallService.ts          【演示态】localStorage 商城，继承链见下
│   ├── mallOrders.ts           【演示态】本地拆单+扣款模拟（仅测试引用）
│   ├── mallCatalogCart.ts      【演示态】
│   └── mallState.ts            【演示态】localStorage 键 + mall 级命名空间
├── screens/        16 个 PC 页面（home / category / detail / cart / checkout /
│                   payment-result / user-center / orders / order-detail /
│                   after-sale / coupons / balance / mvp-console / mvp-delivery /
│                   architecture）
├── features/       31 文件：android / tablet / miniprogram / laptop 四端页面
│                   + catalog（类目检索）+ checkout（PC 结算模型）
│                   + product（详情面板）+ architecture（Canvas 架构图）
│                   + mvp（预览壳）
├── components/     32 文件：common / home / laptop / mobile
├── domain/catalog/taxonomy.ts  前端三级类目表（与数据库那份已漂移，见 7.5）
├── adapters/frontendData.ts    领域模型 → 展示模型（FrontendProduct/Order）
├── utils/          finance.ts（分制分账）、inventory.ts（库存文案）
├── mock/           8 文件演示数据（products-a/b/c/d、orders、accounts、base）
└── types/index.ts  237 行全局类型
```

继承链：`MallState → MallCatalogCart → MallOrders → MallService`（单例 `mallService`）。
这一整条链是**未登录演示态**用的 localStorage 实现；登录后所有数据以服务端为准。

### 3.3 三层数据模型（重写时必须理解的核心）

```
ApiProduct / ApiOrder ...        ← productionApi.ts，服务端 DTO（camelCase，金额=分）
        │ mapApiProduct / mapApiOrder（context/mallMappers.ts）
        ▼
Product / Order / CartItem ...   ← types/index.ts，前端领域模型（金额=元，浮点）
        │ toFrontendProduct / toFrontendOrders（adapters/frontendData.ts）
        ▼
FrontendProduct / FrontendOrder  ← 展示模型，给旧版组件用的兼容别名
                                   （imageUrl/image/price/originalPrice/... 一堆同义字段）
```

**这是当前架构最大的复杂度来源**：第三层纯粹是为了兼容早期组件命名而存在的字段别名层。
重写时应该**砍掉第三层**，让组件直接消费第二层。

---

## 4. 数据模型与 RPC 契约

### 4.1 表清单（27 张业务表 + 1 张安全表）

| 域 | 表 |
|---|---|
| 组织身份 | `tenants` `enterprises` `malls` `departments` `users` |
| 权限 | `roles` `permissions` `role_permissions` `user_roles` |
| 商品供应链 | `suppliers` `products` `skus` `inventory` |
| 福利资金 | `welfare_accounts` `account_ledgers`（禁更新禁删除） |
| 交易 | `carts` `cart_items` `orders` `sub_orders` `order_items` |
| 支付售后 | `payments` `payment_allocations` `refunds` `after_sales` |
| 治理 | `audit_logs`（禁更新禁删除） `idempotency_keys` |
| 后补 | `delivery_addresses`（加密地址簿） `catalog_taxonomy_nodes` `login_attempts` |

强约束（写代码时必须遵守）：

- 所有金额字段 `bigint`，单位**分**，带 `check (>= 0)`
- `orders.paid_cents <= payable_cents` 是数据库级 check
- `inventory.reserved_qty <= available_qty` 是数据库级 check
- `account_ledgers` / `audit_logs` 上挂了 `reject_immutable_change()` 触发器，**update/delete 直接抛异常**
- `idempotency_keys` 主键 `(mall_id, scope, idempotency_key)`，同键不同 `request_hash` → `IDEMPOTENCY_CONFLICT`
- `payments` / `refunds` 有 `unique (mall_id, idempotency_key)`

### 4.2 RPC 清单（Worker 唯一的数据库入口）

| RPC | 参数 | 用途 | 迁移来源 |
|---|---|---|---|
| `api_health()` | — | 4 张关键表存在性 + 表总数 | 070000 |
| `api_catalog` | `mall_slug, category, limit, offset` | 商品目录（19 列） | 010000 → **013000 重定义** |
| `api_resolve_actor` | `employee_no, mall_code` | 解析 Actor（含 roles/permissions） | 070000 |
| `api_bootstrap` | `tenant, enterprise, mall` | 商城/企业名称 | 070000 |
| `api_accounts` | `+user_id` | 福利卡/餐卡余额 | 070000 |
| `api_account_ledgers` | `+user_id` | 账户流水（limit 200） | 113000 |
| `api_order_views` | `+user_id` | 订单读模型（含 items + 分渠道已付） | 101500 |
| `api_create_order` | `items, recipient_cipher, idem_key, hash, req_id, ua` | 库存原子预占 + 按供应商拆子单 + 审计 | 070000 |
| `api_pay_internal` | `order_id, welfare_cents, meal_cents, idem_key, ...` | 行锁扣款 + 流水 + 支付单 + 分摊 + 审计 | 070000 → **014000 强化** |
| `api_execute_internal_refund` | `after_sale_id, refund_cents, idem_key, ...` | 按支付单顺序原路退回 + 审计 | 014000 |
| `api_finance_reconciliation` | `tenant, enterprise, mall` | 6 类勾稽校验报告 | 014000 |
| `api_after_sales` / `api_create_after_sale` | `+user_id, ...` | 售后查询/提交 | 113000 |
| `api_cart_items` / `api_upsert_cart_item` / `api_delete_cart_item` | `+user_id, ...` | 服务端购物车 | 090000 |
| `api_delivery_addresses` / `api_upsert_delivery_address` / `api_delete_delivery_address` | `+user_id, ...` | 加密地址簿 | 100000 / 110000 |
| `api_login_allowed` / `api_record_login_failure` / `api_clear_login_failures` | `ip_hash` | 登录限流（5 次/15 分钟封禁） | 113000 |
| `api_catalog_taxonomy_audit` | — | 测试目录归类质量审计 | 013000 |

`api_finance_reconciliation` 的 6 类勾稽（这是财务可审计性的核心，重写务必保留）：
`PAID_PAYMENT_MISMATCH` / `PAYMENT_ALLOCATION_MISMATCH` / `PAYMENT_LEDGER_MISMATCH` /
`REFUND_LEDGER_MISMATCH` / `OVER_REFUND` / `REFUNDED_STATUS_MISMATCH`

### 4.3 迁移演进史（21 个文件，不可改写历史）

```
070000 生产底座（27 表 + RLS + 核心 RPC + 种子数据）
072000 完整性修正      090000 目录扩容        101500 订单读模型
113000 售后 + 流水 + 登录限流                 121500 登录重置返回值修复
234000 测试目录标记    003000/005000 导入 RPC  006000/008000 统计 RPC
007000 归类            009000 双语三级类目 + 自动归类正则
010000 双语目录 API    011000 目录治理        012000 ABO 类目重校准
013000 强制严格三级类目（api_catalog 再次重定义 + 触发器）
014000 支付/退款/对账强化（pg_advisory_xact_lock + payment_allocations）
090000 服务端购物车    100000 加密地址簿      110000 地址删除
```

**注意 013000 的行为变更**：`api_catalog` 加了两个硬过滤 ——
`is_valid_catalog_taxonomy_path(l1,l2,l3)` 且 `classification_confidence >= 0.8`，
并且返回的 `category_code` 列实际取的是 `p.taxonomy_l1`。
后果：070000 种子的两个演示商品（`product-rice` / `product-movie`，taxonomy 为 NULL）
**不再出现在目录接口里**。目录内容完全依赖 ABO 测试目录导入脚本。

---

## 5. API 契约（前后端唯一交界面）

统一响应约定：

- 成功：`{ ...payload, requestId }`，响应头 `x-request-id`
- 失败：`{ error: { code, message, requestId } }`
- 响应头恒定：`cache-control: no-store`、`x-content-type-options: nosniff`、`x-frame-options: DENY`、`referrer-policy: no-referrer`、`cross-origin-resource-policy: same-site`、`permissions-policy: camera=(), geolocation=(), microphone=()`

| 方法 | 路径 | 鉴权 | 权限码 | 幂等键 | 备注 |
|---|---|---|---|---|---|
| GET | `/api/health` | 公开 | — | — | `status: ok \| degraded` |
| GET | `/api/v1/products` | 公开 | — | — | `mall/category/limit(1-100)/cursor` |
| POST | `/api/v1/auth/login` | 公开 | — | — | body `{accessCode}`；限流 5 次/15 分钟 |
| POST | `/api/v1/auth/logout` | 公开 | — | — | 清 cookie |
| GET | `/api/v1/auth/session` | 会话 | — | — | 未登录 401 `AUTHENTICATION_REQUIRED` |
| GET | `/api/v1/bootstrap` | 会话 | **无判定** | — | 返回 actor + scope |
| GET | `/api/v1/accounts` | 会话 | **无判定** | — | 余额 |
| GET | `/api/v1/account-ledgers` | 会话 | **无判定** | — | 流水 |
| GET/PUT | `/api/v1/cart` | 会话 | `order:create` | — | PUT 为 upsert |
| DELETE | `/api/v1/cart/:itemId` | 会话 | `order:create` | — | |
| GET/PUT | `/api/v1/addresses` | 会话 | `order:create` | — | 需 `PII_ENCRYPTION_KEY`，否则 503 |
| DELETE | `/api/v1/addresses/:id` | 会话 | `order:create` | — | |
| GET | `/api/v1/orders` | 会话 | `order:read:own` | — | |
| POST | `/api/v1/orders` | 会话 | `order:create` | **必需** | 缺键 400 `IDEMPOTENCY_KEY_REQUIRED` |
| POST | `/api/v1/orders/:id/payments/internal` | 会话 | `order:create` | **必需** | 福利+餐卡合计必须等于应付 |
| GET | `/api/v1/after-sales` | 会话 | `order:read:own` | — | **前端未消费** |
| POST | `/api/v1/after-sales` | 会话 | `order:create` | — | |
| POST | `/api/v1/after-sales/:id/refund` | 会话 | `finance:refund` | **必需** | **无任何前端入口** |
| GET | `/api/v1/finance/reconciliation` | 会话 | `finance:reconcile` | — | **无任何前端入口** |

错误码字典（`worker/api/router.ts:89-105` 定义，**但当前不生效，见 7.1**）：

| 域异常 | HTTP | code |
|---|---|---|
| `IDEMPOTENCY_CONFLICT` | 409 | 相同幂等键不能用于不同请求 |
| `INSUFFICIENT_INVENTORY` | 409 | 部分商品库存不足 |
| `INSUFFICIENT_ACCOUNT_BALANCE` | 409 | 账户余额不足 |
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `ORDER_NOT_PAYABLE` | 409 | 订单当前状态不可支付 |
| `ACCOUNT_NOT_ACTIVE` | 409 | 账户当前不可用 |
| `PAYMENT_TOTAL_MISMATCH` | 422 | 扣款合计必须等于应付 |
| `SKU_NOT_AVAILABLE` | 422 | 订单中存在无效商品 |
| `INVALID_AFTER_SALE_INPUT` | 422 | 售后信息不完整 |
| `ORDER_NOT_AFTER_SALE_ELIGIBLE` | 409 | 订单状态不可申请售后 |
| `AFTER_SALE_AMOUNT_EXCEEDED` | 422 | 超过实付金额 |
| `AFTER_SALE_ALREADY_EXISTS` | 409 | 已有处理中工单 |
| `AFTER_SALE_NOT_REFUNDABLE` | 409 | 当前不可退款 |
| `REFUND_AMOUNT_EXCEEDED` | 422 | 超过可退金额 |
| `REFUND_CHANNEL_UNSUPPORTED` | 422 | 含未接入退款通道 |
| `IDEMPOTENCY_KEY_INVALID` | 422 | 幂等键无效 |

环境变量（`worker/api/types.ts` + `.env.example`）：

| 变量 | 必需性 | 说明 |
|---|---|---|
| `SUPABASE_URL` | 生产必需 | 缺失 → `SUPABASE_NOT_CONFIGURED` |
| `SUPABASE_SERVICE_ROLE_KEY` | 生产必需 | **只能在服务端** |
| `SESSION_SIGNING_KEY` | 生产必需 | **≥32 字节**，否则 login 抛异常 |
| `DEMO_LOGIN_CODE` | 阶段验收必需 | 访问码（8-128 字符） |
| `PII_ENCRYPTION_KEY` | 下单/地址簿必需 | **base64 编码的恰好 32 字节**，否则 503 |
| `APP_ENV` / `AUTH_MODE` | 开发用 | 两者同时 `development` 才启用 `x-dev-employee-no` 头 |

---

## 6. 前端数据流

### 6.1 启动序列

```
app/page.tsx（服务端读 host）
  → <App initialHost>
    → MallProvider
      ├─ mallService 从 localStorage 恢复演示态（同步）
      └─ useProductionSync useEffect([])
         ├─ loadCompleteCatalog()：/products 分页拉取，最多 60 页 × 100 条
         └─ getSession() 成功 → setSessionStatus('authenticated')
                              → refreshProductionData()
                                 Promise.all([bootstrap, accounts, orders, ledgers])
            getSession() 失败 → setSessionStatus('guest')
      └─ 另一个 useEffect：authenticated 后拉服务端购物车 + 地址簿（**此处有死循环，见 7.2**）
```

### 6.2 两条并行的结算链路（严重的架构分裂）

| 链路 | 入口 | 分账规则 | 使用端 |
|---|---|---|---|
| A：`useCheckoutModel.handleSubmitOrder` | `screens/CheckoutPage.tsx` | 用户可手动调节福利/餐卡金额，`calculatePaymentAllocation` 计算 | **仅 PC** |
| B：`MallContext.checkoutSelectedCart` → `checkoutSelectedCartRequest` | `context/checkoutSelectedCart.ts` | 硬编码"先扣福利卡、再扣餐卡"，不可调 | 小程序 / Android / 平板 / Laptop |

两条链路都调 `createOrder` + `payWithInternalAccounts`，但**分账逻辑、错误文案、幂等键前缀各写一遍**。
第三条 `mallOrders.submitCheckoutOrder`（localStorage 模拟拆单+扣款）现在**只有测试还在调**，
但仍然打进生产包。

重写时应统一为**一个** checkout 用例函数，端只负责 UI。

### 6.3 状态归属

- 登录后：商品、订单、余额、流水、购物车、地址簿 —— **全部服务端权威**
- 未登录：全部走 `mallService` 的 localStorage 演示态（按 `mallId` 命名空间隔离）
- `localStorage` 键前缀 `zhy_mall_*`（`services/mallState.ts:4-14`）

---

## 7. 已确认缺陷清单

### 7.1 【P0 · 致命】router 的 try/catch 对所有 handler 失效，全部域错误码不生效

**位置**：`worker/api/router.ts:18-110`

```ts
try {
  if (url.pathname === '/api/health') return handleHealth(request, env, requestId);   // ← 第 19 行
  ...
  if (url.pathname === `${API_PREFIX}/orders`) {
    return request.method === 'POST' ? handleCreateOrder(...) : handleOrders(...);    // ← 第 64 行
  }
} catch (error) { /* 16 条错误码映射 */ }
```

async 函数里 `return somePromise` 时，promise 的 rejection **不会被同一个 try 捕获**
（必须写 `return await somePromise`）。所有 handler 都是被 `return` 而非 `await return` 的，
因此第 89-108 行那张错误映射表**从未生效过**。

**实测证据（A/B 对照，同一环境同一次运行）**：

- `GET /api/health` → 走 `return handleHealth(...)` → 返回**裸文本** `Internal Server Error`（异常逃逸出 routeApi）
- `GET /api/v1/auth/session` → 走 `const actor = await resolveActor(...)`（真的 await 了）→ 返回 **JSON** `{"error":{"code":"INTERNAL_ERROR",...}}`

**业务后果**：库存不足、余额不足、幂等冲突、金额不符 —— 用户看到的全是无 code、无 requestId 的
500 裸文本。前端 `ProductionApiError` 拿不到 `code`，`await response.json()`
在裸文本上还会**再抛一个 JSON 解析异常**（`src/services/productionApi.ts:165`），
导致真实原因二次丢失。

**修复**：把所有 `return handleX(...)` 改成 `return await handleX(...)`；
同时 `productionApi.apiFetch` 要对非 JSON 响应体做保护性解析。

---

### 7.2 【P0 · 高危】登录后购物车/地址簿无限请求循环

**位置**：`src/context/MallContext.tsx:59-63`

```ts
useEffect(() => {
  if (sessionStatus !== 'authenticated') return;
  void refreshServerCart().catch(...);      // → setCart(...)
  void refreshServerAddresses().catch(...); // → setAddresses(...)
}, [sessionStatus, refreshServerCart, refreshServerAddresses, showToast]);
//                                          ^^^^^^^^^ 每次渲染都是新引用
```

`showToast` 定义在 `MallContext.tsx:42`，是**普通箭头函数，没有 useCallback**，
每次渲染都换新引用 → effect 每次渲染都重跑 → `setCart` / `setAddresses` 传入新数组 →
必然触发重渲染 → effect 再跑。**登录状态下形成不间断的 `GET /api/v1/cart` +
`GET /api/v1/addresses` 请求风暴。**

（项目里没有 ESLint，`react-hooks/exhaustive-deps` 这类规则一条都没跑过，所以没被发现。）

**修复**：`showToast`/`removeToast` 用 `useCallback` 包裹并从依赖里移除，
或把 effect 依赖收敛为 `[sessionStatus]`。

---

### 7.3 【P0 · 高危】线上域名 zhudatuan.com 整站不可交互

**位置**：`src/features/mvp/MvpPreviewShell.tsx:6,18` + `src/App.tsx:81-93`

```ts
export function isMvpPreviewHost(initialHost = '') {
  return /(^|\.)zhudatuan\.com(?::\d+)?$/i.test(host);   // ← 生产域名命中预览壳
}
...
<div className="pointer-events-none select-none">{children}</div>  // ← 全站禁用点击
```

且 `App.tsx` 的预览分支里**只渲染 HeaderBar + HomePage + Footer，没有渲染 `MvpSessionBar`**
（登录入口在这个组件里）。

后果：`zhudatuan.com` 上没有登录入口、点不动任何东西、只能看首页。
`deliverables/P0-验收清单` 里"核心交易闭环可演示"的结论**在该域名上无法复现**。

另外 `MvpSessionBar.tsx:28,48` 上的 `data-mvp-preview-allowed="true"`
是**完全无人消费的死属性**（全库无任何 CSS/JS 读取它），推测是想做"预览壳里放行登录框"
但没写完。

**修复**：明确 zhudatuan.com 是生产域还是预览域，二选一；如果要保留预览锁，
必须让 `MvpSessionBar` 与登录弹窗渲染在壳内且 `pointer-events-auto`。

---

### 7.4 【P1】权限模型只有白名单，没有 scope / 状态 / 可吊销会话

**位置**：`worker/api/auth.ts:38-40`、`worker/api/session.ts`、`worker/api/accountRoutes.ts`

```ts
export function can(actor: Actor, permission: string): boolean {
  return actor.permissions.includes(permission);   // 只看有没有这个字符串
}
```

具体缺口：

1. 不校验 actor 状态（`users.status` 只在 `api_resolve_actor` 里查了一次 `= 'active'`，
   会话有效期内改状态不生效）
2. 不校验 scope（哪个企业/商城/部门的哪些数据）—— 目前靠 `actorScope()` 把
   tenant/enterprise/mall/user 全部塞进 RPC 参数，安全性依赖每个 RPC 自己写对 where 条件
3. 会话是无状态签名 cookie，**没有 sessionId，服务端无法吊销**，8 小时内必然有效
4. `/api/v1/bootstrap`、`/accounts`、`/account-ledgers` **完全没有 `can()` 判定**
   （`worker/api/accountRoutes.ts:20,43,58`），只要有会话就能读
5. 退款 `finance:refund` 和对账 `finance:reconcile` 只发给了 `role-mall-admin`
   （`014000` 迁移），但**没有任何管理端 UI**，只能靠 curl 调用

`HANDOFF-Kimi-zhudatuan-2026-08-05.md` 已完整规划了 RBAC+scope+审计的改造方案
（members / memberships / roles / role_assignments / sessions / audit_events 六张表 +
`authorizationCore.ts`），可直接照做。

---

### 7.5 【P1】前后端三级类目表已漂移，虚拟卡券全部被当成实物

**位置**：`src/domain/catalog/taxonomy.ts` vs `supabase/migrations/20260725009000` + `013000`

三处不一致：

1. 数据库 L1 类目码有 `service`（权益与本地生活），但
   `src/context/mallMappers.ts:5-17` 的 `CATEGORY_MAP` **没有 `service` 键** →
   所有权益类商品都 fallback 成"企业福利专区"
2. `mallMappers.ts:28` 判定 `isVirtual = product.categoryCode === 'virtual-card'`，
   而 013000 迁移之后 `api_catalog` 返回的 `category_code` 实际是 `taxonomy_l1`
   （取值只可能是 food/appliance/digital/home/personal/supermarket/apparel/welfare/service）
   → **`virtual-card` 永远不匹配，所有虚拟卡券/电影票都被标成 `physical`**，
   连带影响 `allowedAccounts` 和履约时效文案
3. `taxonomy.ts:148` 的 `digital_mobile_accessory: ['digital', 'digital_mobile']`，
   但同文件 `SMART_WING_TAXONOMY` 的 `digital` 子节点里**根本没有 `digital_mobile`**
   → 该叶子永远判不成严格路径

根因：同一套类目在**前端 TS 常量**和**数据库 `catalog_taxonomy_nodes` 表**里各维护一份。
重写时应只保留数据库一份，前端通过接口获取。

---

### 7.6 【P2】死代码与遗留资产

| 对象 | 证据 | 处置建议 |
|---|---|---|
| `db/index.ts` + `db/schema.ts` | 全库零引用（已 grep 验证）；依赖 D1 binding 而 `.openai/hosting.json` 里 `d1: null` | 删除 |
| `drizzle/*.sql`（4 个，516 行） | D1 版本的重复 schema，与 Supabase 迁移并行维护 | 删除或明确归档 |
| `index.html` + `src/main.tsx` | Vite SPA 入口，vinext 构建不引用 | 删除 |
| `src/services/mallOrders.submitCheckoutOrder` | 仅 `mallService.test.ts` 调用 | 连同演示态一起决策 |
| `productionApi.listAfterSales` / `deleteAddress` | 定义了但无任何 UI 调用 | 补 UI 或删 |
| `data-mvp-preview-allowed` 属性 | 无消费方 | 删除或补实现 |
| `src/mock/products-a~d.ts`（856 行） | 未登录演示数据，打进生产包 | 改为动态 import 或删除 |

### 7.7 【P2】工程约定的副作用

`.prettierrc.json` 的 `printWidth: 240` + `scripts/check-line-budget.mjs` 的 299 行上限
组合起来，产生的是**"行数达标但单行极长"**的代码。
典型如 `worker/api/addressRoutes.ts:48`（一行里塞了 6 个字段校验 + 正则 + 类型判定）、
`supabase/migrations/20260725014000` 的整段 plpgsql。

这个组合让"300 行约束"变成了指标游戏，实际可读性反而更差。
建议重写时改为 `printWidth: 120` + 单文件 300 行，并引入 ESLint（含
`react-hooks/exhaustive-deps`，本可提前发现 7.2）。

---

## 8. 未实现 / 半实现能力

明确未做（需甲方资质，`docs/生产型MVP开发说明.md` 第 3 节已列）：

- 企业 SSO / 微信登录 / 手机号认证（当前是单一 `DEMO_LOGIN_CODE` 访问码，
  且登录后**硬编码** `employeeNo='SW0001'`、`mallCode='SMART_WING_DEMO'`，
  见 `worker/api/publicRoutes.ts:75-76`）
- 微信支付 / 支付宝 / 银联（`payments.channel` 枚举里有，但没有任何调用）
- 供应商商品/库存/订单/发货/退款对接
- 短信/邮件/企微通知、客服工单 SLA、发票与结算

代码里有但没接完：

| 能力 | 后端 | 前端 |
|---|---|---|
| 售后工单列表 | ✅ `api_after_sales` | ❌ 无页面消费 |
| 内部退款执行 | ✅ `api_execute_internal_refund` | ❌ 无入口 |
| 财务对账报告 | ✅ `api_finance_reconciliation` | ❌ 无入口 |
| 优惠券 | ❌ 无表无 RPC | ⚠️ `CouponsPage` 纯 localStorage 演示 |
| 收藏夹 | ❌ 无表无 RPC | ⚠️ 纯 localStorage |
| 商城切换 | ❌ 会话绑定单一 mall | ⚠️ UI 有，登录后被拦截提示 |

---

## 9. 必须继承的工程约定

来自 `docs/代码与前端开发规范.md`（这份规范本身写得很好，建议原样继承）：

1. 提交前跑 `npm run quality`；CI 同命令（`.github/workflows/quality.yml`，Node 22.13.0）
2. `src/screens` 只编排；业务逻辑进 `src/features` / `src/services` / `src/context`
3. `worker/api` 负责 HTTP/认证/权限/校验/编排；**写库只经受控 RPC**
4. 命名：组件与类型 PascalCase，变量/函数/路由参数 camelCase，数据库字段 snake_case
5. 禁止无约束 `any`；外部输入先 `unknown` 再校验
6. 金额服务端与数据库统一整数分，前端只用于展示
7. 收货人/电话/地址必须加密；日志禁止记录完整 PII、访问码、cookie、支付凭据
8. **迁移只增不改**；审计与流水只追加
9. 提交信息 `type(scope): summary`；资金/身份/权限/PII 改动需第二人复核

---

## 10. 重写 / 续写路线图

### 阶段 0 · 止血（0.5 天，必须最先做）

1. `git add -A && git commit`（或打 tag）固化当前 139 个改动 + 28 个未跟踪文件
2. 修 7.1（`return await`）、7.2（`useCallback`）、7.3（预览壳判定）
3. 补 `.env`，本地跑通 `/api/health` 返回 `status: ok`
4. 修好 3 个 md 格式 + `deploy/DEPLOY-阿里云.md` 拆分至 <299 行，让 `npm run quality` 真绿

### 阶段 1 · 部署目标定案（0.5 天）

三选一并删掉另外两套：

- **推荐 Cloudflare Workers**：`env` 天然注入，与 `worker/index.ts` 设计一致，改动最小
- 若必须阿里云：给 `routeApi` 加 `process.env` 兜底，nginx 上 HTTPS，
  否则 `Secure` cookie 必丢；`vercel.json` 直接删

### 阶段 2 · 鉴权内核（2 天）

按 `HANDOFF-Kimi-zhudatuan-2026-08-05.md` 阶段 1-2 执行：
新增 `members/memberships/roles/permissions/role_permissions/role_assignments/sessions/audit_events`
+ `worker/api/authorizationCore.ts` 的 `authorize(actor, permission, scope)`，
`can()` 保留但内部转调 `authorize`。给 `/bootstrap` `/accounts` `/account-ledgers` 补判定。

### 阶段 3 · 前端重写（3-4 天）

1. 砍掉展示模型层（`adapters/frontendData.ts`），组件直接消费领域模型
2. 合并两条结算链路为一个 `useCheckout` 用例，五端只写 UI
3. `MallContext` 拆分为 `SessionContext` / `CatalogContext` / `CartContext` / `OrderContext`
4. 演示态（`mallService` 四件套 + `src/mock`）改为动态加载，或彻底移除
5. 类目表只保留数据库一份，前端从接口取（修 7.5）

### 阶段 4 · 补测试（1 天）

当前 26 个用例**零覆盖** router / orderRoutes / cartRoutes / addressRoutes / auth / crypto。
优先补：

- router 的错误码映射（能直接回归 7.1）
- 幂等键缺失 → 400、同键不同 hash → 409
- 权限拒绝 403、未登录 401
- `encryptJson`/`decryptJson` 往返 + 错误密钥长度
- 分账合计 ≠ 应付 → 422

### 阶段 5 · 管理端与验收（2 天）

补退款审批、对账报告、售后工单三个管理页（后端已就绪，只差 UI），
然后跑 `npm run quality` + `npm run verify:p0` 出验收快照。

---

## 11. 新 session 开场提示词（可直接复制）

```
项目：C:\Users\Ethan\Desktop\01-Projects\03-client-and-contract-projects\02-pre-contract\Shop\smart wing
先完整阅读 deliverables/代码报告-SmartWing-2026-08-08.md，再动手。

约束（不可违反）：
1. 金额一律整数分，写库只经 supabase/migrations 里的 security definer RPC
2. 迁移只增不改；审计日志与账户流水只追加
3. 单文件 <299 行；提交前 npm run quality 必须全绿
4. 不新增无约束 any；外部输入先 unknown 后校验
5. 浏览器永不接触 SUPABASE_SERVICE_ROLE_KEY

本次任务：先做报告第 10 章「阶段 0 止血」的 4 项，
每项完成后给出 git diff、执行命令输出、以及对应的复测方式。
```

---

## 附录 A：关键文件速查

| 想改什么 | 看这个文件 |
|---|---|
| 加一个 API | `worker/api/router.ts` + 对应 `*Routes.ts` + `worker/api/validation.ts` |
| 改权限判定 | `worker/api/auth.ts` |
| 改会话 | `worker/api/session.ts` |
| 改数据库 | 新建 `supabase/migrations/{时间戳}_{名称}.sql` |
| 改前端调用 | `src/services/productionApi.ts` |
| 改全局状态 | `src/context/MallContext.tsx` + `MallContext.types.ts` |
| 改 DTO→领域模型映射 | `src/context/mallMappers.ts` |
| 改结算（PC） | `src/features/checkout/useCheckoutModel.ts` |
| 改结算（移动/平板） | `src/context/checkoutSelectedCart.ts` |
| 改路由/五端切换 | `src/context/useDeviceNavigation.ts` |
| 改类目 | `src/domain/catalog/taxonomy.ts` + `supabase/migrations/20260725009000` |
| 改构建/部署 | `vite.config.ts`（CF）/ `vercel.json`（V）/ `deploy/`（阿里云） |

## 附录 B：本报告的验证方式

| 结论 | 复核命令 |
|---|---|
| 类型检查通过 | `npx tsc --noEmit` |
| 测试通过 | `npx vitest run` |
| 构建通过 | `npm run build` |
| 行数门禁失败 | `node scripts/check-line-budget.mjs` |
| 格式门禁失败 | `npx prettier --check --ignore-unknown .` |
| 依赖审计失败 | `npm audit --omit=dev` |
| API 在 Node 下 500 | `npm run build && npm run start`，另开终端请求 `http://127.0.0.1:3000/api/health` |
| 未提交改动规模 | `git status --short` / `git diff --shortstat` |
