/**
 * Single refusal for an administrative action whose server implementation does
 * not exist yet.
 *
 * It deliberately performs no local state change. A screen that shows a budget
 * topped up, a deposit deducted or a discrepancy cleared when the backend never
 * did any of it is worse than a screen that refuses: the operator walks away
 * believing the money moved.
 */
export function refuseUnimplementedWrite(action: string): void {
  window.alert(`${action}尚未接入服务端。当前为只读体验环境，本次操作不会写入任何数据。`);
}

/**
 * Refuses a write that the server does implement, but which is looking at demo
 * data rather than a real record. Kept separate from the unimplemented case so
 * the operator can tell "not built yet" from "not this row".
 */
export function refuseDemoDataWrite(action: string): void {
  window.alert(`当前为演示数据，${action}只在真实数据下可用。`);
}
