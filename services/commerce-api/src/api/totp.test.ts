import { describe, expect, it } from 'vitest';
import { verifyTotp } from './totp';

describe('TOTP verification', () => {
  // RFC 6238 Appendix B, SHA-1 secret, reduced from the published eight-digit
  // value 94287082 to the six-digit value accepted by the product UI.
  it('accepts a valid RFC 6238 time-based code', async () => {
    await expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000, 0)).resolves.toBe(true);
  });

  it('rejects an invalid code and rejects codes outside the permitted drift window', async () => {
    await expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287083', 59_000, 0)).resolves.toBe(false);
    await expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000 + 60_000, 1)).resolves.toBe(false);
  });

  it('fails closed for malformed factors and codes', async () => {
    await expect(verifyTotp('not a factor', '287082', 59_000)).resolves.toBe(false);
    await expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '12345', 59_000)).resolves.toBe(false);
  });
});
