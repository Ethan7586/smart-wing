import { describe, expect, it } from 'vitest';
import { INITIAL_ORDERS } from '../../data/mockData';
import { buildOrderVolumeSeries } from './CockpitWorkstation';

describe('order volume series', () => {
  it('uses the machine timestamp instead of parsing the Chinese display text', () => {
    const orders = [
      {
        ...INITIAL_ORDERS[0],
        createdAt: '2026/8/8 19:20:00',
        createdAtIso: '2026-08-08T11:20:00.000Z',
      },
    ];

    const series = buildOrderVolumeSeries(orders);

    expect(series.at(-1)).toMatchObject({ key: '2026-08-08', value: 1 });
  });
});
