import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, parseAdminOrderQuery } from './adminOrderQuery';

describe('admin order query parsing', () => {
  it('uses the default page size when omitted', () => {
    expect(parseAdminOrderQuery(new URL('https://smart.example/orders'), ORDER_STATUSES)).toMatchObject({ ok: true, value: { limit: 20, offset: 0 } });
  });

  it('clamps invalid and oversized page sizes to 100', () => {
    expect(parseAdminOrderQuery(new URL('https://smart.example/orders?limit=999'), ORDER_STATUSES)).toMatchObject({ ok: true, value: { limit: 100 } });
    expect(parseAdminOrderQuery(new URL('https://smart.example/orders?limit=wrong'), ORDER_STATUSES)).toMatchObject({ ok: true, value: { limit: 100 } });
  });

  it('keeps status validation strict', () => {
    expect(parseAdminOrderQuery(new URL('https://smart.example/orders?status=not-real'), ORDER_STATUSES)).toEqual({ ok: false, code: 'INVALID_STATUS' });
  });
});
