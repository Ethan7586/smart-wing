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

> **两个实测踩过的坑，先看再操作：**
>
> 1. **不要把代码放 `/var/www` 下。** 阿里云云安全中心（aegis）的网站后门查杀会盯防这类经典 web
>    根目录，往里面写入完整项目目录树会被判定为可疑并清空，本文档已统一改用 `/opt/zhudatuan`。
> 2. **不要用 `scp` 或裸 `cat > file` 一次性传大文件/压缩包。** 同一台服务器上实测过：SFTP 子系统
>    不可用，且通过 SSH 管道整块写入一个大压缩包（或它的 base64）会被安全代理判定为"投放" 行为直接
>    掐断连接——纯随机数据传输反而没事，说明是内容/行为特征触发而非带宽限制。**Git clone 是唯一
>    验证过完全可靠的方式**；如果实在要手动传文件，拆成一个个源码文件单独写，别整体打包。

### 方式 A：从 Git 仓库拉取（推荐，唯一实测稳定的方式）

如果仓库是私有的，先在 GitHub 生成一个 fine-grained personal access token（只勾 `Contents: Read` 权限），部署完可以立刻撤销：

```bash
cd /opt
git clone https://<token>@github.com/<你的用户名>/smart-wing.git zhudatuan
cd zhudatuan
```

如果仓库是公开的，直接用不带 token 的地址即可。

### 方式 B：直接从本机上传（仅在无法用 Git 时兜底，较慢）

```bash
# 本机（Windows 用 Git Bash）
cd "C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop"
zip -r zhudatuan-deploy.zip smart-wing/ -x "smart-wing/node_modules/*" "smart-wing/.git/*" "smart-wing/.next/*" "smart-wing/dist/*"
```

**不要直接 `scp` 这个 zip 上去**（大概率被安全代理拦截或因 SFTP 不可用而失败）。改成把 zip 拆包
后逐个源文件通过 SSH 写入服务器，或者退回方式 A。

---

## 三、配置生产环境变量（关键步骤）

生产密钥**绝不能**进 `ecosystem.config.js` / `zhudatuan.service`（这两个文件在 git 里）。
在服务器上单独创建 `.env.production`（已在 `.gitignore` 里，不会被提交）：

```bash
cd /opt/zhudatuan
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
cd /opt/zhudatuan
npm install
npm run build
ls -la dist/server/index.js && echo "构建成功"
```

---

## 五、启动应用服务

### 5.1 使用 PM2 启动（推荐）

```bash
cd /opt/zhudatuan
pm2 start deploy/ecosystem.config.js
pm2 startup
pm2 save
pm2 status
pm2 logs zhudatuan
```

`ecosystem.config.js` 已配置 `--env-file=.env.production`，无需再手动 export。

### 5.2 或使用 systemd

```bash
cp /opt/zhudatuan/deploy/zhudatuan.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now zhudatuan
systemctl status zhudatuan
journalctl -u zhudatuan -f
```

---

## 六、配置 Caddy（反代 + 自动 HTTPS）

```bash
cp /opt/zhudatuan/deploy/Caddyfile /etc/caddy/Caddyfile
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

cd /opt
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
