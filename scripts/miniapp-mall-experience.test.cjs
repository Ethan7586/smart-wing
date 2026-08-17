const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function loadMiniModule(file, requireOverride) {
  const module = { exports: {} };
  const source = fs.readFileSync(file, 'utf8');
  new Function('module', 'exports', 'require', source)(module, module.exports, requireOverride || require);
  return module.exports;
}

const demo = loadMiniModule(path.join(root, 'apps/wechat-miniapp/miniprogram/data/demo.js'), (request) => {
  if (request === './assets.generated') return { partners: {} };
  return require(request);
});
const mallExperience = loadMiniModule(path.join(root, 'apps/wechat-miniapp/miniprogram/utils/mallExperience.js'));

test('missing published configuration falls back to the frozen mini-program structure', () => {
  const result = mallExperience.resolve(null, demo);
  assert.equal(result.mallDisplayName, '智慧翼福利商城');
  assert.deepEqual(result.entries, demo.entries);
  assert.equal(result.memberCodeCta.title, '到店出示会员码');
});

test('published configuration changes approved presentation fields only', () => {
  const result = mallExperience.resolve(
    {
      schemaVersion: 1,
      mallDisplayName: '华中员工福利商城',
      themePreset: 'festival-blue',
      announcement: '本周五企业福利专场',
      hero: { title: '员工福利周', subtitle: '企业专属 · 限时开放' },
      entries: [
        { key: 'partner', label: '合作门店', visible: true, sortOrder: 1 },
        { key: 'enterprise', label: '企业专区', visible: true, sortOrder: 2 },
        { key: 'voucher', label: '电子卡券', visible: false, sortOrder: 3 },
        { key: 'city', label: '城市专区', visible: true, sortOrder: 4 },
      ],
      partners: ['全部', '本地商超'],
      segments: [
        { key: 'grocery', title: '本地好物', description: '企业采购优选', visible: true, sortOrder: 1 },
        { key: 'life', title: '生活服务', description: '', visible: false, sortOrder: 2 },
        { key: 'digital', title: '数码办公', description: '高效办公', visible: true, sortOrder: 3 },
        { key: 'dining', title: '餐饮福利', description: '员工专享', visible: true, sortOrder: 4 },
      ],
      memberCodeCta: { title: '到店出示会员码', description: '仅用于会员身份与权益核验' },
      recommendationLimit: 4,
    },
    demo
  );
  assert.equal(result.mallDisplayName, '华中员工福利商城');
  assert.equal(result.themePreset, 'festival-blue');
  assert.equal(result.announcement, '本周五企业福利专场');
  assert.deepEqual(
    result.entries.map((entry) => entry.key),
    ['partner', 'enterprise', 'city']
  );
  assert.equal(result.partners[1].label, '本地商超');
  assert.equal(result.segments[0].desc, '企业采购优选');
  assert.equal(result.memberCodeCta.title, '到店出示会员码');
  assert.equal(result.recommendationLimit, 4);
});

test('unknown entry and segment keys cannot alter the frozen navigation structure', () => {
  const result = mallExperience.resolve(
    {
      schemaVersion: 1,
      mallDisplayName: '测试商城',
      entries: [{ key: 'payment', label: '付款码', visible: true, sortOrder: 1 }],
      segments: [{ key: 'unknown', title: '未知入口', visible: true, sortOrder: 1 }],
    },
    demo
  );
  assert.deepEqual(result.entries, []);
  assert.deepEqual(result.segments, []);
  assert.equal(result.memberCodeCta.title, '到店出示会员码');
});
