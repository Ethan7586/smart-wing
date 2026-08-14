# Web 与小程序共用 OSS/CDN 图片缓存标准

## 1. 目标与边界

唯一正式链路：

`商品数据 -> commerce-api -> img.hbbtzn.com -> 阿里云 CDN -> btshangcheng OSS`

- Web 和微信小程序共享数据库中的同一张商品图，不维护两套媒体真值。
- 仅公开商品图、品牌图、Banner 和公开卖场 Logo 进入公共 CDN。
- 会员码、订单凭证、收货地址、售后证据和用户私有上传绝不进入公共 Bucket；它们使用私有 OSS、短期签名 URL 和 `no-store`。
- CDN 是公开媒体的交付缓存，不是订单、余额、会员身份或库存的真值源。

## 2. 四层缓存

| 层                  | 保存什么                 | 策略                           |
| ------------------- | ------------------------ | ------------------------------ |
| 页面内存            | 当前视口和下一屏图片     | 只保留正在使用的对象，离屏释放 |
| 浏览器/微信磁盘缓存 | 已下载的带版本 URL       | `max-age=31536000, immutable`  |
| 阿里云 CDN 边缘     | 公开图片变体             | 命中优先，不回源数据库/API     |
| OSS 源站            | 原始派生物与固定尺寸变体 | 单一持久对象源，版本化且可审计 |

同一 URL 的字节永不改变。换图时生成新版本路径并更新数据库，旧缓存自然淘汰，不做全网强制刷新。

## 3. 图片对象协议

每张来源图固定生成 4 个 WebP 变体：

|  宽度 | 用途                               |
| ----: | ---------------------------------- |
| 160px | 小图标、订单缩略图                 |
| 320px | 小程序三列商品卡、Web 小卡片       |
| 640px | 默认 `cover_url`、双倍像素密度卡片 |
| 960px | 商品详情与宽屏预览                 |

对象名：

```text
catalog/products/{productId}/{sourceVersion}/cover-{width}.webp
```

`sourceVersion` 由来源字节和转换配置共同计算。转换质量或裁切规则改变时版本也会改变，杜绝“URL 没变、缓存字节变了”。数据库 `products.cover_url` 指向 640px 版本，其他尺寸按同一目录可预测。

## 4. 导入与发布机制

`scripts/sync-catalog-media-to-oss.mjs` 执行顺序：

1. 拉取最多 200 个公开商品；
2. 校验 HTTPS、图片 MIME、10MB 上限和 4000 万像素上限；
3. 自动旋转并重新编码，移除来源 EXIF；
4. 为单个商品完整生成并上传 160/320/640/960 四档；
5. 所有商品上传完成后，才把数据库 `cover_url` 切到 CDN 640px URL；
6. 写出 `.codex-temp/catalog-media-sync.json`，记录来源、版本、四档 URL 和字节数。

这是“两阶段发布”：先上传不可变对象，后发布数据库引用。任何单张上传失败都不会把数据库指向半套资源；数据库更新中断时重复运行可安全恢复。

图片完成后执行 `npm run publish:catalog-manifest`。它把同一批公开商品写成两类对象：

- `catalog/public/v1/catalog.{contentHash}.json`：一年不可变缓存；
- `catalog/public/v1/latest.json`：60 秒缓存、允许 300 秒陈旧响应。

发布顺序固定为“不可变版本先、latest 指针后”。因此任意时刻 `latest` 都不会指向不存在的版本；客户端 CDN 失败时自动回源 `hbbtzn.com`。

运行环境：

```ini
PUBLIC_MEDIA_BASE_URL=https://img.hbbtzn.com
ALIYUN_OSS_REGION=oss-cn-beijing
ALIYUN_OSS_BUCKET=btshangcheng
ALIYUN_OSS_ACCESS_KEY_ID=仅授予目标前缀写入权限的 RAM 凭证
ALIYUN_OSS_ACCESS_KEY_SECRET=对应密钥
SUPABASE_URL=现有值
SUPABASE_SERVICE_ROLE_KEY=现有值
CATALOG_MEDIA_WIDTHS=160,320,640,960
CATALOG_MEDIA_DEFAULT_WIDTH=640
```

