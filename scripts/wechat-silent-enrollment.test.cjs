const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'database/supabase/migrations/20260815180000_wechat_silent_enrollment.sql'), 'utf8');

test('silent enrollment is idempotent for one verified AppID and OpenID', () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /on conflict \(app_id, open_id\) do nothing/);
  assert.match(migration, /for update/);
  assert.match(migration, /'created', false/);
});

test('silent enrollment uses a server-selected mall and never merges by UnionID', () => {
  assert.match(migration, /where mall\.public_slug = normalized_mall_slug/);
  assert.doesNotMatch(migration, /where\s+union_id\s*=/i);
  assert.doesNotMatch(migration, /join\s+public\.member_wechat_identities[^;]+union_id/i);
});

test('raw WeChat identifiers are not copied into the member profile', () => {
  assert.match(migration, /identity_hash := encode\(digest\(normalized_app_id \|\| ':' \|\| normalized_open_id/);
  assert.match(migration, /identity_subject := 'wechat:' \|\| identity_hash/);
  assert.doesNotMatch(migration, /values\s*\([^;]*normalized_open_id[^;]*\)\s*;\s*\n\s*insert into public\.members/i);
});

test('only the server service role can execute silent enrollment', () => {
  assert.match(migration, /revoke all on function public\.api_ensure_wechat_member[^;]+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.api_ensure_wechat_member[^;]+to service_role/);
});
