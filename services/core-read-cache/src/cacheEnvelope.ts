export interface CacheEnvelope<T> {
  schemaVersion: 1;
  storedAt: number;
  expiresAt: number;
  staleUntil: number;
  data: T;
}

export type CacheFreshness = 'fresh' | 'stale' | 'expired';

export function createCacheEnvelope<T>(data: T, freshSeconds: number, staleSeconds: number, now = Date.now()): CacheEnvelope<T> {
  if (!Number.isInteger(freshSeconds) || freshSeconds < 1) throw new Error('INVALID_FRESH_SECONDS');
  if (!Number.isInteger(staleSeconds) || staleSeconds < freshSeconds) throw new Error('INVALID_STALE_SECONDS');
  return {
    schemaVersion: 1,
    storedAt: now,
    expiresAt: now + freshSeconds * 1_000,
    staleUntil: now + staleSeconds * 1_000,
    data,
  };
}

export function cacheFreshness(envelope: CacheEnvelope<unknown>, now = Date.now()): CacheFreshness {
  if (envelope.staleUntil <= now) return 'expired';
  if (envelope.expiresAt <= now) return 'stale';
  return 'fresh';
}

export function parseCacheEnvelope<T>(input: string): CacheEnvelope<T> | null {
  try {
    const value = JSON.parse(input) as Partial<CacheEnvelope<T>>;
    if (value.schemaVersion !== 1 || !Number.isFinite(value.storedAt) || !Number.isFinite(value.expiresAt) || !Number.isFinite(value.staleUntil) || value.data === undefined) {
      return null;
    }
    return value as CacheEnvelope<T>;
  } catch {
    return null;
  }
}
