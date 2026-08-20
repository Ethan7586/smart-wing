/**
 * Marks a workstation whose records are demonstration fixtures rather than
 * server data. It exists so an operator can never mistake a seeded row for a
 * real enterprise, supplier, ledger discrepancy or system parameter.
 *
 * Remove the banner from a screen only when that screen reads from the server.
 */
export function DemoDataBanner({ scope }: { scope: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">!</span>
      <p className="text-xs leading-relaxed text-amber-900">
        <strong className="font-semibold">演示数据</strong> —— {scope}尚未接入服务端，本页所有记录均为预置样例，不代表真实业务。此处的任何操作都不会写入数据。
      </p>
    </div>
  );
}
