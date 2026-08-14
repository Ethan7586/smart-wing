import { createHash } from 'node:crypto';

export const CATALOG_MANIFEST_PREFIX = 'catalog/public/v1';
export const CATALOG_MANIFEST_LIMIT = 200;

function hashItems(items) {
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

export function createCatalogManifest(payload, now = new Date()) {
  const items = Array.isArray(payload?.items) ? payload.items.slice(0, CATALOG_MANIFEST_LIMIT) : [];
  if (!items.length) throw new Error('Public catalog manifest requires at least one item');
  const digest = hashItems(items);
  const catalogVersion = `catalog.${digest.slice(0, 24)}`;
  const generatedAt = payload?.mirror?.generatedAt || now.toISOString();
  return {
    items,
    mirror: {
      schemaVersion: 2,
      catalogVersion,
      sourceCursor: payload?.mirror?.sourceCursor || `cursor:0:limit:${CATALOG_MANIFEST_LIMIT}:items:${items.length}`,
      contentHash: `sha256:${digest}`,
      generatedAt,
    },
    access: { mode: 'public', memberPricing: false, purchaseQualification: false },
    pagination: { cursor: 0, nextCursor: null, limit: CATALOG_MANIFEST_LIMIT },
    requestId: 'cdn-catalog-manifest',
  };
}

export function catalogManifestKeys(manifest) {
  const version = manifest?.mirror?.catalogVersion;
  if (!/^catalog\.[a-f0-9]{24}$/.test(version || '')) throw new Error('Catalog manifest version is invalid');
  return {
    immutable: `${CATALOG_MANIFEST_PREFIX}/${version}.json`,
    latest: `${CATALOG_MANIFEST_PREFIX}/latest.json`,
  };
}

export function serializeCatalogManifest(manifest) {
  return Buffer.from(`${JSON.stringify(manifest)}\n`, 'utf8');
}
