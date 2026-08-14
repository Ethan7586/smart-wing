import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCoreProjection, writeCoreProjection } from './coreReadCache';
import type { WorkerEnv } from './types';

const env: WorkerEnv = {
  CORE_READ_CACHE_URL: 'http://127.0.0.1:3002',
  CORE_READ_CACHE_TOKEN: 'internal-test-token',
};

afterEach(() => vi.restoreAllMocks());

describe('core read-cache client', () => {
  it('is disabled unless both private endpoint and token exist', async () => {
    expect(await readCoreProjection({}, 'sw:v1:catalog:public:demo')).toEqual({ status: 'disabled' });
  });

  it('reads a fresh projection without exposing the token in the URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ cache: 'fresh', envelope: { schemaVersion: 1, storedAt: 10, expiresAt: 20, staleUntil: 30, data: ['sku-1'] } }), { status: 200 }));
    expect(await readCoreProjection<string[]>(env, 'sw:v1:catalog:public:demo')).toEqual({ status: 'fresh', data: ['sku-1'], storedAt: 10 });
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('internal-test-token');
  });

  it('fails open to the source when the cache is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await readCoreProjection(env, 'sw:v1:catalog:public:demo')).toEqual({ status: 'unavailable' });
  });

  it('stores only bounded cache envelopes through the private service', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    expect(await writeCoreProjection(env, 'sw:v1:catalog:public:demo', { count: 200 }, 300, 86_400)).toBe(true);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PUT');
  });
});
