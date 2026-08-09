# Smart Wing 单仓架构

## 运行拓扑

```text
hbbtzn.com ──────────────► smart-wing-storefront (3000)
                               ├─ apps/storefront-web
                               └─ services/commerce-api/src/api

smart.hbbtzn.com ────────► smart-wing-admin-api (3001)
                               ├─ apps/admin-web
                               └─ services/commerce-api/src/adminServer.ts

services/commerce-api ───► Supabase PostgreSQL
database/supabase ───────► migrations / RPC / audit baseline
```

## 目录职责

- `apps/storefront-web`：员工商城页面与同源 API 入口；浏览器只访问 `/api`，不接触数据库密钥。
- `apps/admin-web`：运营后台页面；不包含 Express、数据库或 AI 密钥。
- `services/commerce-api`：唯一的服务端业务目录，包含商城 API、会话、订单、账户和后台 AI API。
- `packages/api-contract`：Member、Membership、接口错误等共享类型。
- `packages/authz`：会员状态、权限和范围的纯规则函数；服务端实际鉴权应由此扩展。
- `packages/design-system`：跨商城与后台使用的视觉令牌。
- `database/supabase`：唯一数据库演进来源。已应用迁移不可修改，只能新增。
- `infrastructure/aliyun`：两域名的 Caddy、两项 PM2 进程及发布脚本。
- `infrastructure/cloudflare`：DNS 与边缘职责，不持有 ECS 密钥。

## 当前边界

商城 API 为同源 BFF，暂不新增独立 `api.hbbtzn.com`。这避免了不必要的 CORS 和跨子域会话风险；统一登录实施时，前后台仍必须按域签发 host-only Cookie。

`apps/admin-web` 由旧项目导入，8 个超长遗留文件暂列在行数门禁例外清单中。它们不属于新代码，后续按工作台拆分后再移出例外。
