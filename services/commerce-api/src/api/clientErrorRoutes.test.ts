import { describe, expect, it } from 'vitest';
import { parseClientErrorInput } from './clientErrorRoutes';

describe('client error report input', () => {
  it('accepts a complete admin report', () => {
    expect(parseClientErrorInput({ surface: 'admin', route: '/#/orders', message: 'TypeError: x', stack: 'at a', componentStack: 'at B' })).toEqual({
      surface: 'admin',
      route: '/#/orders',
      message: 'TypeError: x',
      stack: 'at a',
      componentStack: 'at B',
    });
  });

  it('treats a missing stack as absent rather than failing the report', () => {
    const parsed = parseClientErrorInput({ surface: 'storefront', route: '/', message: 'boom' });
    expect(parsed).toEqual({ surface: 'storefront', route: '/', message: 'boom', stack: null, componentStack: null });
  });

  it('rejects an unknown surface so reports cannot be filed against a made-up app', () => {
    expect(parseClientErrorInput({ surface: 'miniapp', route: '/', message: 'boom' })).toBeNull();
  });

  it('rejects an empty route or message', () => {
    expect(parseClientErrorInput({ surface: 'admin', route: '   ', message: 'boom' })).toBeNull();
    expect(parseClientErrorInput({ surface: 'admin', route: '/', message: '' })).toBeNull();
  });

  it('rejects an over-long message instead of silently truncating identity', () => {
    expect(parseClientErrorInput({ surface: 'admin', route: '/', message: 'x'.repeat(501) })).toBeNull();
  });

  it('caps an over-long stack so one report cannot fill the table', () => {
    const parsed = parseClientErrorInput({ surface: 'admin', route: '/', message: 'boom', stack: 'y'.repeat(9000) });
    expect(parsed?.stack).toHaveLength(8000);
  });

  it('ignores non-string stacks rather than storing junk', () => {
    expect(parseClientErrorInput({ surface: 'admin', route: '/', message: 'boom', stack: { evil: true } })?.stack).toBeNull();
  });

  it('rejects a non-object body', () => {
    expect(parseClientErrorInput(null)).toBeNull();
    expect(parseClientErrorInput('boom')).toBeNull();
  });
});
