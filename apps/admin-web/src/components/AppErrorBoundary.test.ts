import { describe, expect, it } from 'vitest';
import { toError } from './AppErrorBoundary';

describe('runtime error conversion', () => {
  it('keeps an existing Error and its type intact', () => {
    const source = new TypeError('missing member list');
    expect(toError(source, 'fallback')).toBe(source);
  });

  it('turns a rejected string into a reportable Error', () => {
    expect(toError('network interrupted', 'fallback')).toMatchObject({ message: 'network interrupted' });
  });

  it('uses the fallback only when a rejection has no safe message', () => {
    expect(toError({ unexpected: true }, '异步操作异常')).toMatchObject({ message: '异步操作异常' });
  });
});
