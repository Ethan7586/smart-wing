# Web 与小程序共用 OSS/CDN 图片链路

## 唯一正式链路

`商品数据 -> commerce-api -> https://img.hbbtzn.com/catalog/... -> 阿里云 CDN -> btshangcheng OSS`

- Web 和微信小程序不各自保存一套图片地址。
- 数据库 `products.cover_url` 保存最终 CDN URL。
- 两端只消费 API 返回的 `coverUrl`，不拆解、不改写来源。
- CDN 未完成或旧数据尚未迁移时，API 保留原有安全代理作为回退。

## 阿里云配置

1. 使用现有北京 Bucket：`btshangcheng`。
2. 开通 CDN，添加加速域名 `img.hbbtzn.com`。
3. 业务类型选择图片小文件；源站选择 OSS，Bucket 为 `btshangcheng`。
4. 阿里云返回 CNAME 后，在 Cloudflare 为 `img` 添加 CNAME，必须设为“仅 DNS”。
5. CDN 配置 HTTPS 证书，强制 HTTP 跳转 HTTPS。
6. 对 `catalog/` 配置长期缓存；对象名含内容哈希，可设置一年缓存。
7. CDN 响应不得强制下载；`Content-Disposition` 应为 `inline` 或删除。

## 同步 200 张商品封面

脚本把来源图缩放为最长边 640px、转换为 WebP、写入带内容哈希的对象名，全部上传成功后才更新数据库 URL。

运行环境需要：

```ini
PUBLIC_MEDIA_BASE_URL=https://img.hbbtzn.com
ALIYUN_OSS_REGION=oss-cn-beijing
ALIYUN_OSS_BUCKET=btshangcheng
ALIYUN_OSS_ACCESS_KEY_ID=仅授予该 Bucket 写入权限的 RAM 凭证
ALIYUN_OSS_ACCESS_KEY_SECRET=对应密钥
SUPABASE_URL=现有值
SUPABASE_SERVICE_ROLE_KEY=现有值
```

先做无写入验证：

```bash
npm run sync:catalog-media -- --dry-run --limit 3
```

正式同步：

```bash
npm run sync:catalog-media -- --limit 200 --concurrency 6
```

同步完成后，把 `PUBLIC_MEDIA_BASE_URL=https://img.hbbtzn.com` 加入 commerce-api 生产环境并重载服务，再重新生成小程序内置目录快照。

## 微信后台

在小程序“服务器域名”的 `downloadFile 合法域名` 中加入：

```text
https://img.hbbtzn.com
```

Web 不需要额外白名单；它与小程序共享 API 返回的同一 CDN URL。

## 放行检查

- CDN URL 返回 200，`Content-Type: image/webp`。
- 响应不含强制下载头。
- 第二次访问显示 CDN 命中，缓存时间为一年。
- Web 和小程序同一商品的 `coverUrl` 完全相同。
- 小程序真机首屏没有域名校验错误或 502 图片错误。
