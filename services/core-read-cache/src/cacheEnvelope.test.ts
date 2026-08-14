import { describe, expect, it } from 'vitest';
import { cacheFreshness, createCacheEnvelope, parseCacheEnvelope } from './cacheEnvelope';

describe('core read-cache envelope', () => {
  it('separates fresh, stale and expired windows', () => {
    const envelope = createCacheEnvelope({ id: 'catalog' }, 30, 300, 1_000);
    expect(cacheFreshness(envelope, 30_999)).toBe('fresh');
    expect(cacheFreshness(envelope, 31_000)).toBe('stale');
    expect(cacheFreshness(envelope, 301_000)).toBe('expired');
  });

  it('rejects malformed or unsupported payloads', () => {
    expect(parseCacheEnvelope('{"schemaVersion":1}')).toBeNull();
    expect(parseCacheEnvelope('not-json')).toBeNull();
  });

  it('round-trips a valid envelope', () => {
    const envelope = createCacheEnvelope(['a', 'b'], 60, 600, 2_000);
    expect(parseCacheEnvelope<string[]>(JSON.stringify(envelope))).toEqual(envelope);
  });

  it('carries a verifiable projection contract and rejects tampering', () => {
    const envelope = createCacheEnvelope({ items: ['a'] }, 60, 600, 2_000, {
      projectionVersion: 'catalog-42',
      sourceCursor: 'cursor:0:limit:200',
      generatedAt: '2026-08-15T00:00:00.000Z',
    });
    expect(envelope).toMatchObject({
      schemaVersion: 2,
      projectionVersion: 'catalog-42',
      sourceCursor: 'cursor:0:limit:200',
      generatedAt: '2026-08-15T00:00:00.000Z',
    });
    expect(envelope.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parseCacheEnvelope(JSON.stringify({ ...envelope, data: { items: ['changed'] } }))).toBeNull();
  });
});
