const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const apiPath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/api.js');
const seedPath = path.join(root, 'apps/wechat-miniapp/miniprogram/data/catalog-seed.generated.js');

function loadMiniModule(file, globals = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(file, 'utf8');
  function localRequire(request) {
    if (!request.startsWith('.')) return require(request);
    const target = path.resolve(path.dirname(file), request.endsWith('.js') ? request : `${request}.js`);
    return loadMiniModule(target, globals);
  }
  new Function('require', 'module', 'exports', 'wx', source)(localRequire, module, module.exports, globals.wx);
  return module.exports;
}

function freshApi(wxMock) {
  return loadMiniModule(apiPath, { wx: wxMock });
}

test('parallel consumers share one catalog request and one cache projection', async () => {
  const calls = [];
  let pending;
  const api = freshApi({
    getStorageSync: () => '',
    setStorage() {},
    request(options) {
      calls.push(options);
      pending = options;
      return { abort() {} };
    },
  });
  const first = api.listProducts({ cursor: 0, limit: 200 });
  const second = api.listProducts({ cursor: 0, limit: 200 });
  assert.equal(calls.length, 1);
  pending.success({
    statusCode: 200,
    data: { items: [{ id: 'shared', taxonomy: { l1: 'food' } }], pagination: { nextCursor: null } },
  });
  const [one, two] = await Promise.all([first, second]);
  assert.equal(one.items[0].id, 'shared');
  assert.equal(two.items[0].id, 'shared');
});

test('a fresh install has a complete generated catalog before the network responds', () => {
  const seed = loadMiniModule(seedPath);
  const api = freshApi({ getStorageSync: () => '' });
  const cached = api.readCachedProducts();
  assert.equal(seed.items.length, 200);
  assert.equal(cached.items.length, 200);
  assert.equal(cached.cache.source, 'bundle');
});

test('large catalog cache writes asynchronously and remains immediately readable from memory', async () => {
  let asyncWrite = null;
  const api = freshApi({
    getStorageSync: () => '',
    setStorageSync() {
      throw new Error('synchronous storage must not run when async storage is available');
    },
    setStorage(options) {
      asyncWrite = options;
    },
    request(options) {
      options.success({
        statusCode: 200,
        data: { items: [{ id: 'instant', taxonomy: { l1: 'food' } }], pagination: { nextCursor: null } },
      });
    },
  });
  await api.listProducts({ cursor: 0, limit: 200 });
  assert.ok(asyncWrite && asyncWrite.key.includes('public-catalog-window'));
  assert.equal(api.readCachedProducts().items[0].id, 'instant');
});

test('known public image sources bypass the failing image relay', async () => {
  const source = 'https://m.media-amazon.com/images/I/product.jpg';
  const api = freshApi({
    getStorageSync: () => '',
    request(options) {
      options.success({
        statusCode: 200,
        data: {
          items: [
            {
              id: 'image-product',
              coverUrl: 'https://hbbtzn.com/api/v1/catalog/public/products/image-product/image?source=' + encodeURIComponent(source),
              taxonomy: { l1: 'food' },
            },
          ],
          pagination: { nextCursor: null },
        },
      });
    },
  });
  const response = await api.listProducts({ cursor: 0, limit: 200 });
  assert.equal(response.items[0].coverUrl, source);
});

test('product lists render a small first batch and defer offscreen images', () => {
  const productPage = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/products/products.js'), 'utf8');
  const productView = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/products/products.wxml'), 'utf8');
  const categoryView = fs.readFileSync(path.join(root, 'apps/wechat-miniapp/miniprogram/pages/category/category.wxml'), 'utf8');
  assert.match(productPage, /RENDER_BATCH_SIZE = 12/);
  assert.match(productView, /lazy-load/);
  assert.match(categoryView, /lazy-load/);
});
