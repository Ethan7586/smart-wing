# 复制给新 Codex 任务的完整启动指令

你现在负责“智慧翼企业福利商城”微信小程序。工作目录固定为：

`C:\Users\Ethan\Desktop\01-Projects\03-client-and-contract-projects\02-pre-contract\Shop\smart-wing-membership-permissions\apps\wechat-miniapp`

仓库根目录固定为：

`C:\Users\Ethan\Desktop\01-Projects\03-client-and-contract-projects\02-pre-contract\Shop\smart-wing-membership-permissions`

## 强制边界

- 禁止进入、读取、修改任何 `zhijian` 项目。
- 禁止先写代码再解释。
- 未经 Ethan 明确授权，禁止删除、覆盖、重建现有 `miniprogram`。（2026-08-14 已按授权重建过一次，当前版本是新基线，不要再推倒。）
- 禁止使用 `git clean`、`git reset --hard`、`git checkout --` 或批量还原未提交文件。
- 禁止把现有小程序页面当作设计基准；设计稿、VI、令牌才是基准。
- 禁止自行换 Logo、品牌蓝、图标体系、字体、圆角、阴影和导航结构。
- 禁止生成假 Logo、假二维码图片、CSS 拼接图标或破图占位。
- 未得到 Ethan 的逐阶段确认，不得跨页批量开发。

## 动手之前必须先读

`10-小程序开发完全说明.md`

它讲清楚了：颜色字号去哪查、图标怎么加、为什么必须走生成管道而不能手写、微信平台的五个坑、当前进度和目标。**不读它就写代码，会重复前两次的失败。**

两条命令必须知道：

```bash
npm run build:miniapp-assets   # 令牌与图标 → 小程序可用资产
npm run check:miniapp          # VI 防线，提交前必跑
```

`miniprogram/styles/tokens.wxss` 和 `icons.wxss` 是**生成物**，手改会被检查器拦下。要改就改 `scripts/build-miniapp-assets.mjs`。

## 唯一上位依据

请完整阅读以下文件：

1. `docs/brand/SMART-WING-UNIFIED-VI-1.0.md`
2. `docs/mobile/DESIGN.md`
3. `docs/mobile/WING-CODE-WECHAT-MINIAPP-MASTER-PLAN.md`
4. `packages/design-system/src/tokens.json`
5. `packages/design-system/src/mobile-platforms.json`
6. `packages/design-system/src/tokens.css`

然后查看：

- `docs/mobile/design-previews/smart-wing-unified-mall-01-browse-v2-cart-restored.png`
- `docs/mobile/design-previews/smart-wing-unified-mall-02-checkout-payment.png`
- `docs/mobile/design-previews/smart-wing-unified-mall-03-wing-code-assets-ai.png`
- `docs/mobile/design-previews/smart-wing-unified-mall-04-orders-after-sales.png`
- `docs/mobile/design-previews/smart-wing-unified-mall-05-profile-security.png`
- `docs/mobile/design-previews/smart-wing-unified-mall-06-auth-states.png`
- `docs/mobile/design-previews/smart-wing-member-card-code-v2.png`
- `docs/mobile/design-previews/smart-wing-mobile-v1-full-board.png`
- `apps/wechat-miniapp/design/00-原版设计稿-智慧翼会员卡与动态会员码-V2.png`

## 产品 Owner 的命名决议

- 所有用户可见界面统一写：`会员码`。
- 底栏固定：`首页 / 分类 / 会员码 / 订单 / 我的`。
- 内部变量、接口和目录允许使用 `wingCode`、`wing-code`、`member-code`，不得因此把界面文案改回“翼码”。

## 正确工作方式

第一阶段只读，不修改任何文件。第一次回复 Ethan 时必须交付：

1. 已找到的 VI、令牌、SVG 和设计图清单。
2. 当前 `miniprogram` 的页面与组件清单，并说明它与批准设计的差异。
3. 首页设计稿逐区映射：设计区域 → 小程序组件 → 所用令牌 → 所用品牌资产。
4. 微信胶囊、安全区、底部安全区和中央会员码的适配方案。
5. 明确写出：“我会等待 Ethan 回复‘开始首页’，此前不改代码。”

得到“开始首页”后，只实现首页一个页面及共享壳层。完成后提供微信开发者工具实图，并逐项对照设计稿。得到首页确认后才开发分类；之后依次为会员码、订单、我的、商品详情、购物车、结算、支付状态、会员卡、安全状态。

任何地方与规范冲突时，停止并报告冲突，不得自行创作替代方案。
