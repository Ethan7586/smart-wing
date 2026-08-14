import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import OSS from 'ali-oss';

const DAY_MS = 86_400_000;

export function parseBackupDatabaseUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') throw new Error('BACKUP_DATABASE_URL must use PostgreSQL');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!url.hostname || !url.username || !database) throw new Error('BACKUP_DATABASE_URL is incomplete');
  return {
    host: url.hostname,
    port: url.port || '5432',
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    sslmode: url.searchParams.get('sslmode') || 'require',
  };
}

export function backupObjectKeys(createdAt, backupId) {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime()) || !/^[a-z0-9-]{8,80}$/.test(backupId)) throw new Error('INVALID_BACKUP_ID');
  const day = date.toISOString().slice(0, 10).replaceAll('-', '/');
  const prefix = `database/postgresql/${day}/smart-wing-${backupId}`;
  return { archive: `${prefix}.dump`, manifest: `${prefix}.manifest.json` };
}

export function createBackupManifest(input) {
  if (!/^sha256:[a-f0-9]{64}$/.test(input.sha256) || !Number.isInteger(input.bytes) || input.bytes < 1) throw new Error('INVALID_BACKUP_ARTIFACT');
  return {
    schemaVersion: 1,
    backupId: input.backupId,
    createdAt: input.createdAt,
    source: { engine: 'PostgreSQL', host: input.host, database: input.database },
    artifact: { format: 'pg_dump-custom', objectKey: input.objectKey, bytes: input.bytes, sha256: input.sha256 },
    verification: { pgRestoreList: true, verifiedAt: input.verifiedAt },
  };
}

async function main() {
  const config = readConfig();
  const connection = parseBackupDatabaseUrl(config.databaseUrl);
  await mkdir(config.localDir, { recursive: true, mode: 0o700 });
  await run('pg_dump', ['--version']);
  await run('pg_restore', ['--version']);
  if (config.dryRun) return console.log(JSON.stringify({ ready: true, dryRun: true, host: connection.host, bucket: config.bucket }));

  const createdAt = new Date().toISOString();
  const backupId = `${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomBytes(3).toString('hex')}`;
  const partial = path.join(config.localDir, `${backupId}.dump.partial`);
  const archive = path.join(config.localDir, `${backupId}.dump`);
  try {
    await run('pg_dump', ['--format=custom', '--compress=6', '--no-owner', '--no-privileges', '--host', connection.host, '--port', connection.port, '--username', connection.username, '--dbname', connection.database, '--file', partial], {
      PGPASSWORD: connection.password,
      PGSSLMODE: connection.sslmode,
    });
    await run('pg_restore', ['--list', partial]);
    await rename(partial, archive);
    const bytes = (await stat(archive)).size;
    const sha256 = `sha256:${await fileHash(archive)}`;
    const keys = backupObjectKeys(createdAt, backupId);
    const manifest = createBackupManifest({ backupId, createdAt, host: connection.host, database: connection.database, objectKey: keys.archive, bytes, sha256, verifiedAt: new Date().toISOString() });
    const manifestPath = `${archive}.manifest.json`;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await uploadAndVerify(config, archive, manifestPath, keys, bytes);
    await pruneLocal(config.localDir, config.localRetentionDays);
    console.log(JSON.stringify({ backup: 'verified', backupId, bytes, sha256, objectKey: keys.archive }));
  } catch (error) {
    await unlink(partial).catch(() => undefined);
    throw error;
  }
}

function readConfig() {
  return {
    databaseUrl: required('BACKUP_DATABASE_URL'),
    region: process.env.BACKUP_OSS_REGION?.trim() || 'oss-cn-beijing',
    bucket: required('BACKUP_OSS_BUCKET'),
    accessKeyId: required('BACKUP_OSS_ACCESS_KEY_ID'),
    accessKeySecret: required('BACKUP_OSS_ACCESS_KEY_SECRET'),
    stsToken: process.env.BACKUP_OSS_STS_TOKEN?.trim() || undefined,
    localDir: process.env.BACKUP_LOCAL_DIR?.trim() || '/var/backups/smart-wing/postgres',
    localRetentionDays: boundedInteger(process.env.BACKUP_LOCAL_RETENTION_DAYS, 7, 1, 30),
    dryRun: process.argv.includes('--dry-run'),
  };
}

async function uploadAndVerify(config, archive, manifestPath, keys, bytes) {
  const client = new OSS({ region: config.region, bucket: config.bucket, accessKeyId: config.accessKeyId, accessKeySecret: config.accessKeySecret, stsToken: config.stsToken, secure: true, authorizationV4: true });
  const headers = { 'x-oss-server-side-encryption': 'AES256' };
  await client.put(keys.archive, archive, { headers });
  await client.put(keys.manifest, manifestPath, { headers: { ...headers, 'content-type': 'application/json' } });
  const remote = await client.head(keys.archive);
  if (Number(remote.res?.headers?.['content-length']) !== bytes) throw new Error('BACKUP_UPLOAD_SIZE_MISMATCH');
}

async function fileHash(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function pruneLocal(directory, retentionDays) {
  const threshold = Date.now() - retentionDays * DAY_MS;
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^\d{14}-[a-f0-9]{6}\.dump(?:\.manifest\.json)?$/.test(entry.name))
      .map(async (entry) => {
        const file = path.join(directory, entry.name);
        if ((await stat(file)).mtimeMs < threshold) await unlink(file);
      })
  );
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, ...extraEnv }, windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr = `${stderr}${chunk}`.slice(-65_536)));
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} failed (${code}): ${stderr.trim()}`))));
  });
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function boundedInteger(raw, fallback, minimum, maximum) {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'BACKUP_FAILED');
    process.exitCode = 1;
  });
}
