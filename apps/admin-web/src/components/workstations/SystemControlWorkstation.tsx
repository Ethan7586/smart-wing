import { ArrowRight, ShieldAlert } from 'lucide-react';

/**
 * Compatibility entry retained for existing navigation. The former screen
 * only updated browser memory, so it must not present itself as a
 * server-backed configuration console.
 */
export function SystemControlWorkstation({ onOpenControlCenter }: { onOpenControlCenter: () => void }) {
  return (
    <section className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <ShieldAlert className="h-6 w-6 text-amber-700" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">系统治理台</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">此兼容入口不再在浏览器内保存系统参数。需要读取经营数据或持久化运营配置时，请使用“智慧翼中控台”；配置结果以服务端返回为准。</p>
        <button onClick={onOpenControlCenter} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1769ff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          打开智慧翼中控台 <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
