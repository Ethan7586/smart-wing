# Smart Wing 单仓架构

## 运行拓扑

```text
hbbtzn.com ──────────────► smart-wing-storefront (3000)
                               ├─ apps/storefront-web
                               └─ services/commerce-api/src/api

smart.hbbtzn.com ────────► smart-wing-admin-api (3001)
                               ├─ apps/admin-web
                               └─ services/commerce-api/src/adminServer.ts

apps/auth-web ───────────► 统一登录 UI（待接入两域入口）
                               ├─ 登录、会员关系选择、step-up 界面
                               └─ 仅通过 commerce-api 获取真实认证结果

services/commerce-api ───► Supabase PostgreSQL
database/supabase ───────► migrations / RPC / audit baseline

apps/storefront-web ─────► smart-wing-core-read-cache (127.0.0.1:3002)
                               └─ 阿里云 Tair（北京同 VPC，只读镜像）

Web / 微信小程序 ────────► img.hbbtzn.com
                               └─ 阿里云 CDN + OSS（共享媒体源）
```

## 目录职责

- `apps/storefront-web`：员工商城页面与同源 API 入口；浏览器只访问 `/api`，不接触数据库密钥。
- `apps/admin-web`：运营后台页面；不包含 Express、数据库或 AI 密钥。
- `apps/auth-web`：统一登录的前端原型；只保存界面状态与 API 调用，不保存 token、票据或任何密钥。
- `services/commerce-api`：唯一的服务端业务目录，包含商城 API、会话、订单、账户和后台 AI API。
- `services/core-read-cache`：北京同地域共享读镜像的私有 sidecar；只加速读取，不拥有业务写权限。
- `packages/api-contract`：Member、Membership、接口错误等共享类型。
- `packages/authz`：会员状态、权限和范围的纯规则函数；服务端实际鉴权应由此扩展。
- `packages/design-system`：跨商城与后台使用的视觉令牌。
- `database/supabase`：唯一数据库演进来源。已应用迁移不可修改，只能新增。
- `infrastructure/aliyun`：两域名的 Caddy、两项 PM2 进程及发布脚本。
- `infrastructure/cloudflare`：DNS 与边缘职责，不持有 ECS 密钥。

## 当前边界

商城 API 为同源 BFF，暂不新增独立 `api.hbbtzn.com`。这避免了不必要的 CORS 和跨子域会话风险；统一登录实施时，前后台仍必须按域签发 host-only Cookie。

`apps/auth-web` 目前是已导入但未部署的 UI 原型。其中的 mock 登录、验证码与票据仅用于界面演示，不能接入生产；真实实现必须由 `services/commerce-api` 与 `packages/authz` 提供。其 `LoginPage.tsx` 和 `auth.ts` 暂列行数门禁例外，待真实 API 替换 mock 时按领域拆分。

核心缓存的完整边界、数据分级和失效方式见 `docs/CORE-BUSINESS-READ-MIRROR.md`。任何订单、支付、余额、库存预占和会员码消费仍以 PostgreSQL 事务为唯一真相，Tair 不得成为第二写库。

`apps/admin-web` 由旧项目导入，8 个超长遗留文件暂列在行数门禁例外清单中。它们不属于新代码，后续按工作台拆分后再移出例外。
