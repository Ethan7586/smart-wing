# ABO 测试商品库

智慧翼商城仅将 Amazon Berkeley Objects（ABO）作为开发与压力测试数据源。

## 数据边界

- 商品统一设置 `products.is_test = true`。
- 测试 SKU 的价格与库存均为 `0`。
- 前端明确显示“非商业测试”，并禁止加入购物车。
- 数据库触发器阻止测试商品写入正式订单。
- 正式发布前调用 `purge_test_catalog('mall-demo')` 整批清除。
- 图片使用数据集README记录的Amazon CDN地址，不复制到Supabase Storage。

## 许可记录

ABO随包 `README.md` 和 `LICENSE-CC-BY-4.0.txt` 标注 CC BY 4.0；
AWS Registry 页面当前标注 CC BY-NC 4.0。两处存在冲突，因此本项目采用更保守边界：
仅用于测试、不销售，并保留 Amazon.com 及数据集作者署名。

## 准备5000条数据

```powershell
npm run catalog:abo:prepare
```

默认输出保存在 `.codex-temp/abo/test-products.jsonl`，不会提交到Git。

## 导入Supabase

在当前PowerShell会话设置服务端凭据后执行：

```powershell
$env:SUPABASE_URL='https://PROJECT_REF.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='YOUR_SERVER_SECRET'
npm run catalog:abo:import
```

服务端密钥不得写入源码、`.env.example`、浏览器代码或提交到Git。

## 正式发布前清理

```powershell
npm run catalog:abo:purge
```

清理后必须复核：

```sql
select count(*) from public.products where is_test;
```

结果必须为 `0` 才能执行正式发布。
