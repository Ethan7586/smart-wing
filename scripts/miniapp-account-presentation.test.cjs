const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const presentationPath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/accountPresentation.js');
const runtimeCachePath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/runtimeCache.js');

function loadMiniModule(file) {
  const module = { exports: {} };
  const source = fs.readFileSync(file, 'utf8');
  new Function('module', 'exports', source)(module, module.exports);
  return module.exports;
}

const presentation = loadMiniModule(presentationPath);

function homeEnvelope(accounts = []) {
  return {
    bootstrap: {
      actor: {
        displayName: '张三',
        employeeNo: 'EMP-2026-0018',
        departmentName: '数字化推进部',
        assurance: { phoneVerified: true },
      },
      scope: { enterpriseName: '示范企业', mallName: '智慧翼福利商城' },
    },
    accounts: { items: accounts },
    orders: { items: [] },
  };
}

test('actual /api/v1/home envelope maps to member and balances', () => {
  const source = homeEnvelope([
    { type: 'welfare', balanceCents: 258000 },
    { type: 'meal', balanceCents: 65000 },
  ]);
  assert.deepEqual(presentation.memberSummary(source), {
    memberName: '张三',
    employeeNo: 'EMP-2026-0018',
    departmentName: '数字化推进部',
    enterpriseName: '示范企业',
    mallName: '智慧翼福利商城',
    phoneVerified: true,
    welfareCents: 258000,
    mealCents: 65000,
  });
});

test('missing account data stays unknown instead of becoming a fake zero', () => {
  const summary = presentation.memberSummary(homeEnvelope());
  assert.equal(summary.welfareCents, null);
  assert.equal(summary.mealCents, null);
});

test('digital member card uses actual profile fields and masks employee number', () => {
  assert.deepEqual(presentation.memberCard(homeEnvelope()), {
    memberName: '张三',
    enterpriseName: '示范企业',
    level: '已认证会员',
    maskedNo: 'EM****18',
    phoneVerified: true,
    status: 'active',
  });
});

test('runtime pages no longer read the removed assets contract or generic member seed', () => {
  const home = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/home/home.js'), 'utf8');
  const profilePage = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/profile/profile.js'), 'utf8');
  const memberCodePage = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/membercode/membercode.js'), 'utf8');
  const profile = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/profile/profile.wxml'), 'utf8');
  assert.doesNotMatch(home, /snapshot\.assets|monthlyQuotaLabel/);
  assert.doesNotMatch(profilePage, /if \(!api\.isWired\(\)\)/);
  assert.match(memberCodePage, /loadCard:[\s\S]*?\.getMemberCard\(\)/);
  assert.match(profilePage, /readCachedHomeSnapshot\(\)/);
  assert.match(fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/orders/orders.js'), 'utf8'), /readCachedOrders\(\)/);
  assert.doesNotMatch(profile, /智慧翼会员/);
});

test('member runtime cache preserves a valid empty order result for instant rendering', () => {
  const values = {};
  const cache = loadMiniModule(runtimeCachePath).createRuntimeCache({
    getStorageSync: (key) => values[key],
    setStorageSync: (key, value) => {
      values[key] = value;
    },
    removeStorageSync: (key) => delete values[key],
  });
  cache.writeHome(homeEnvelope());
  cache.writeOrders({ items: [] });
  assert.equal(cache.readHome().data.bootstrap.actor.displayName, '张三');
  assert.deepEqual(cache.readOrders().data.items, []);
  assert.equal(cache.readOrders().stale, false);
});
