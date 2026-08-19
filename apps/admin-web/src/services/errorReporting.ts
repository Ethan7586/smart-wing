let lastReportedKey = '';
let reportTimes: number[] = [];

const REPORT_WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 5;

/** Keeps a render loop from posting the same crash on every retry. */
function shouldReport(message: string, route: string): boolean {
  const key = `${route}|${message}`;
  if (key === lastReportedKey) return false;
  const now = Date.now();
  reportTimes = reportTimes.filter((reportedAt) => now - reportedAt < REPORT_WINDOW_MS);
  if (reportTimes.length >= MAX_REPORTS_PER_WINDOW) return false;
  lastReportedKey = key;
  reportTimes.push(now);
  return true;
}

export function resetErrorReportingForTests(): void {
  lastReportedKey = '';
  reportTimes = [];
}

/**
 * Sends one crash to the server ledger and returns the fault code the operator
 * can quote. Reporting must never itself throw: the caller is already on its
 * failure path, and a second exception there would hide the first one.
 */
export async function reportClientError(error: Error, componentStack: string): Promise<string | null> {
  const route = `${window.location.pathname}${window.location.hash}`.slice(0, 200);
  const message = `${error.name}: ${error.message}`.slice(0, 500);
  if (!shouldReport(message, route)) return null;

  try {
    const response = await fetch('/api/v1/admin/client-errors', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ surface: 'admin', route, message, stack: error.stack ?? null, componentStack: componentStack || null }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { faultCode?: unknown };
    return typeof payload.faultCode === 'string' ? payload.faultCode : null;
  } catch {
    return null;
  }
}
