# Smart Wing Monorepo

| 目录                        | 职责                                             |
| --------------------------- | ------------------------------------------------ |
| `apps/storefront-web`       | `hbbtzn.com` 员工福利商城前端与同源 API 适配入口 |
| `apps/admin-web`            | `smart.hbbtzn.com` 运营后台前端                  |
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
