# 智慧翼企业福利商城架构基线

架构版本：v1.0  
技术服务方：雍彻科技（YONGCHE TECH）  
更新日期：2026-07-24

## 架构入口

商城 PC 端页脚提供“系统 Canvas 架构图”入口，也可通过应用内路由
`#/architecture` 打开。图形由原生 Canvas 实时绘制，支持点击节点查看职责。

## 四层结构

1. 终端体验层：PC、13/14 寸笔记本、微信小程序、Android 与平板端。
2. 边缘接入与安全层：Cloudflare CDN、API Worker、会话、RBAC 与租户范围。
3. 核心业务服务层：商品、订单、福利账户、售后和供应商适配。
4. 数据与治理层：Supabase PostgreSQL、RLS、审计流水和 PII 加密。

## 代码模块

- `src/screens`：页面编排，只组合业务组件。
- `src/features`：按商品、结算、架构图及各设备端划分的业务功能。
- `src/components`：跨页面复用的展示与交互组件。
- `src/context`：全局状态、设备导航与生产数据同步。
- `src/services`：商城状态、目录购物车、订单和生产 API。
- `worker/api`：边缘 API 的公开、账户、订单路由与通用校验。
- `supabase/migrations`：数据库结构、RPC、RLS 和审计基线。

## 300 行工程约束

`npm run check:lines` 会检查所有可维护源码；任何文件达到 300 行即失败。
以下内容属于生成或不可变制品，不执行拆分：

- `package-lock.json` 等依赖锁文件；
- Supabase 自动生成配置；
- 已经应用的 Supabase / Drizzle 历史迁移。

历史迁移必须保持原样，后续数据库变更通过新增迁移实现，不能为了行数修改已上线历史。
