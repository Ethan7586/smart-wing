import assert from 'node:assert/strict';
import test from 'node:test';
import { backupObjectKeys, createBackupManifest, parseBackupDatabaseUrl } from './postgres-backup.mjs';

test('database credentials are parsed without entering commands or manifests', () => {
  const parsed = parseBackupDatabaseUrl('postgresql://backup-user:p%40ss@db.example:6543/smart_wing?sslmode=verify-full');
  assert.deepEqual(parsed, { host: 'db.example', port: '6543', username: 'backup-user', password: 'p@ss', database: 'smart_wing', sslmode: 'verify-full' });
});

test('backup keys are immutable date partitions', () => {
  assert.deepEqual(backupObjectKeys('2026-08-15T01:02:03.000Z', '20260815010203'), {
    archive: 'database/postgresql/2026/08/15/smart-wing-20260815010203.dump',
    manifest: 'database/postgresql/2026/08/15/smart-wing-20260815010203.manifest.json',
  });
});

test('manifest proves archive integrity without storing credentials', () => {
  const manifest = createBackupManifest({
    backupId: '20260815010203',
    createdAt: '2026-08-15T01:02:03.000Z',
    host: 'db.example',
    database: 'smart_wing',
    objectKey: 'database/postgresql/2026/08/15/smart-wing-20260815010203.dump',
    bytes: 42,
    sha256: `sha256:${'a'.repeat(64)}`,
    verifiedAt: '2026-08-15T01:02:04.000Z',
  });
  assert.equal(manifest.artifact.bytes, 42);
  assert.equal(JSON.stringify(manifest).includes('password'), false);
});
