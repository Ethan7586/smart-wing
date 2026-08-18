import React from 'react';

/** The database has no plan-order aggregate yet, so the visible state must not impersonate production data. */
export function PlanOrderPanel() {
  return (
    <section className="rounded-[14px] border border-slate-200/90 bg-white p-10 text-center shadow-xs">
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-xl text-[#1769ff]">◫</span>
        <h3 className="text-base font-bold text-slate-800">下单计划订单</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">页面入口已经纳入订单管理系统。当前生产库尚未定义计划单的创建、执行与取消口径，因此这里不会展示模拟生产数据。</p>
        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">接入计划单数据模型后，该页将按执行日期、企业范围、商品、预算占用和执行状态展示，并沿用当前订单权限范围。</div>
      </div>
    </section>
  );
}
