# zhudatuan.com 阿里云部署指南

> 目标：将 Smart Wing（智慧翼企业福利商城）部署到阿里云，绑定域名 zhudatuan.com
> 预估时间：2~4 小时
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

在服务器上执行以下命令：

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Nginx
apt install -y nginx

# 安装 Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 验证安装
node --version  # 应显示 v22.x.x
npm --version   # 应显示 10.x.x

# 安装 PM2（进程管理）
npm install -g pm2
```

---

## 二、上传项目代码

### 2.1 方式 A：直接从本机上传（推荐）

在本机执行（Windows 用 PowerShell / Git Bash）：

```bash
# 将项目压缩为 zip
cd "C:/Users/Ethan/Desktop/01-Projects/03-client-and-contract-projects/02-pre-contract/Shop"
zip -r zhudatuan-deploy.zip smart-wing/ -x "smart-wing/node_modules/*" "smart-wing/.git/*" "smart-wing/.next/*" "smart-wing/dist/*" "smart-wing/.codex-temp/*"

# 上传到服务器（替换为你的服务器 IP）
scp zhudatuan-deploy.zip root@<服务器IP>:/root/
```

然后在服务器上：

```bash
cd /root
unzip zhudatuan-deploy.zip
mv smart-wing /var/www/zhudatuan
cd /var/www/zhudatuan
```

### 2.2 方式 B：从 Git 仓库拉取（如果代码已推送到 Git）

```bash
cd /var/www
git clone <你的Git仓库地址> zhudatuan
cd zhudatuan
```

---

## 三、安装依赖并构建

```bash
cd /var/www/zhudatuan

# 安装依赖（包含 devDependencies，vinext 是开发依赖）
npm install

# 构建生产环境
npm run build

# 验证构建产物存在
ls -la dist/server/index.js
echo "构建成功"
```

---

## 四、配置 API 反向代理（关键步骤）

### 4.1 确定你的 Cloudflare Worker URL

当前项目的 API 后端部署在 Cloudflare Worker 上。你需要确认 Worker 的访问地址：

- 登录 Cloudflare Dashboard → Workers & Pages → 你的 Worker → 查看域名
- 通常是 `https://<worker-name>.<your-account>.workers.dev`

**将下面的 `WORKER_URL` 替换为你的实际 Worker URL。**

### 4.2 复制 Nginx 配置

```bash
# 备份默认配置
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak

# 复制项目中的 Nginx 配置
cp /var/www/zhudatuan/deploy/nginx.conf /etc/nginx/sites-available/zhudatuan

# 编辑配置，填入你的 Worker URL
nano /etc/nginx/sites-available/zhudatuan
# 找到 "proxy_pass WORKER_URL" 这一行，替换为实际地址
# 例如：proxy_pass https://your-worker.your-account.workers.dev;

# 启用配置
ln -sf /etc/nginx/sites-available/zhudatuan /etc/nginx/sites-enabled/zhudatuan
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

---

## 五、启动应用服务

### 5.1 使用 PM2 启动（推荐，自动重启）

```bash
cd /var/www/zhudatuan

# 使用 PM2 启动
pm2 start npm --name "zhudatuan" -- run start

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs zhudatuan
```

### 5.2 或使用 systemd 服务

```bash
# 复制 systemd 服务文件
cp /var/www/zhudatuan/deploy/zhudatuan.service /etc/systemd/system/

# 重载 systemd
systemctl daemon-reload

# 启动并设置开机自启
systemctl enable --now zhudatuan

# 查看状态
systemctl status zhudatuan
journalctl -u zhudatuan -f
```

---

## 六、配置域名和 HTTPS

### 6.1 域名解析

在阿里云域名控制台（或你的域名注册商）添加解析记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|----------|----------|--------|-----|
| A | @ | <你的服务器公网IP> | 600 |
| A | www | <你的服务器公网IP> | 600 |

等待 DNS 生效（通常 5~30 分钟）。

### 6.2 配置 HTTPS（SSL 证书）

#### 方式 A：阿里云 SSL 证书（推荐）

1. 登录阿里云控制台 → SSL 证书 → 购买/申请免费证书
2. 为 `zhudatuan.com` 和 `www.zhudatuan.com` 申请证书
3. 下载 Nginx 格式的证书文件
4. 上传到服务器 `/etc/nginx/ssl/`
5. 编辑 `/etc/nginx/sites-available/zhudatuan`，取消注释 SSL 相关配置

```bash
mkdir -p /etc/nginx/ssl
# 上传证书文件到 /etc/nginx/ssl/
# zhudatuan.com.crt
# zhudatuan.com.key

nginx -t
systemctl reload nginx
```

#### 方式 B：Let's Encrypt 免费证书（自动续期）

```bash
apt install -y certbot python3-certbot-nginx

# 申请证书（会自动修改 Nginx 配置）
certbot --nginx -d zhudatuan.com -d www.zhudatuan.com

# 设置自动续期
certbot renew --dry-run
```

---

## 七、验证部署

### 7.1 基础检查

```bash
# 检查服务状态
pm2 status
systemctl status nginx

# 检查端口监听
ss -tlnp | grep -E ':(80|443|3000)'

# 测试本地访问
curl -I http://localhost:3000
```

### 7.2 浏览器验证

打开浏览器访问：
- `http://zhudatuan.com` — 应显示商城首页
- `https://zhudatuan.com` — HTTPS 版本（配置证书后）
- `https://zhudatuan.com/api/health` — 应返回 API 健康状态

### 7.3 常见问题排查

| 问题 | 排查方法 |
|------|----------|
| 502 Bad Gateway | Nginx 无法连接 vinext，检查 `pm2 status` 和 `pm2 logs` |
| API 404 | 检查 Nginx 配置中 `proxy_pass` 的 Worker URL 是否正确 |
| 域名不生效 | `dig zhudatuan.com` 查看 DNS 是否指向服务器 IP |
| 证书错误 | 检查 `/etc/nginx/ssl/` 证书文件路径和权限 |
| 静态资源 404 | 检查 `dist/client/` 目录是否存在且 Nginx root 路径正确 |

---

## 八、防火墙配置（如需要）

```bash
# 开放 80 和 443 端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable

# 或阿里云安全组配置
# 登录阿里云控制台 → ECS → 安全组 → 入方向规则
# 添加：80, 443, 22 端口允许
```

---

## 九、回滚方案

如果部署失败，快速回滚：

```bash
# 停止服务
pm2 stop zhudatuan
systemctl stop nginx

# 恢复之前的 Nginx 配置
cp /etc/nginx/sites-available/default.bak /etc/nginx/sites-available/default
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
systemctl restart nginx

# 或者恢复之前的代码备份
cd /var/www
mv zhudatuan zhudatuan-failed
mv zhudatuan-backup zhudatuan
```

---

## 十、后续优化建议

1. **数据库迁移**：当前使用 Supabase（东京），建议评估是否迁移到阿里云 RDS PostgreSQL
2. **CDN 加速**：静态资源可通过阿里云 CDN 加速
3. **监控告警**：接入阿里云云监控或配置 PM2 监控
4. **日志收集**：配置 Nginx 和 Node.js 日志轮转
5. **备份策略**：定期备份数据库和代码

---

> 部署遇到问题？检查以下日志：
> - Nginx 错误日志：`tail -f /var/log/nginx/error.log`
> - 应用日志：`pm2 logs zhudatuan`
> - 系统日志：`journalctl -u zhudatuan -f`
