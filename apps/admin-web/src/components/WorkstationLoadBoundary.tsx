import React from 'react';

interface WorkstationLoadBoundaryProps {
  children: React.ReactNode;
  onReturnToCockpit: () => void;
}

interface WorkstationLoadBoundaryState {
  hasError: boolean;
}

/** Keeps a failed optional workstation from taking down the authenticated Admin shell. */
export class WorkstationLoadBoundary extends React.Component<WorkstationLoadBoundaryProps, WorkstationLoadBoundaryState> {
  state: WorkstationLoadBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WorkstationLoadBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="m-6 max-w-xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm" role="alert">
          <h2 className="text-base font-bold text-slate-900">卡券运营台暂时无法加载</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">其他后台工作台不受影响。请返回经营驾驶舱后稍后重试；本次不会执行任何卡券操作。</p>
          <button type="button" onClick={this.props.onReturnToCockpit} className="mt-5 rounded-xl bg-[#1F5EFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#174CCC]">
            返回经营驾驶舱
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

