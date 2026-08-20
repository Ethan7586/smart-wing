/**
 * The single set of request-body primitives for the commerce API parsers.
 *
 * Two conventions run through all of them:
 *
 *  - `null` means the caller did not supply the field.
 *  - `undefined` means the caller supplied something the contract rejects, and
 *    the route must answer 422 rather than guess.
 */

/**
 * An array is not a record. Accepting one lets `[]` satisfy a body check and
 * then read every field as `undefined`, which several parsers would go on to
 * treat as a merely incomplete object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRequiredString(record: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = record[key];
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

/**
 * Optional means the key may be omitted, not that it may be blank. An empty or
 * whitespace-only string is a caller that sent the key and filled in nothing;
 * on money-adjacent writes that ambiguity is answered with 422 rather than
 * silently recorded as "not provided".
 */
export function readOptionalString(record: Record<string, unknown>, key: string, maxLength: number): string | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : undefined;
}

export function readOptionalRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = record[key];
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return undefined;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 16 * 1024 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function readOptionalUrl(record: Record<string, unknown>, key: string): string | null | undefined {
  const value = readOptionalString(record, key, 2_000);
  if (value === null || value === undefined) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
