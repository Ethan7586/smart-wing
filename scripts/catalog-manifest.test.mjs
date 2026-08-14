import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogManifestKeys, createCatalogManifest, serializeCatalogManifest } from './catalog-manifest.mjs';

test('catalog manifest is content-addressed and deterministic', () => {
  const payload = { items: [{ id: 'one', coverUrl: 'https://img.hbbtzn.com/one.webp' }] };
  const first = createCatalogManifest(payload, new Date('2026-08-15T00:00:00Z'));
  const second = createCatalogManifest(payload, new Date('2026-08-15T00:00:00Z'));
  assert.deepEqual(first, second);
  assert.match(first.mirror.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(catalogManifestKeys(first), {
    immutable: `catalog/public/v1/${first.mirror.catalogVersion}.json`,
    latest: 'catalog/public/v1/latest.json',
  });
  assert.equal(JSON.parse(serializeCatalogManifest(first)).items[0].id, 'one');
});

test('catalog manifest version changes with business content and caps at 200', () => {
  const items = Array.from({ length: 205 }, (_, index) => ({ id: String(index) }));
  const first = createCatalogManifest({ items });
  const second = createCatalogManifest({ items: [{ id: 'changed' }] });
  assert.equal(first.items.length, 200);
  assert.notEqual(first.mirror.catalogVersion, second.mirror.catalogVersion);
  assert.equal(first.access.purchaseQualification, false);
});
