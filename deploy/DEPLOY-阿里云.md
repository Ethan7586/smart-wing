# zhudatuan.com 阿里云部署指南

> 目标：将 Smart Wing（智慧翼企业福利商城）部署到阿里云，绑定域名 zhudatuan.com
> 架构：单一部署目标——前端 SSR 与 API 是同一个 Node 进程（`vinext start`），
> Caddy 只做反向代理 + 自动 HTTPS，不再拆分到独立的 Cloudflare Worker。
> 预估时间：1~2 小时
> 前置条件：已购买阿里云 ECS / 轻量应用服务器（建议 2核4G 以上）

---

## 一、服务器准备

### 1.1 购买阿里云服务器（如未购买）

推荐：**阿里云轻量应用服务器** 或 **ECS**

- 地域：选择靠近用户的地域（如华东 1 杭州）
- 配置：2核 4G 起步
- 系统：Ubuntu 22.04 LTS（推荐）
- 带宽：3Mbps 起步

### 1.2 登录服务器

```bash
ssh root@<你的服务器公网IP>
```

### 1.3 安装基础依赖

```bash
apt update && apt upgrade -y

# 安装 Caddy（官方源，自带自动 HTTPS）
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# 安装 Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version  # 应显示 v22.x.x

# 安装 PM2（进程管理）
npm install -g pm2
```

---

## 二、上传项目代码

### 方式 A：从 Git 仓库拉取（推荐）

```bash
cd /var/www
git clone <你的Git仓库地址> zhudatuan
cd zhudatuan
```

### 方式 B：直接从本机上传

```bash
# 本机（Windows 用 Git Bash）
cd "C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop"
zip -r zhudatuan-deploy.zip smart-wing/ -x "smart-wing/node_modules/*" "smart-wing/.git/*" "smart-wing/.next/*" "smart-wing/dist/*"
scp zhudatuan-deploy.zip root@<服务器IP>:/root/
```

```bash
# 服务器
cd /root && unzip zhudatuan-deploy.zip && mv smart-wing /var/www/zhudatuan
```

---

## 三、配置生产环境变量（关键步骤）

生产密钥**绝不能**进 `ecosystem.config.js` / `zhudatuan.service`（这两个文件在 git 里）。
在服务器上单独创建 `.env.production`（已在 `.gitignore` 里，不会被提交）：

```bash
cd /var/www/zhudatuan
cp .env.example .env.production
nano .env.production
# 填入真实值：SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SESSION_SIGNING_KEY /
# PII_ENCRYPTION_KEY / DEMO_LOGIN_CODE
chmod 600 .env.production
```

`worker/index.ts` 在 Node 环境下会自动从 `process.env` 读取这些值（Cloudflare Workers
环境下则原生注入 `env`，两条路径共用同一份代码，无需分叉）。

---

## 四、安装依赖并构建

```bash
cd /var/www/zhudatuan
npm install
npm run build
ls -la dist/server/index.js && echo "构建成功"
```

---

## 五、启动应用服务

### 5.1 使用 PM2 启动（推荐）

```bash
cd /var/www/zhudatuan
pm2 start deploy/ecosystem.config.js
pm2 startup
pm2 save
pm2 status
pm2 logs zhudatuan
```

`ecosystem.config.js` 已配置 `--env-file=.env.production`，无需再手动 export。

### 5.2 或使用 systemd

```bash
cp /var/www/zhudatuan/deploy/zhudatuan.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now zhudatuan
systemctl status zhudatuan
journalctl -u zhudatuan -f
```

---

## 六、配置 Caddy（反代 + 自动 HTTPS）

```bash
cp /var/www/zhudatuan/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

不需要手动申请/续期证书、不需要 `certbot`——Caddy 首次收到该域名的请求时会自动向
Let's Encrypt 签发证书，到期前自动续期。前提是域名已解析到本机公网 IP，且防火墙放行
80/443（Let's Encrypt 走 80 做 HTTP-01 验证）。

---

## 七、域名解析

在阿里云域名控制台添加解析记录：

| 记录类型 | 主机记录 | 记录值             | TTL |
| -------- | -------- | ------------------ | --- |
| A        | @        | <你的服务器公网IP> | 600 |
| A        | www      | <你的服务器公网IP> | 600 |

> 注意：DNS 解析商保持"仅 DNS"（不要开启任何第三方 CDN 代理），域名的公网 IP 必须
> 直接指向这台已备案的阿里云服务器，否则可能影响备案有效性和境内访问速度。

---

## 八、防火墙配置

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
# 或在阿里云控制台 → ECS → 安全组 → 入方向规则放行 80/443/22
```

---

## 九、验证部署

```bash
pm2 status
systemctl status caddy
ss -tlnp | grep -E ':(80|443|3000)'
curl -I http://localhost:3000
```

浏览器验证：

- `https://zhudatuan.com` — 应显示商城首页（Caddy 已自动签发证书）
- `https://zhudatuan.com/api/health` — 应返回 `{"status": "ok", ...}`

### 常见问题排查

| 问题                               | 排查方法                                        |
| ---------------------------------- | ----------------------------------------------- |
| 502 Bad Gateway                    | Node 进程未启动，检查 `pm2 status` / `pm2 logs` |
| API 500，`SUPABASE_NOT_CONFIGURED` | `.env.production` 未创建或密钥缺失              |
| 证书签发失败                       | 确认域名已解析到本机、80/443 端口可从公网访问   |
| 域名不生效                         | `dig zhudatuan.com` 查看 DNS 是否指向服务器 IP  |

---

## 十、回滚方案

```bash
pm2 stop zhudatuan
systemctl stop caddy

cd /var/www
mv zhudatuan zhudatuan-failed
mv zhudatuan-backup zhudatuan
```

---

## 十一、后续优化建议

1. **数据库合规评估**：当前 Supabase 数据库在 `ap-northeast-1`（东京）。若本项目的备案/合规
   要求覆盖数据存放地（不只是域名与服务器），这里需要甲方/法务确认是否要求境内数据托管——
   这个问题比部署方式本身影响更大，务必在上线前拿到明确结论。
2. **CDN 加速**：如需要，选用阿里云 CDN（境内节点），不要用境外通用 CDN 代理已备案域名。
3. **监控告警**：接入阿里云云监控或 PM2 监控。
4. **日志收集**：配置 Caddy 和 Node.js 日志轮转。
5. **备份策略**：定期备份数据库和代码。

---

> 部署遇到问题？检查日志：
>
> - Caddy：`journalctl -u caddy -f`
> - 应用：`pm2 logs zhudatuan` 或 `journalctl -u zhudatuan -f`
