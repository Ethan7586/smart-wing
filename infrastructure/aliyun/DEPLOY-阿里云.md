# 阿里云部署

运行目录统一为 `/opt/smart-wing`。前台/API 与运营后台从同一 Git 提交构建，但为两个 PM2 进程：

| 域名               | PM2 进程                | 端口 | 代码                                            |
| ------------------ | ----------------------- | ---- | ----------------------------------------------- |
| `hbbtzn.com`       | `smart-wing-storefront` | 3000 | `apps/storefront-web` + `services/commerce-api` |
| `hbbtzn.com/login` | `smart-wing-auth-web`   | 3010 | `apps/auth-web`（统一登录）                     |
| `smart.hbbtzn.com` | `smart-wing-admin-api`  | 3001 | `apps/admin-web` + `services/commerce-api`      |

## 首次迁移

```bash
git clone git@github.com:Ethan7586/smart-wing.git /opt/smart-wing
cd /opt/smart-wing
cp services/commerce-api/.env.example .env.production
# 编辑 .env.production，填写仅服务器持有的密钥
npm ci --include=dev
npm run build
cp infrastructure/aliyun/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
pm2 start infrastructure/aliyun/ecosystem.config.cjs
pm2 save
```

## 日常发布

```bash
cd /opt/smart-wing
bash infrastructure/aliyun/deploy.sh
```

发布后必须验证：

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -I https://hbbtzn.com
curl -I https://smart.hbbtzn.com
```

`.env.production` 不进 Git，也不复制到 `apps/`。Cookie 必须保持 host-only，不设置 `.hbbtzn.com` 的共享 Domain。生产必须分别配置 `SESSION_SIGNING_KEY` 与 `ADMIN_SESSION_SIGNING_KEY`（两者不得相同），否则后台域不会签发或接受会话。
