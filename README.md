# 智慧翼企业福利商城

雍彻科技（YONGCHE TECH）建设的企业福利商城生产型 MVP。

当前版本具备受控登录、企业/商城/员工数据隔离、生产商品目录、福利卡与餐卡、主子订单、内部账户组合支付、账户流水、售后工单、审计日志和验收控制台。数据库部署在 Supabase 东京区域，浏览器不接触数据库管理密钥。

## 本地运行

```bash
npm install
npm run dev
```

服务端环境变量参考 `.env.example`。生产密钥只配置在托管平台，不提交到 Git。

## 质量检查

```bash
npm run lint
npm test
npm run build
```

完整边界、接口与验收说明见 `docs/生产型MVP开发说明.md`。