验证与同步：

```bash
npm run test:catalog-media-cache
npm run sync:catalog-media -- --dry-run --limit 3
npm run sync:catalog-media -- --limit 200 --concurrency 4
npm run test:catalog-manifest
npm run publish:catalog-manifest
```

`--width 640` 仍兼容旧单尺寸任务；正式任务不使用它。

## 5. 阿里云 CDN 标准与当前状态

- 加速域名：`img.hbbtzn.com`；业务类型：图片小文件；区域：中国内地。
- 源站：北京 OSS `btshangcheng.oss-cn-beijing.aliyuncs.com`。
- Cloudflare 仅管理 DNS：`img` CNAME 指向 `img.hbbtzn.com.w.kunlunaq.com`，为灰云“仅 DNS”，禁止双 CDN。
- HTTPS 证书已部署，HTTP 已强制 301 跳转 HTTPS，HTTP/2 已开启。
- `/` 当前边缘 TTL 为 365 天，客户端遵循 CDN 缓存时间；查询参数已忽略。
- Gzip 已开启；Range 回源保持关闭。当前对象是小尺寸 WebP，开启 Range 不会带来收益。
- 后续增加独立错误缓存规则：404 最多 30 秒；5xx 不缓存，避免把源站故障放大为长时间故障。
- 上线后预热首屏热门商品的 160/320/640px URL；换图只发布新 URL，不刷新旧 URL。

当前证书有效期至 2026-11-12。到期前应换成可自动续签的正式证书，避免依赖 90 天测试证书人工部署。

## 6. 两端消费规则

- Web 商品卡优先 320/640px `srcset`，详情页使用 640/960px；非首屏图片懒加载。
- 小程序三列商品卡使用 320px，详情使用 640px；分页/分片渲染，不一次创建 200 个图片节点。
- API 的 `coverUrl` 是唯一默认地址；客户端只能在已识别的版本化 CDN 路径上选择固定变体，禁止重写任意第三方 URL。
- 图片失败只降级当前卡片，不能让页面整体失败；失败源进入监控和重同步队列。

微信后台 `downloadFile 合法域名` 必须包含：

```text
https://img.hbbtzn.com
```

由于公开目录 JSON 也从该域名读取，`request 合法域名` 同样必须包含 `https://img.hbbtzn.com`。这与图片下载白名单是两项独立配置。

## 7. 全球成熟做法对应关系

- Shopify：版本化 CDN URL、按展示尺寸请求派生图、响应式加载。
- AWS S3 + CloudFront：对象存储做源站，边缘交付固定或按需变体。
- Next.js：静态内容哈希与长期 immutable 缓存，图片组件选择响应式尺寸并延迟非首屏资源。

本项目选“预生成固定四档”，而不是边缘任意缩图。它的尺寸集合有限、成本可预测、微信兼容性更稳，也避免公开任意尺寸转换接口被滥用。

## 8. 放行指标

- `img.hbbtzn.com` DNS 指向阿里云 CDN CNAME，Cloudflare 为仅 DNS。
- 图片返回 200、`Content-Type: image/webp`、无强制下载头。
- 第二次请求出现 CDN 命中证据（`Age` 或阿里云命中头），缓存 TTL 为一年。
- Web 与小程序同一商品共享同一版本目录；根据场景选择不同宽度。
- 热点图片 CDN 命中率目标 ≥95%；中国内地边缘 TTFB P95 目标 ≤200ms。
- 首屏前 12 张图成功率目标 ≥99.9%；图片 5xx 目标 <0.1%。
- 真机首屏无域名校验错误、502 或整页等待图片完成才展示文字的情况。
