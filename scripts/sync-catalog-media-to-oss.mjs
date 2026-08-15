import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OSS from 'ali-oss';
import sharp from 'sharp';
import { catalogVariantKey, publicMediaUrl, resolveVariantPlan, sourceVersion } from './catalog-media-cache.mjs';

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

async function patchProductCovers(items) {
  const base = required('SUPABASE_URL').replace(/\/+$/, '');
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${base}/rest/v1/rpc/api_sync_catalog_media_covers`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_items: items.map(({ id, coverUrl }) => ({ id, coverUrl })) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Database update failed (${response.status}): ${await response.text()}`);
  const updated = Number(await response.text());
  if (!Number.isInteger(updated) || updated < 0 || updated > items.length) {
    throw new Error('Database update returned an invalid result');
  }
  return updated;
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
  const plan = resolveVariantPlan({
    widths: arg('widths', process.env.CATALOG_MEDIA_WIDTHS),
    legacyWidth: arg('width'),
    defaultWidth: arg('default-width', process.env.CATALOG_MEDIA_DEFAULT_WIDTH),
  });
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
    const downloaded = await fetchImage(source);
    const version = sourceVersion(downloaded);
    const variants = [];
    for (const variantWidth of plan.widths) {
      const output = await optimizedWebp(downloaded, variantWidth);
      const objectKey = catalogVariantKey(product.id, version, variantWidth);
      const url = publicMediaUrl(publicBase, objectKey);
      if (client) {
        await client.put(objectKey, output, {
          headers: {
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Disposition': 'inline',
            'Content-Type': 'image/webp',
          },
        });
      }
      variants.push({ width: variantWidth, objectKey, url, bytes: output.length });
    }
    const canonical = variants.find((variant) => variant.width === plan.defaultWidth);
    const totalBytes = variants.reduce((sum, variant) => sum + variant.bytes, 0);
    console.log(`${index + 1}/${products.length} ${product.id} ${plan.widths.join('/')}px ${Math.round(totalBytes / 1024)}KB`);
    return { id: product.id, source, version, coverUrl: canonical.url, variants };
  });

  if (!dryRun) {
    const updated = await patchProductCovers(uploaded);
    console.log(`Linked ${updated} changed covers; ${uploaded.length - updated} were already current`);
  }
  await mkdir('.codex-temp', { recursive: true });
  const report = { generatedAt: new Date().toISOString(), dryRun, plan, items: uploaded };
  await writeFile(path.join('.codex-temp', 'catalog-media-sync.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`${dryRun ? 'Validated' : 'Uploaded and linked'} ${uploaded.length} products / ${uploaded.length * plan.widths.length} variants`);
}

await main();
