# Smart Wing Monorepo

> 项目总纲入口：[`PROJECT-MASTER-START-HERE.md`](./PROJECT-MASTER-START-HERE.md)  
> 产品、商业、会员、权限、资格、VI、代码与发布的统一说明：[`docs/SMART-WING-MALL-MASTER-CHARTER.md`](./docs/SMART-WING-MALL-MASTER-CHARTER.md)

| 目录                        | 职责                                             |
| --------------------------- | ------------------------------------------------ |
| `apps/storefront-web`       | `hbbtzn.com` 员工福利商城前端与同源 API 适配入口 |
| `apps/admin-web`            | `smart.hbbtzn.com` 运营后台前端                  |
| `apps/auth-web`             | 两域共用的统一登录 UI 原型（本地端口 3002）      |
| `services/commerce-api`     | 商城 API、会话、订单、账户与后台 AI 服务端代码   |
| `packages/api-contract`     | 前后端共享接口与会员关系类型                     |
| `packages/authz`            | 会员状态、权限与数据范围规则                     |
| `packages/design-system`    | 两端共用设计令牌                                 |
| `database/supabase`         | Supabase 迁移、RPC、审计基线                     |
| `infrastructure/aliyun`     | Caddy、PM2、部署说明                             |
| `infrastructure/cloudflare` | DNS/边缘职责说明                                 |

## 常用命令

```bash
npm install
npm run quality
npm run verify:p0
```

生产部署只使用 `infrastructure/aliyun/deploy.sh`。密钥仅保存在服务器 `/opt/smart-wing/.env.production`，不提交 Git。
