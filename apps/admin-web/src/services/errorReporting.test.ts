import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportClientError, resetErrorReportingForTests } from './errorReporting';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function stubFetch(handler: FetchLike) {
  const spy = vi.fn<FetchLike>(handler);
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  resetErrorReportingForTests();
  vi.stubGlobal('window', { location: { pathname: '/', hash: '#/orders' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('client crash reporting', () => {
  it('returns the fault code issued by the server', async () => {
    stubFetch(async (): Promise<Response> => new Response(JSON.stringify({ faultCode: 'SW-7F3A2C' }), { status: 201 }));
    await expect(reportClientError(new TypeError('bad'), 'at Cockpit')).resolves.toBe('SW-7F3A2C');
  });

  it('posts the route and a name-prefixed message', async () => {
    const spy = stubFetch(async (): Promise<Response> => new Response(JSON.stringify({ faultCode: 'SW-000001' }), { status: 201 }));
    await reportClientError(new TypeError('bad'), '');
    const body = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ surface: 'admin', route: '/#/orders', message: 'TypeError: bad' });
  });

  it('reports the same crash only once so a render loop cannot flood the ledger', async () => {
    const spy = stubFetch(async (): Promise<Response> => new Response(JSON.stringify({ faultCode: 'SW-7F3A2C' }), { status: 201 }));
    await reportClientError(new TypeError('bad'), '');
    await reportClientError(new TypeError('bad'), '');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('still reports a different crash on the same route', async () => {
    const spy = stubFetch(async (): Promise<Response> => new Response(JSON.stringify({ faultCode: 'SW-000002' }), { status: 201 }));
    await reportClientError(new TypeError('bad'), '');
    await reportClientError(new RangeError('other'), '');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('never throws when the reporting endpoint itself fails', async () => {
    stubFetch(() => Promise.reject(new Error('network down')));
    await expect(reportClientError(new TypeError('bad'), '')).resolves.toBeNull();
  });

  it('returns null when the server rejects the report', async () => {
    stubFetch(async (): Promise<Response> => new Response('{}', { status: 403 }));
    await expect(reportClientError(new TypeError('bad'), '')).resolves.toBeNull();
  });
});
