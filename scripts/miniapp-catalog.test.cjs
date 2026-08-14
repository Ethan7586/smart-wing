const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const catalogPath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/catalog.js');
const apiPath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/api.js');
const categoryPagePath = path.join(root, 'apps/wechat-miniapp/miniprogram/pages/category/category.js');

function loadMiniModule(file, globals = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(file, 'utf8');
  function localRequire(request) {
    if (!request.startsWith('.')) return require(request);
    const target = path.resolve(path.dirname(file), request.endsWith('.js') ? request : `${request}.js`);
    return loadMiniModule(target, globals);
  }
  const execute = new Function('require', 'module', 'exports', 'wx', source);
  execute(localRequire, module, module.exports, globals.wx);
  return module.exports;
}

function freshApi(wxMock) {
  return loadMiniModule(apiPath, { wx: wxMock });
}

test('shared taxonomy fills every approved category rail', () => {
  const catalog = loadMiniModule(catalogPath);
  const snapshot = catalog.createSnapshot([]);
  assert.deepEqual(
    snapshot.rail.map(({ label }) => label),
    ['精选', '食品饮料', '家用电器', '数码办公', '家居日用', '个护清洁']
  );
  for (const item of snapshot.rail) {
    assert.ok(snapshot.tilesByKey[item.key].length > 0, `${item.label} must not render blank`);
  }
  assert.equal(snapshot.tilesByKey.featured.length, 12);
});

test('public main-Shop products enrich both featured and taxonomy tiles', () => {
  const catalog = loadMiniModule(catalogPath);
  const snapshot = catalog.createSnapshot([
    {
      id: 'product-one',
      coverUrl: 'https://cdn.example.test/nuts.webp',
      taxonomy: { l1: 'food', l2: 'food_snack', l3: 'food_snack_nuts' },
    },
  ]);
  const featured = snapshot.tilesByKey.featured.find(({ key }) => key === 'featured_snack');
  const leaf = snapshot.tilesByKey.food.find(({ key }) => key === 'food_snack_nuts');
  assert.equal(featured.image, 'https://cdn.example.test/nuts.webp');
  assert.equal(featured.productCount, 1);
  assert.equal(leaf.image, featured.image);
});

test('invalid catalog envelopes fail visibly instead of becoming an empty success', () => {
  const catalog = loadMiniModule(catalogPath);
  assert.throws(() => catalog.itemsFromResponse({ products: [] }), /商品目录返回格式异常/);
});

test('category page loads the public catalog without a member binding gate', () => {
  const source = fs.readFileSync(categoryPagePath, 'utf8');
  assert.doesNotMatch(source, /api\.isWired\(\)/);
  assert.match(source, /api\.listAllProducts\(\)/);
  assert.doesNotMatch(source, /bindWechatMember|bindingRequired|WECHAT_BINDING_REQUIRED/);
});

test('catalog API paginates asynchronously and never calls the nonexistent categories route', async () => {
  const calls = [];
  const api = freshApi({
    getStorageSync: (key) => (key.includes('expires_at') ? Date.now() + 600_000 : 'test-access-token'),
    request(options) {
      calls.push(options);
      const first = calls.length === 1;
      options.success({
        statusCode: 200,
        data: {
          items: [{ id: first ? 'one' : 'two', taxonomy: { l1: 'food' } }],
          pagination: { nextCursor: first ? 100 : null },
          requestId: first ? 'request-one' : 'request-two',
        },
      });
    },
  });
  const response = await api.listAllProducts();
  assert.deepEqual(
    response.items.map(({ id }) => id),
    ['one', 'two']
  );
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url }) => url.includes('/api/v1/catalog/public/products?')));
  assert.ok(calls.every(({ url }) => !url.includes('/api/v1/categories')));
  assert.equal(calls[0].header.authorization, undefined);
});

test('a fresh install loads products without creating a WeChat session', async () => {
  const calls = [];
  const api = freshApi({
    getStorageSync: () => '',
    request(options) {
      calls.push(options);
      options.success({ statusCode: 200, data: { items: [{ id: 'one' }], pagination: { nextCursor: null }, requestId: 'catalog-live' } });
    },
  });
  assert.equal(api.isWired(), false);
  const response = await api.listAllProducts();
  assert.equal(response.items.length, 1);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/api/v1/catalog/public/products?'));
  assert.equal(calls[0].header.authorization, undefined);
});

test('an unbound WeChat identity is irrelevant to public product browsing', async () => {
  const calls = [];
  const api = freshApi({
    getStorageSync: () => '',
    request(options) {
      calls.push(options);
      options.success({ statusCode: 200, data: { items: [{ id: 'public-one' }], pagination: { nextCursor: null }, requestId: 'public-catalog' } });
    },
  });
  const response = await api.listAllProducts();
  assert.equal(response.items[0].id, 'public-one');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/api/v1/catalog/public/products?'));
});

test('an in-flight catalog sync can be aborted on reload or page unload', async () => {
  let aborted = false;
  const api = freshApi({
    getStorageSync: (key) => (key.includes('expires_at') ? Date.now() + 600_000 : 'test-access-token'),
    request(options) {
      return {
        abort() {
          aborted = true;
          options.fail({ errMsg: 'request:fail abort' });
        },
      };
    },
  });
  const sync = api.listAllProducts();
  await new Promise((resolve) => setImmediate(resolve));
  sync.abort();
  await assert.rejects(sync, ({ code }) => code === 'REQUEST_ABORTED');
  assert.equal(aborted, true);
});
