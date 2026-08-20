import { describe, expect, it } from 'vitest';
import { isRecord, readOptionalString, readOptionalUrl, readRequiredString } from './inputPrimitives';

// Both suites below cover a decision, not just a branch: until the voucher
// parsers were folded onto these primitives they carried their own copies that
// answered these two cases differently, and nothing failed when they disagreed.

describe('isRecord', () => {
  it('rejects an array so an empty list cannot pass as a request body', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([{ quantity: 1 }])).toBe(false);
  });

  it('rejects null and primitives, accepts a plain object', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord('reason')).toBe(false);
    expect(isRecord(7)).toBe(false);
    expect(isRecord({ reason: 'ok' })).toBe(true);
  });
});

describe('readOptionalString', () => {
  it('reports an omitted or explicitly null field as absent', () => {
    expect(readOptionalString({}, 'evidence', 200)).toBeNull();
    expect(readOptionalString({ evidence: null }, 'evidence', 200)).toBeNull();
  });

  it('rejects a blank value rather than treating it as absent', () => {
    expect(readOptionalString({ evidence: '' }, 'evidence', 200)).toBeUndefined();
    expect(readOptionalString({ evidence: '   ' }, 'evidence', 200)).toBeUndefined();
    expect(readOptionalString({ evidence: '\t\n' }, 'evidence', 200)).toBeUndefined();
  });

  it('rejects a non-string and an over-long value', () => {
    expect(readOptionalString({ evidence: 12 }, 'evidence', 200)).toBeUndefined();
    expect(readOptionalString({ evidence: 'x'.repeat(201) }, 'evidence', 200)).toBeUndefined();
  });

  it('trims an acceptable value', () => {
    expect(readOptionalString({ evidence: '  ticket-42  ' }, 'evidence', 200)).toBe('ticket-42');
  });
});

describe('readRequiredString', () => {
  it('rejects absent, blank, non-string and over-long values', () => {
    expect(readRequiredString({}, 'reason', 100)).toBeNull();
    expect(readRequiredString({ reason: '   ' }, 'reason', 100)).toBeNull();
    expect(readRequiredString({ reason: 5 }, 'reason', 100)).toBeNull();
    expect(readRequiredString({ reason: 'x'.repeat(101) }, 'reason', 100)).toBeNull();
  });

  it('trims an acceptable value', () => {
    expect(readRequiredString({ reason: ' 超时释放 ' }, 'reason', 100)).toBe('超时释放');
  });
});

describe('readOptionalUrl', () => {
  it('accepts http and https and rejects any other scheme', () => {
    expect(readOptionalUrl({ url: 'https://example.com/a' }, 'url')).toBe('https://example.com/a');
    expect(readOptionalUrl({ url: 'javascript:alert(1)' }, 'url')).toBeUndefined();
    expect(readOptionalUrl({ url: 'not a url' }, 'url')).toBeUndefined();
  });
});
