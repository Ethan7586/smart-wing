import { createHash } from 'node:crypto';

export interface CacheProjectionMetadata {
  projectionVersion?: string;
  sourceCursor?: string | null;
  generatedAt?: string;
}

export interface CacheEnvelope<T> {
  schemaVersion: 2;
  projectionVersion: string;
  sourceCursor: string | null;
  contentHash: string;
  generatedAt: string;
  storedAt: number;
  expiresAt: number;
  staleUntil: number;
  data: T;
}

export type CacheFreshness = 'fresh' | 'stale' | 'expired';

export function createCacheEnvelope<T>(data: T, freshSeconds: number, staleSeconds: number, now = Date.now(), metadata: CacheProjectionMetadata = {}): CacheEnvelope<T> {
  if (!Number.isInteger(freshSeconds) || freshSeconds < 1) throw new Error('INVALID_FRESH_SECONDS');
  if (!Number.isInteger(staleSeconds) || staleSeconds < freshSeconds) throw new Error('INVALID_STALE_SECONDS');
  const contentHash = hashData(data);
  return {
    schemaVersion: 2,
    projectionVersion: validVersion(metadata.projectionVersion) ? metadata.projectionVersion : contentHash.slice(7, 31),
    sourceCursor: validCursor(metadata.sourceCursor) ? (metadata.sourceCursor ?? null) : null,
    contentHash,
    generatedAt: validDate(metadata.generatedAt) ? metadata.generatedAt : new Date(now).toISOString(),
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
    if (
      value.schemaVersion !== 2 ||
      !validVersion(value.projectionVersion) ||
      !validCursor(value.sourceCursor) ||
      !validHash(value.contentHash) ||
      !validDate(value.generatedAt) ||
      !Number.isFinite(value.storedAt) ||
      !Number.isFinite(value.expiresAt) ||
      !Number.isFinite(value.staleUntil) ||
      value.data === undefined ||
      hashData(value.data) !== value.contentHash
    ) {
      return null;
    }
    return value as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

function hashData(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function validVersion(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,80}$/.test(value);
}

function validCursor(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (typeof value === 'string' && value.length <= 160 && !/[\r\n]/.test(value));
}

function validHash(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
