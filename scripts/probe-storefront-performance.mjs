import { readFile } from 'node:fs/promises';
import { parseServerTiming, percentile, scoreStorefrontPerformance } from './storefront-performance-score.mjs';

const DEFAULT_ORIGIN = 'https://hbbtzn.com';
const samples = positiveInteger(argument('--samples'), 5);
const origin = normalizeOrigin(argument('--origin') || DEFAULT_ORIGIN);
const browser = await readBrowserMetrics(argument('--browser-metrics'));

async function request(path, accept) {
  const startedAt = performance.now();
  try {
    const response = await fetch(new URL(path, origin), { headers: { accept }, signal: AbortSignal.timeout(15_000) });
    const body = await response.arrayBuffer();
    return {
      ok: response.ok,
      status: response.status,
      durationMs: performance.now() - startedAt,
      contentType: response.headers.get('content-type') || '',
      cacheControl: response.headers.get('cache-control') || '',
      cacheTier: response.headers.get('x-sw-catalog-cache-tier') || '',
      serverCatalogMs: parseServerTiming(response.headers.get('server-timing'), 'catalog'),
      body: new Uint8Array(body),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: performance.now() - startedAt,
      contentType: '',
      cacheControl: '',
      cacheTier: '',
      serverCatalogMs: null,
      body: new Uint8Array(),
      error: error instanceof Error ? error.message : 'unknown request failure',
    };
  }
}

async function collect(path, accept) {
  const results = [];
  for (let index = 0; index < samples; index += 1) results.push(await request(path, accept));
  return results;
}

function summary(results) {
  return { allOk: results.every((result) => result.ok), p95Ms: percentile(results.map((result) => result.durationMs)) };
}

function validCatalogJson(result) {
  if (!result.contentType.includes('application/json') || !result.body.byteLength) return false;
  try {
    const body = JSON.parse(new TextDecoder().decode(result.body));
    return Array.isArray(body?.items) && body.items.length > 0;
  } catch {
    return false;
  }
}

const [documentResults, mirrorResults, catalogResults, healthResults] = await Promise.all([
  collect('/', 'text/html'),
  collect('/catalog/public/v1/latest.json', 'application/json'),
  collect('/api/v1/catalog/public/products?cursor=0&limit=24', 'application/json'),
  collect('/api/health', 'application/json'),
]);

const catalogWarmResults = catalogResults.slice(1);
const result = scoreStorefrontPerformance({
  document: summary(documentResults),
  catalogMirror: {
    ...summary(mirrorResults),
    cacheable: mirrorResults.every((item) => /\bpublic\b/i.test(item.cacheControl)),
    validJson: mirrorResults.every(validCatalogJson),
  },
  catalogApi: {
    ...summary(catalogWarmResults),
    cacheHit: catalogWarmResults.length > 0 && catalogWarmResults.every((item) => ['memory', 'shared', 'stale'].includes(item.cacheTier)),
    serverP95Ms: percentile(catalogWarmResults.map((item) => item.serverCatalogMs)),
  },
  liveness: { ...summary(healthResults), probe: await healthProbe(healthResults) },
  browser,
});

const report = {
  origin,
  samples,
  score: result,
  transport: {
    document: compact(documentResults),
    catalogMirror: compact(mirrorResults),
    catalogApiWarm: compact(catalogWarmResults),
    liveness: compact(healthResults),
  },
  browser,
};
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--strict') && !result.passed) process.exitCode = 1;

async function healthProbe(results) {
  const response = results.find((result) => result.ok && result.contentType.includes('application/json'));
  if (!response) return null;
  try {
    return JSON.parse(new TextDecoder().decode(response.body))?.probe || null;
  } catch {
    return null;
  }
}

function compact(results) {
  return results.map((item) => ({ status: item.status, durationMs: Math.round(item.durationMs), cacheTier: item.cacheTier || undefined, serverCatalogMs: item.serverCatalogMs, error: item.error }));
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInteger(value, fallback) {
  const number = Number.parseInt(value || '', 10);
  return Number.isInteger(number) && number >= 2 && number <= 30 ? number : fallback;
}

function normalizeOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Origin must use http or https');
  return `${url.origin}/`;
}

async function readBrowserMetrics(file) {
  if (!file) return null;
  const value = JSON.parse(await readFile(file, 'utf8'));
  if (!value || !Number.isFinite(value.lcpMs) || !Number.isFinite(value.inpMs) || !Number.isFinite(value.cls) || !Number.isFinite(value.errorRate)) {
    throw new Error('Browser metrics JSON must contain finite lcpMs, inpMs, cls and errorRate values');
  }
  return { lcpMs: value.lcpMs, inpMs: value.inpMs, cls: value.cls, errorRate: value.errorRate };
}
