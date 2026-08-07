#!/bin/bash
set -e

# zhudatuan.com 阿里云一键部署脚本
# 用法：在阿里云服务器上以 root 身份执行
# bash deploy-aliyun.sh

echo "========================================"
echo "  zhudatuan.com 阿里云部署脚本"
echo "========================================"

PROJECT_DIR="/var/www/zhudatuan"
LOG_DIR="/var/log/pm2"

# 1. 系统更新和依赖安装
echo "[1/8] 更新系统并安装依赖..."
apt update -qq
apt install -y -qq nginx curl unzip git

# 2. 安装 Node.js 22
echo "[2/8] 安装 Node.js 22..."
if ! command -v node &> /dev/null || [ "$(node --version | cut -d'v' -f2 | cut -d'.' -f1)" != "22" ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
fi
node --version
npm --version

# 3. 安装 PM2
echo "[3/8] 安装 PM2..."
npm install -g pm2

# 4. 准备项目目录
echo "[4/8] 准备项目目录..."
mkdir -p "$PROJECT_DIR"
mkdir -p "$LOG_DIR"

# 提示用户上传代码
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo ""
    echo "⚠️  未检测到项目代码！"
    echo "请先上传项目代码到 $PROJECT_DIR"
    echo ""
    echo "上传方式："
    echo "  1) 在本机执行: scp -r smart-wing/* root@$(curl -s ifconfig.me):$PROJECT_DIR/"
    echo "  2) 或从 Git 拉取: git clone <仓库地址> $PROJECT_DIR"
    echo ""
    read -p "代码上传完成后按回车继续..."
fi

cd "$PROJECT_DIR"

# 5. 安装依赖和构建
echo "[5/8] 安装依赖并构建..."
npm install
npm run build

# 6. 配置 Nginx
echo "[6/8] 配置 Nginx..."
if [ -f "$PROJECT_DIR/deploy/nginx.conf" ]; then
    cp "$PROJECT_DIR/deploy/nginx.conf" /etc/nginx/sites-available/zhudatuan
    
    # 提示用户修改 Worker URL
    echo ""
    echo "⚠️  重要：请编辑 Nginx 配置文件，填入你的 Cloudflare Worker URL"
    echo "   nano /etc/nginx/sites-available/zhudatuan"
    echo "   找到 'proxy_pass https://your-worker.your-account.workers.dev/api/' 并替换"
    echo ""
    read -p "修改完成后按回车继续..."
    
    ln -sf /etc/nginx/sites-available/zhudatuan /etc/nginx/sites-enabled/zhudatuan
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl restart nginx
else
    echo "❌ 未找到 nginx.conf，跳过 Nginx 配置"
fi

# 7. 启动应用
echo "[7/8] 启动应用..."
if [ -f "$PROJECT_DIR/deploy/ecosystem.config.js" ]; then
    pm2 start "$PROJECT_DIR/deploy/ecosystem.config.js"
    pm2 save
    pm2 startup systemd -u root --hp /root
else
    pm2 start npm --name "zhudatuan" -- run start
    pm2 save
    pm2 startup systemd -u root --hp /root
fi

# 8. 验证
echo "[8/8] 验证部署..."
sleep 3

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "服务状态:"
pm2 status

echo ""
echo "Nginx 状态:"
systemctl is-active nginx

echo ""
echo "端口监听:"
ss -tlnp | grep -E ':(80|443|3000)' || echo "无监听端口"

echo ""
echo "本地测试:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo "无法访问"

echo ""
echo "========================================"
echo "  下一步："
echo "========================================"
echo "  1. 配置域名解析：zhudatuan.com → $(curl -s ifconfig.me)"
echo "  2. 申请 SSL 证书并配置 HTTPS"
echo "  3. 确认 Cloudflare Worker URL 已填入 Nginx 配置"
echo "  4. 浏览器访问 http://zhudatuan.com 验证"
echo ""
echo "常用命令:"
echo "  查看日志: pm2 logs zhudatuan"
echo "  重启应用: pm2 restart zhudatuan"
echo "  重启 Nginx: systemctl restart nginx"
echo "  Nginx 错误日志: tail -f /var/log/nginx/zhudatuan.error.log"
echo ""
