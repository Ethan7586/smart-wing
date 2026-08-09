#!/usr/bin/env bash
set -euo pipefail

repo=/opt/smart-wing
cd "$repo"

git fetch origin main
git merge --ff-only origin/main
npm ci --include=dev
npm run build

install -m 0644 infrastructure/aliyun/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

pm2 startOrReload infrastructure/aliyun/ecosystem.config.cjs --update-env
pm2 save
