import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OSS from 'ali-oss';
import sharp from 'sharp';

const DEFAULT_CATALOG_URL = 'https://hbbtzn.com/api/v1/catalog/public/products?cursor=0&limit=200';
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function sourceUrl(value) {
  if (typeof value !== 'string') return null;
  const url = new URL(value);
  const nested = url.searchParams.get('source');
  const candidate = nested ? new URL(nested) : url;
  return candidate.protocol === 'https:' ? candidate.href : null;
}

function safeKeyPart(value) {
  const result = String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!result) throw new Error('Product id cannot produce an OSS object key');
  return result;
}

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: { accept: 'image/avif,image/webp,image/jpeg,image/png,image/*' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Image download failed (${response.status})`);
  const type = response.headers.get('content-type')?.toLowerCase() ?? '';
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (!type.startsWith('image/') || declared > MAX_SOURCE_BYTES) throw new Error('Image response is invalid or too large');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) throw new Error('Image response is empty or too large');
  return bytes;
}

async function optimizedWebp(source, width) {
  return sharp(source, { failOn: 'warning', limitInputPixels: 40_000_000 }).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78, effort: 5, smartSubsample: true }).toBuffer();
}

async function patchProductCover(productId, coverUrl) {
  const base = required('SUPABASE_URL').replace(/\/+$/, '');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const url = new URL(`${base}/rest/v1/products`);
  url.searchParams.set('id', `eq.${productId}`);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ cover_url: coverUrl }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Database update failed (${response.status}): ${await response.text()}`);
}

async function mapLimit(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

async function main() {
  const catalogUrl = arg('source', process.env.SW_PUBLIC_CATALOG_URL || DEFAULT_CATALOG_URL);
  const limit = Math.min(Math.max(Number.parseInt(arg('limit', '200'), 10) || 200, 1), 200);
  const concurrency = Math.min(Math.max(Number.parseInt(arg('concurrency', '6'), 10) || 6, 1), 12);
  const width = Math.min(Math.max(Number.parseInt(arg('width', '640'), 10) || 640, 240), 1600);
  const dryRun = flag('dry-run');
  const publicBase = required('PUBLIC_MEDIA_BASE_URL').replace(/\/+$/, '');
  const response = await fetch(catalogUrl, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const payload = await response.json();
  const products = (Array.isArray(payload?.items) ? payload.items : []).slice(0, limit);
  if (!products.length) throw new Error('Catalog returned no products');

  const client = dryRun
    ? null
    : new OSS({
        region: process.env.ALIYUN_OSS_REGION?.trim() || 'oss-cn-beijing',
        bucket: process.env.ALIYUN_OSS_BUCKET?.trim() || 'btshangcheng',
        accessKeyId: required('ALIYUN_OSS_ACCESS_KEY_ID'),
        accessKeySecret: required('ALIYUN_OSS_ACCESS_KEY_SECRET'),
        stsToken: process.env.ALIYUN_OSS_STS_TOKEN?.trim() || undefined,
        secure: true,
        authorizationV4: true,
      });

  const uploaded = await mapLimit(products, concurrency, async (product, index) => {
    const source = sourceUrl(product.coverUrl);
    if (!product.id || !source) throw new Error(`Product ${index + 1} has no safe cover image`);
    const output = await optimizedWebp(await fetchImage(source), width);
    const digest = createHash('sha256').update(output).digest('hex').slice(0, 12);
    const objectKey = `catalog/products/${safeKeyPart(product.id)}/cover-${width}-${digest}.webp`;
    const coverUrl = `${publicBase}/${objectKey}`;
    if (client) {
      await client.put(objectKey, output, {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Disposition': 'inline',
          'Content-Type': 'image/webp',
        },
      });
    }
    console.log(`${index + 1}/${products.length} ${product.id} ${Math.round(output.length / 1024)}KB`);
    return { id: product.id, source, objectKey, coverUrl, bytes: output.length };
  });

  if (!dryRun) {
    for (const item of uploaded) await patchProductCover(item.id, item.coverUrl);
  }
  await mkdir('.codex-temp', { recursive: true });
  await writeFile(path.join('.codex-temp', 'catalog-media-sync.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), dryRun, items: uploaded }, null, 2)}\n`, 'utf8');
  console.log(`${dryRun ? 'Validated' : 'Uploaded and linked'} ${uploaded.length} product images`);
}

await main();
