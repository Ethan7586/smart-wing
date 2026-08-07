# zhudatuan.com P0 内测验收清单（基于当前仓库状态）

生成时间：2026-07-25
范围：生产型 MVP（内部闭环，不含企业 SSO、外部支付/供应商联调）

## 一、结论

- **P0 内测验收结论：合格**（核心交易闭环可演示、可复测）。
- 说明：尚不满足“正式商城上线”条件，外部依赖项仍需甲方/第三方资料与审核。

## 二、验收结果（可复测）

| 模块 | 验收项 | 状态 | 证据 |
|---|---|---|---|
| 平台底座 | `npm run quality` 全链路通过（`check:format`、`check:lines`、`lint`、`test`、`build`、`audit`） | 通过 | 仓库质量脚本 |
| 平台底座 | 核心上下文与权限入口（`MallContext`）在代码与实现上可复用 | 通过 | `src/context/MallContext.tsx` |
| 认证 | `/api/v1/auth/session` 未登录返回 `AUTHENTICATION_REQUIRED` | 通过 | 生产环境探测 |
| 认证 | `/api/v1/auth/login` 错误码返回明确 | 通过 | 生产环境探测 |
| 商品 | `/api/v1/products` 可分页返回商品与库存状态 | 通过 | 生产环境探测 |
| 订单 | `/api/v1/orders` 支持下单前查询 | 通过 | `productionApi.listOrders()` + `worker/api/orderRoutes.ts` |
| 订单 | 下单接口要求 `Idempotency-Key` 并支持失败处理 | 通过 | `worker/api/orderRoutes.ts` |
| 账户 | 福利/餐卡余额与流水 API 可访问 | 通过 | `worker/api/accountRoutes.ts` |
| 购物车 | 购物车 CURD 完整闭环（GET/PUT/DELETE） | 通过 | `worker/api/cartRoutes.ts` 与 `productionApi` |
| 地址簿 | 地址簿 GET/PUT/DELETE，PII 加密写入 | 通过 | `worker/api/addressRoutes.ts` + `worker/api/crypto.ts` |
| 售后 | 售后提交与查询、退款通道验证 | 通过 | `worker/api/orderRoutes.ts` |
| 核心流程 | 内部支付（福利+餐卡）支持 | 通过 | `worker/api/orderRoutes.ts` |
| 回归演练 | 端到端提交流程（`useCheckoutModel`） | 通过 | `src/features/checkout/useCheckoutModel.ts` |
| 版本规范 | 单文件行数门禁 < 299 且已通过 | 通过 | `scripts/check-line-budget.mjs` |

## 三、未完成（外部依赖项，不计入 P0 内测工时）

- 企业身份体系正式接入（企业 SSO / 员工体系）
- 微信/支付宝/银联商户联调
- 真实供应商商品/订单/发货/售后对接
- 第三方财务结算周期与发票流程
- 备案、隐私合规及正式合规文本落地

## 四、下一步（建议）

1. 把“外部依赖项”按供应商/付款方逐一补齐资料后，进入第 1–2 周计划的 P0 后续功能（完整筛选、履约闭环联调）。
2. 每次签署资料后补一轮 `P0-验收清单` 更新，新增“通过日期 / 验收人 / 回退方案”列，便于合同归档。
3. 运行一键验收命令：`npm run verify:p0`（若返回 Cloudflare 挑战提示，说明不是应用故障，需走白名单网络复测）。
