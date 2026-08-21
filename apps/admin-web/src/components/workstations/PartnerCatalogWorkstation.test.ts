import { describe, expect, it } from 'vitest';
import { buildChannelCatalogCards } from './PartnerCatalogWorkstation';

describe('channel catalog evidence cards', () => {
  it('keeps a planned channel pending when no service-side connection exists', () => {
    const jd = buildChannelCatalogCards([], []).find((channel) => channel.code === 'jd');
    expect(jd).toMatchObject({ name: '京东', connection: null, successfulSyncs: 0 });
  });

  it('matches a registered provider and counts only successful synchronizations', () => {
    const cards = buildChannelCatalogCards(
      [{ id: 'conn-1', providerCode: 'jd', displayName: '京东', externalCatalogReference: 'catalog-1', status: 'active', lastCheckedAt: null, createdAt: '2026-08-21T00:00:00Z', updatedAt: '2026-08-21T00:00:00Z' }],
      [
        { id: 'run-1', connectionId: 'conn-1', displayName: '京东', status: 'succeeded', sourceItemCount: 2, importedItemCount: 2, message: '', startedAt: null, finishedAt: null, createdAt: '2026-08-21T00:00:00Z' },
        { id: 'run-2', connectionId: 'conn-1', displayName: '京东', status: 'failed', sourceItemCount: 2, importedItemCount: 0, message: '', startedAt: null, finishedAt: null, createdAt: '2026-08-21T00:00:00Z' },
      ]
    );
    expect(cards.find((channel) => channel.code === 'jd')).toMatchObject({ connection: { id: 'conn-1' }, successfulSyncs: 1 });
  });
});
