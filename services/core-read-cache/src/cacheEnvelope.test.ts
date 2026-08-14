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
    expect(parseCacheEnvelope('{"schemaVersion":2}')).toBeNull();
    expect(parseCacheEnvelope('not-json')).toBeNull();
  });

  it('round-trips a valid envelope', () => {
    const envelope = createCacheEnvelope(['a', 'b'], 60, 600, 2_000);
    expect(parseCacheEnvelope<string[]>(JSON.stringify(envelope))).toEqual(envelope);
  });
});
