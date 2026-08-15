const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'database/supabase/migrations/20260815160000_dynamic_member_code.sql'), 'utf8');
const pageScript = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/membercode/membercode.js'), 'utf8');
const pageMarkup = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/membercode/membercode.wxml'), 'utf8');

test('member code stores only a credential hash and expires after 45 seconds', () => {
  assert.match(migration, /credential_hash text not null unique/);
  assert.doesNotMatch(migration, /\n\s*credential\s+text/i);
  assert.match(migration, /now\(\)\+interval '45 seconds'/);
  assert.match(migration, /member_code_challenges_retention/);
});

test('member code verification is locked, scoped and consumed exactly once', () => {
  assert.match(migration, /credential_hash=p_credential_hash for update/);
  assert.match(migration, /membership\.authz_version=challenge\.authz_version/);
  assert.match(migration, /api_member_phone_verified\(challenge\.membership_id,challenge\.user_id\)/);
  assert.match(migration, /membership\.tenant_id=challenge\.tenant_id/);
  assert.match(migration, /membership\.enterprise_id=challenge\.enterprise_id/);
  assert.match(migration, /membership\.mall_id=challenge\.mall_id/);
  assert.match(migration, /status='consumed',consumed_at=now\(\)/);
  assert.match(migration, /where id=challenge\.id and status='active'/);
});

test('member code page revokes hidden codes and never falls back to a simulated code', () => {
  assert.match(pageScript, /onHide:\s*function \(\) \{[\s\S]*?this\.closeChallenge\(\);[\s\S]*?\},/);
  assert.match(pageScript, /onUnload:\s*function \(\) \{[\s\S]*?this\.closeChallenge\(\);[\s\S]*?\},/);
  assert.match(pageScript, /revokeMemberCodeChallenge\(challengeId\)/);
  assert.doesNotMatch(`${pageScript}\n${pageMarkup}`, /Math\.random|ZHAO-TEST-0001/);
  assert.doesNotMatch(pageMarkup, /<canvas[^>]+wx:else|barcode-bars|barcodes?/i);
});
