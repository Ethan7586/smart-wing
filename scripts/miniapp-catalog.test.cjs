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

test('qualified main-Shop products enrich both featured and taxonomy tiles', () => {
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

test('category page starts authentication instead of waiting for a pre-existing token', () => {
  const source = fs.readFileSync(categoryPagePath, 'utf8');
  assert.doesNotMatch(source, /api\.isWired\(\)/);
  assert.match(source, /api\.listAllProducts\(\)/);
  assert.match(source, /api\s*\.bindWechatMember\(/);
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
  assert.ok(calls.every(({ url }) => url.includes('/api/v1/products?')));
  assert.ok(calls.every(({ url }) => !url.includes('/api/v1/categories')));
  assert.equal(calls[0].header.authorization, 'Bearer test-access-token');
});

test('a fresh install creates a WeChat session before loading every catalog page', async () => {
  const storage = new Map();
  const calls = [];
  const api = freshApi({
    getStorageSync: (key) => storage.get(key) || '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    login: ({ success }) => success({ code: 'one-time-wechat-code' }),
    request(options) {
      calls.push(options);
      if (options.url.endsWith('/api/v1/auth/wechat/session')) {
        options.success({ statusCode: 200, data: { authenticated: true, accessToken: 'live-token', expiresIn: 300 } });
        return;
      }
      options.success({ statusCode: 200, data: { items: [{ id: 'one' }], pagination: { nextCursor: null }, requestId: 'catalog-live' } });
    },
  });
  assert.equal(api.isWired(), false);
  const response = await api.listAllProducts();
  assert.equal(response.items.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].data, { code: 'one-time-wechat-code' });
  assert.equal(calls[1].header.authorization, 'Bearer live-token');
});

test('an unbound WeChat identity returns a binding challenge without requesting products', async () => {
  const calls = [];
  const api = freshApi({
    getStorageSync: () => '',
    removeStorageSync() {},
    login: ({ success }) => success({ code: 'unbound-code' }),
    request(options) {
      calls.push(options);
      options.success({
        statusCode: 409,
        data: { error: { code: 'WECHAT_BINDING_REQUIRED', message: '首次使用需要绑定', bindingChallenge: 'challenge-id' } },
      });
    },
  });
  await assert.rejects(api.listAllProducts(), (error) => error.code === 'WECHAT_BINDING_REQUIRED' && error.bindingChallenge === 'challenge-id');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/api/v1/auth/wechat/session'));
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
