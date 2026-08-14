const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const sharePath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/share.js');
const publicPages = ['home', 'category', 'products', 'product-detail'];

function loadShare(wxMock) {
  const module = { exports: {} };
  const source = fs.readFileSync(sharePath, 'utf8');
  new Function('module', 'exports', 'wx', source)(module, module.exports, wxMock);
  return module.exports;
}

test('public share menu enables chat and Moments together', () => {
  let menus = [];
  const share = loadShare({ showShareMenu: (options) => (menus = options.menus) });
  share.enableMenu();
  assert.deepEqual(menus, ['shareAppMessage', 'shareTimeline']);
});

test('share builders keep a valid mini-program path and timeline query', () => {
  const share = loadShare({});
  assert.deepEqual(share.appMessage({ title: ' 商品 ', path: 'pages/product-detail/product-detail?id=one' }), {
    title: '商品',
    path: '/pages/product-detail/product-detail?id=one',
  });
  assert.deepEqual(share.timeline({ title: ' 商品 ', query: '?id=one' }), { title: '商品', query: 'id=one' });
});

test('copy URL uses the official Smart Wing domain', () => {
  let copied = '';
  const share = loadShare({ setClipboardData: ({ data }) => (copied = data) });
  assert.equal(share.copyOfficialUrl(), true);
  assert.equal(copied, 'https://hbbtzn.com/');
});

test('every public page opts into both native share channels', () => {
  for (const page of publicPages) {
    const base = path.join(root, 'apps/wechat-miniapp/miniprogram/pages', page, page);
    const config = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8'));
    const source = fs.readFileSync(`${base}.js`, 'utf8');
    assert.equal(config.enableShareAppMessage, true, `${page} chat share disabled`);
    assert.equal(config.enableShareTimeline, true, `${page} timeline share disabled`);
    assert.match(source, /onShareAppMessage/);
    assert.match(source, /onShareTimeline/);
  }
});
