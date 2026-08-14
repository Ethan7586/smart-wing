import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createClient } from 'redis';
import { cacheFreshness, createCacheEnvelope, parseCacheEnvelope } from './cacheEnvelope';

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_FRESH_SECONDS = 24 * 60 * 60;
const MAX_STALE_SECONDS = 7 * 24 * 60 * 60;
const CACHE_KEY = /^sw:v[12]:[a-z0-9:_-]{1,240}$/;

const host = required('TAIR_HOST');
const password = required('TAIR_PASSWORD');
const token = required('CORE_READ_CACHE_TOKEN');
const port = integer(process.env.CORE_READ_CACHE_PORT, 3002);
const redisPort = integer(process.env.TAIR_PORT, 6379);
const username = process.env.TAIR_USERNAME?.trim() || undefined;
const tls = process.env.TAIR_TLS_ENABLED !== 'false';
const reconnectStrategy = (retries: number) => Math.min(100 * 2 ** retries, 3_000);

const redis = createClient({
  username,
  password,
  socket: tls ? { host, port: redisPort, tls: true, reconnectStrategy } : { host, port: redisPort, reconnectStrategy },
});

redis.on('error', (error) => console.error(JSON.stringify({ level: 'error', event: 'core_cache_redis_error', message: error.message })));

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      return send(response, redis.isReady ? 200 : 503, { service: 'smart-wing-core-read-cache', ready: redis.isReady });
    }
    if (!authorized(request)) return send(response, 401, { error: 'UNAUTHORIZED' });
    const key = readKey(request.url);
    if (!key) return send(response, 404, { error: 'NOT_FOUND' });
    if (request.method === 'GET') return readEntry(response, key);
    if (request.method === 'PUT') return writeEntry(request, response, key);
    if (request.method === 'DELETE') {
      await redis.del(key);
      return send(response, 204);
    }
    return send(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { allow: 'GET, PUT, DELETE' });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'core_cache_request_failed', message: error instanceof Error ? error.message : 'unknown' }));
    return send(response, 503, { error: 'CACHE_UNAVAILABLE' });
  }
});

async function readEntry(response: ServerResponse, key: string): Promise<void> {
  const raw = await redis.get(key);
  if (!raw) return send(response, 404, { cache: 'miss' });
  const envelope = parseCacheEnvelope<unknown>(raw);
  if (!envelope || cacheFreshness(envelope) === 'expired') {
    await redis.del(key);
    return send(response, 404, { cache: 'miss' });
  }
  return send(response, 200, { cache: cacheFreshness(envelope), envelope });
}

async function writeEntry(request: IncomingMessage, response: ServerResponse, key: string): Promise<void> {
  const body = await readJson(request);
  const freshSeconds = boundedInteger(body.freshSeconds, 1, MAX_FRESH_SECONDS);
  const staleSeconds = boundedInteger(body.staleSeconds, freshSeconds, MAX_STALE_SECONDS);
  if (!('data' in body)) return send(response, 400, { error: 'DATA_REQUIRED' });
  const envelope = createCacheEnvelope(body.data, freshSeconds, staleSeconds, Date.now(), {
    projectionVersion: optionalString(body.projectionVersion),
    sourceCursor: optionalString(body.sourceCursor),
    generatedAt: optionalString(body.generatedAt),
  });
  await redis.set(key, JSON.stringify(envelope), { PX: staleSeconds * 1_000 });
  return send(response, 201, { cache: 'stored', storedAt: envelope.storedAt });
}

function readKey(rawUrl: string | undefined): string | null {
  const match = /^\/v1\/entries\/([^/?]+)$/.exec(rawUrl ?? '');
  if (!match) return null;
  try {
    const key = decodeURIComponent(match[1]);
    return CACHE_KEY.test(key) ? key : null;
  } catch {
    return null;
  }
}

function authorized(request: IncomingMessage): boolean {
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += bytes.length;
    if (received > MAX_BODY_BYTES) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(bytes);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_JSON');
  return parsed as Record<string, unknown>;
}

function send(response: ServerResponse, status: number, body?: unknown, extra: Record<string, string> = {}): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...extra,
  });
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new Error('INVALID_TTL');
  return Number(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({ level: 'info', event: 'core_cache_shutdown', signal }));
  server.close();
  if (redis.isOpen) await redis.quit();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await redis.connect();
server.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({ level: 'info', event: 'core_cache_ready', port, redisTls: tls }));
});
