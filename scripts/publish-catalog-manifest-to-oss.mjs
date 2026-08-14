import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OSS from 'ali-oss';
import { catalogManifestKeys, createCatalogManifest, serializeCatalogManifest } from './catalog-manifest.mjs';

const SOURCE = process.env.SW_PUBLIC_CATALOG_URL || 'https://hbbtzn.com/api/v1/catalog/public/products?cursor=0&limit=200';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function client() {
  return new OSS({
    region: process.env.ALIYUN_OSS_REGION?.trim() || 'oss-cn-beijing',
    bucket: process.env.ALIYUN_OSS_BUCKET?.trim() || 'btshangcheng',
    accessKeyId: required('ALIYUN_OSS_ACCESS_KEY_ID'),
    accessKeySecret: required('ALIYUN_OSS_ACCESS_KEY_SECRET'),
    stsToken: process.env.ALIYUN_OSS_STS_TOKEN?.trim() || undefined,
    secure: true,
    authorizationV4: true,
  });
}

async function main() {
  const response = await fetch(SOURCE, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const manifest = createCatalogManifest(await response.json());
  const keys = catalogManifestKeys(manifest);
  const bytes = serializeCatalogManifest(manifest);
  const oss = client();
  await oss.put(keys.immutable, bytes, {
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Type': 'application/json; charset=utf-8' },
  });
  await oss.put(keys.latest, bytes, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300', 'Content-Type': 'application/json; charset=utf-8' },
  });
  const report = { generatedAt: new Date().toISOString(), source: SOURCE, keys, bytes: bytes.length, mirror: manifest.mirror };
  await mkdir('.codex-temp', { recursive: true });
  await writeFile(path.join('.codex-temp', 'catalog-manifest-publish.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Published ${manifest.items.length} products as ${manifest.mirror.catalogVersion}`);
}

await main();
