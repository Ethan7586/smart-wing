import React from 'react';
import type { AuthFailure } from '../App';

interface AdminSessionErrorProps {
  failure: AuthFailure;
  loginUrl: string;
}

interface Copy {
  title: string;
  body: string;
  hint?: string;
}

function copyFor(failure: AuthFailure): Copy {
  switch (failure.kind) {
    case 'unauthenticated':
      return { title: '登录状态已失效', body: '运营后台会话已过期或尚未建立，请重新登录。' };
    case 'wrong_entrance':
      return {
        title: '该账号没有运营后台入口',
        body: `当前会话的入口是「${failure.target}」，不是运营后台。请使用具备后台身份的账号登录，或联系管理员为该账号开通后台入口。`,
      };
    case 'profile_unresolved':
      return {
        title: '账号角色未配置',
        body: '已通过身份认证，但这个账号没有匹配到任何可用的后台角色，因此无法进入工作台。',
        hint: `工号 ${failure.employeeNo}；当前角色 ${failure.roles.length > 0 ? failure.roles.join('、') : '（空）'}。请把这行信息提供给管理员。`,
      };
    case 'request_failed':
      return { title: '无法连接后台服务', body: '读取运营后台数据失败，通常是网络中断或服务端暂时不可用。稍后重试；持续失败请联系技术支持。', hint: failure.detail };
  }
}

/** Replaces the silent redirect so a rejected session states its own reason. */
export function AdminSessionError({ failure, loginUrl }: AdminSessionErrorProps) {
  const { title, body, hint } = copyFor(failure);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-200">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Session Rejected</p>
          <h1 className="mt-3 text-2xl font-bold text-white">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
        </div>

        {hint && <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 font-mono text-xs leading-5 break-words text-slate-400">{hint}</p>}

        <div className="flex flex-wrap gap-3">
          <a
            href={loginUrl}
            className="rounded-lg bg-[var(--sw-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--sw-brand-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sw-brand)]"
          >
            返回登录
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            重试
          </button>
        </div>
      </div>
    </div>
  );
}
