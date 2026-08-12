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

## 测试登录限流白名单

仅当公开环境明确以 `APP_ENV=test`、`AUTH_MODE=test` 运行时，才允许在服务器的
`.env.production` 中临时配置精确公网 IP：

```dotenv
TEST_LOGIN_RATE_LIMIT_BYPASS_IPS=203.0.113.10,2001:db8::10
TEST_LOGIN_RATE_LIMIT_BYPASS_FROM=2026-08-12T00:00:00Z
TEST_LOGIN_RATE_LIMIT_BYPASS_UNTIL=2026-08-13T00:00:00Z
```

- 只接受精确 IPv4/IPv6；不接受 CIDR、通配符或 `unknown`。
- 开始和到期时间都必须包含时区，整个有效窗口不超过 24 小时。配置缺失、非法、未生效、过期或过长时自动按未命中处理。
- 白名单只跳过登录失败限流；账号、密码、Membership 和 Cookie 校验均保持不变。
- 客户端 IP 必须从原测试网络访问 `https://hbbtzn.com/cdn-cgi/trace` 后复制 `ip=` 的值；代理、VPN 或移动网络变化后需要重新确认。
- 修改环境变量后运行 `pm2 startOrReload infrastructure/aliyun/ecosystem.config.cjs --update-env` 并 `pm2 save`。
- 每次更新 Caddy 前核对 `https://www.cloudflare.com/ips-v4` 与 `https://www.cloudflare.com/ips-v6`，确保可信代理范围仍是 Cloudflare 官方最新列表。
