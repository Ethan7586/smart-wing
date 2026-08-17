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
if node --env-file=/opt/smart-wing/.env.production -e "process.exit(process.env.TAIR_HOST&&process.env.TAIR_PASSWORD&&process.env.CORE_READ_CACHE_URL&&process.env.CORE_READ_CACHE_TOKEN?0:1)"; then
  pm2 startOrReload infrastructure/aliyun/ecosystem.core-cache.config.cjs --update-env
fi

# Refresh the public, non-sensitive catalogue mirror after the Commerce API is
# serving the new release. Reading localhost avoids sending the publisher back
# through Cloudflare, while the resulting object is still delivered through
# Alibaba OSS/CDN to browsers and the mini-program.
if node --env-file=/opt/smart-wing/.env.production -e "process.exit(process.env.ALIYUN_OSS_ACCESS_KEY_ID&&process.env.ALIYUN_OSS_ACCESS_KEY_SECRET?0:1)"; then
  SW_PUBLIC_CATALOG_URL='http://127.0.0.1:3000/api/v1/catalog/public/products?cursor=0&limit=200' npm run publish:catalog-manifest
else
  echo 'Catalog CDN manifest skipped: Alibaba OSS publishing credentials are not configured.'
fi
pm2 save
