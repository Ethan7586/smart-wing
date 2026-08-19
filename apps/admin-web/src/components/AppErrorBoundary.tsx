import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { error: Error | null };

/** Keeps a workstation error from unmounting the entire authenticated admin shell. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ADMIN_RENDER_FAILED', error, errorInfo);
  }

  private reloadWithCacheRecovery = () => {
    window.location.assign('/?recovery=reset-5385d19');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <section className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
          <p className="text-sm font-medium text-slate-300">智慧翼运营后台</p>
          <h1 className="mt-2 text-xl font-semibold">页面未能正常加载</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">登录状态和业务数据没有受到影响。请重新加载后台；如果问题仍然存在，请将下面的错误编号发给技术支持。</p>
          <p className="mt-4 rounded-md bg-slate-800 px-3 py-2 font-mono text-xs text-slate-300">
            {this.state.error.name}: {this.state.error.message || 'Unknown render error'}
          </p>
          <button type="button" onClick={this.reloadWithCacheRecovery} className="mt-6 rounded-lg bg-[#1769ff] px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600">
            重新加载后台
          </button>
        </section>
      </main>
    );
  }
}
