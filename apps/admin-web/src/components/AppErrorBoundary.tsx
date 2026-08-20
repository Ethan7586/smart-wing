import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../services/errorReporting';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  componentStack: string;
  faultCode: string | null;
  reporting: boolean;
}

const LOGIN_URL = 'https://hbbtzn.com/login/?target=admin';

/**
 * Root boundary. Without it any throw inside App unmounts the whole tree and
 * leaves an empty document, which reads as a blank page with no way to tell
 * whether the session, the network or the render failed.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, componentStack: '', faultCode: null, reporting: true };
  private failureCaptured = false;

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.captureFailure(error, info.componentStack ?? '', '渲染');
  }

  componentDidMount(): void {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount(): void {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleWindowError = (event: ErrorEvent): void => {
    // Resource-loading errors do not carry an Error object. They should remain
    // visible in DevTools, but must not replace a usable admin page.
    if (event.error == null) return;
    this.reportBackgroundFailure(toError(event.error, '运行时异常'), '运行时');
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    if (event.reason == null) return;
    this.reportBackgroundFailure(toError(event.reason, '异步操作异常'), '异步');
  };

  /**
   * An unhandled background failure is serious enough to report, but it is not
   * proof that the current view is unusable. Keeping the rendered page visible
   * prevents a notification or polling failure from becoming a full-page outage.
   */
  private reportBackgroundFailure(error: Error, source: '运行时' | '异步'): void {
    console.error(`[admin-web] ${source}失败`, error);
    void reportClientError(error, '');
  }

  private captureFailure(error: Error, componentStack: string, source: '渲染' | '运行时' | '异步'): void {
    if (this.failureCaptured) return;
    this.failureCaptured = true;
    this.setState({ error, componentStack, faultCode: null, reporting: true });
    // Keep the raw error in the console so a support session can read the stack.
    console.error(`[admin-web] ${source}失败`, error, componentStack);
    void reportClientError(error, componentStack).then((faultCode) => this.setState({ faultCode, reporting: false }));
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleBackToLogin = (): void => {
    window.location.replace(LOGIN_URL);
  };

  render(): ReactNode {
    const { error, componentStack, faultCode, reporting } = this.state;
    if (!error) return this.props.children;

    const detail = [error.stack ?? `${error.name}: ${error.message}`, componentStack].filter(Boolean).join('\n\n');

    return (
      <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-200">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Admin Console Error</p>
            <h1 className="mt-3 text-2xl font-bold text-white">运营后台加载失败</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">这个页面暂时打不开，你的登录状态没有失效，先刷新试试。系统会尝试记录这次故障；若显示故障编号，请在报障时提供它。</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-400">故障编号</span>
              {reporting ? (
                <span className="text-slate-500">记录中…</span>
              ) : faultCode ? (
                <code className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 font-mono text-base font-semibold tracking-wider text-amber-200">{faultCode}</code>
              ) : (
                <span className="text-slate-500">本次未能上报，请截图下方技术细节</span>
              )}
            </div>
            {faultCode && <p className="mt-2 text-xs text-slate-500">报障时报这个编号即可，不需要截图。</p>}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-red-300">
              {error.name}: {error.message}
            </p>
            {detail && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">展开技术细节（报障时请一并提供）</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-400">{detail}</pre>
              </details>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-[var(--sw-brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--sw-brand-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sw-brand)]"
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

/** Converts a value rejected by a Promise or thrown by third-party code into
 * the Error shape used by the fault ledger, without attempting to parse a
 * display string back into a business value. */
export function toError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string' && value.trim()) return new Error(value);
  return new Error(fallback);
}
