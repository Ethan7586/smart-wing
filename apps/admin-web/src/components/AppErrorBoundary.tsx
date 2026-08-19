import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

const LOGIN_URL = 'https://hbbtzn.com/login/?target=admin';

/**
 * Root boundary. Without it any throw inside App unmounts the whole tree and
 * leaves an empty document, which reads as a blank page with no way to tell
 * whether the session, the network or the render failed.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? '' });
    // Keep the raw error in the console so a support session can read the stack.
    console.error('[admin-web] 渲染失败', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleBackToLogin = (): void => {
    window.location.replace(LOGIN_URL);
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    const detail = [error.stack ?? `${error.name}: ${error.message}`, componentStack].filter(Boolean).join('\n\n');

    return (
      <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-200">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Admin Console Error</p>
            <h1 className="mt-3 text-2xl font-bold text-white">运营后台加载失败</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">页面在渲染过程中出错，已停止加载以避免显示不完整的经营数据。你的登录状态没有失效，可以先刷新重试。</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-rose-300">
              {error.name}: {error.message}
            </p>
            {detail && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">展开技术细节（报障时请一并提供）</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-400">{detail}</pre>
              </details>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-[#1F5EFF] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#174ED1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5EFF]"
            >
              刷新页面
            </button>
            <button
              type="button"
              onClick={this.handleBackToLogin}
              className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              返回登录
            </button>
          </div>
        </div>
      </div>
    );
  }
}
