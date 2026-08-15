const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const catalogPath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/catalog.js');
const apiPath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/api.js');
const categoryPagePath = path.join(root, 'apps/wechat-miniapp/miniprogram/pages/category/category.js');
const policyPath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/catalogPolicy.js');

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
    ['精选', '家用电器', '数码办公', '家居日用', '个护清洁', '企业福利专区']
  );
  for (const item of snapshot.rail) {
    assert.ok(snapshot.tilesByKey[item.key].length > 0, `${item.label} must not render blank`);
  }
  assert.ok(snapshot.tilesByKey.featured.length > 0);
  assert.equal(snapshot.tilesByKey.food, undefined);
});

test('qualified public main-Shop products enrich their taxonomy tile', () => {
  const catalog = loadMiniModule(catalogPath);
  const snapshot = catalog.createSnapshot([
    {
      id: 'product-one',
      coverUrl: 'https://cdn.example.test/kettle.webp',
      taxonomy: { l1: 'appliance', l2: 'appliance_kitchen', l3: 'appliance_kitchen_cook' },
    },
  ]);
  const leaf = snapshot.tilesByKey.appliance.find(({ key }) => key === 'appliance_kitchen_cook');
  assert.equal(leaf.image, 'https://cdn.example.test/kettle.webp');
  assert.equal(leaf.productCount, 1);
});

test('food commerce is consistently hidden until qualification is approved', () => {
  const catalog = loadMiniModule(catalogPath);
  const policy = loadMiniModule(policyPath);
  const food = {
    id: 'food-product',
    name: '食品商品',
    taxonomy: { l1: 'food', l2: 'food_snack', l3: 'food_snack_nuts' },
  };
  const allowed = {
    id: 'digital-product',
    name: '办公设备',
    taxonomy: { l1: 'digital', l2: 'digital_office', l3: 'digital_office_equipment' },
  };
  const snapshot = catalog.createSnapshot([food, allowed]);
  assert.equal(policy.foodCommerceEnabled, false);
  assert.equal(snapshot.productCount, 1);
  assert.equal(snapshot.products[0].id, 'digital-product');
  assert.equal(snapshot.tilesByKey.food, undefined);
  assert.equal(
    snapshot.tilesByKey.featured.some(({ label }) => /食品|零食|粮油|乳品|酒水|保健/.test(label)),
    false
  );
  assert.equal(policy.isFeaturedTileVisible({ code: 'featured_baby', matchCodes: ['supermarket_family_toys'] }), true);
  assert.equal(
    catalog.createSnapshot([]).tilesByKey.featured.some(({ label }) => /母婴/.test(label)),
    true
  );
  assert.equal(policy.isHomeSegmentVisible({ key: 'grocery' }), false);
  assert.equal(policy.isHomeSegmentVisible({ key: 'dining' }), false);
  assert.equal(policy.isHomeSegmentVisible({ key: 'digital' }), true);
});

test('a category still shows real products when an older cache lacks leaf taxonomy', () => {
  const catalog = loadMiniModule(catalogPath);
  const snapshot = catalog.createSnapshot([
    {
      id: 'legacy-home-product',
      name: '真实家居商品',
      coverUrl: 'https://hbbtzn.com/api/v1/catalog/public/products/legacy-home-product/image',
      taxonomy: { l1: 'home', l2: 'home_furniture', l3: null },
    },
  ]);
  assert.equal(snapshot.tilesByKey.home.length, 1);
  assert.equal(snapshot.tilesByKey.home[0].productId, 'legacy-home-product');
  assert.equal(snapshot.tilesByKey.home[0].label, '真实家居商品');
  assert.equal(catalog.tileProductCount(snapshot.tilesByKey.home), 1);
});

test('unclassified welfare inventory remains reachable instead of disappearing from mobile browse', () => {
  const catalog = loadMiniModule(catalogPath);
  const snapshot = catalog.createSnapshot([
    {
      id: 'review-product',
      coverUrl: 'https://m.media-amazon.com/images/I/review.jpg',
      taxonomy: { l1: 'welfare', l2: 'welfare_review', l3: 'welfare_review_unclassified' },
    },
  ]);
  const review = snapshot.tilesByKey.welfare.find(({ key }) => key === 'welfare_review_unclassified');
  assert.equal(review.productCount, 1);
  assert.equal(review.image, 'https://m.media-amazon.com/images/I/review.jpg');
  assert.equal(catalog.preferredRailKey(snapshot, 'featured'), 'featured');
  assert.equal(catalog.tileProductCount(snapshot.tilesByKey.welfare), 1);
});

test('featured browse renders real public products before empty taxonomy slots', () => {
  const catalog = loadMiniModule(catalogPath);
  const products = Array.from({ length: 20 }, (_, index) => ({
    id: `public-${index}`,
    name: `公开商品 ${index}`,
    coverUrl: `https://cdn.example.test/${index}.jpg`,
    taxonomy: { l1: 'welfare', l2: 'welfare_review', l3: 'welfare_review_unclassified' },
  }));
  const snapshot = catalog.createSnapshot(products);
  assert.equal(snapshot.tilesByKey.featured.length, 12);
  assert.equal(snapshot.tilesByKey.featured[0].productId, 'public-0');
  assert.equal(snapshot.tilesByKey.featured[0].label, '公开商品 0');
  assert.equal(snapshot.productCount, 20);
  assert.equal(catalog.preferredRailKey(snapshot, 'featured'), 'featured');
});

test('a populated current rail stays selected after public catalog refresh', () => {
  const catalog = loadMiniModule(catalogPath);
  const snapshot = catalog.createSnapshot([
    {
      id: 'office-product',
      coverUrl: 'https://cdn.example.test/office.jpg',
      taxonomy: { l1: 'digital', l2: 'digital_office', l3: 'digital_office_equipment' },
    },
  ]);
  assert.equal(catalog.preferredRailKey(snapshot, 'featured'), 'featured');
});

test('invalid catalog envelopes fail visibly instead of becoming an empty success', () => {
  const catalog = loadMiniModule(catalogPath);
  assert.throws(() => catalog.itemsFromResponse({ products: [] }), /商品目录返回格式异常/);
});

test('category page loads the public catalog without a member binding gate', () => {
  const source = fs.readFileSync(categoryPagePath, 'utf8');
  assert.doesNotMatch(source, /api\.isWired\(\)/);
  assert.match(source, /api\.readCachedProducts\(\)/);
  assert.match(source, /api\.listProducts\(\{ cursor: 0, limit: 200 \}\)/);
  assert.doesNotMatch(source, /bindWechatMember|bindingRequired|WECHAT_BINDING_REQUIRED/);
});

test('catalog API fetches one 200-item window and persists at most 200 products', async () => {
  const calls = [];
  const storage = {};
  const items = Array.from({ length: 220 }, (_, index) => ({ id: `product-${index}`, taxonomy: { l1: index % 2 ? 'food' : 'welfare' } }));
  const api = freshApi({
    getStorageSync: (key) => storage[key] || '',
    setStorageSync: (key, value) => {
      storage[key] = value;
    },
    request(options) {
      calls.push(options);
      options.success({
        statusCode: 200,
        data: {
          items,
          pagination: { nextCursor: 200 },
          requestId: 'catalog-window',
        },
      });
    },
  });
  const response = await api.listProducts({ cursor: 0, limit: 999 });
  assert.equal(response.items.length, 200);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/api/v1/catalog/public/products?'));
  assert.ok(calls[0].url.includes('limit=200'));
  assert.ok(!calls[0].url.includes('/api/v1/categories'));
  assert.equal(calls[0].header.authorization, undefined);
  assert.equal(api.readCachedProducts().items.length, 200);
  assert.equal(api.readCachedProducts('food').items.length, 100);
});

test('expired critical cache remains immediately readable while the page revalidates', () => {
  const storage = {
    'sw-public-catalog-critical-v1:all': {
      version: 4,
      storedAt: 0,
      items: [{ id: 'cached', taxonomy: { l1: 'food' } }],
      complete: false,
      source: 'storage-critical',
    },
  };
  const api = freshApi({
    getStorageSync: (key) => storage[key] || '',
  });
  const cached = api.readCachedProducts('food');
  assert.equal(cached.items[0].id, 'cached');
  assert.equal(cached.cache.stale, true);
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
  const response = await api.listProducts({ cursor: 0, limit: 200 });
  assert.equal(response.items.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://img.hbbtzn.com/catalog/public/v1/latest.json');
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
  const response = await api.listProducts({ cursor: 0, limit: 200 });
  assert.equal(response.items[0].id, 'public-one');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://img.hbbtzn.com/catalog/public/v1/latest.json');
});

test('a CDN miss falls back to the public Commerce API', async () => {
  const calls = [];
  const api = freshApi({
    getStorageSync: () => '',
    request(options) {
      calls.push(options.url);
      if (calls.length === 1) options.fail({ errMsg: 'request:fail timeout' });
      else options.success({ statusCode: 200, data: { items: [{ id: 'origin' }], pagination: { nextCursor: null } } });
      return { abort() {} };
    },
  });
  const response = await api.listProducts({ cursor: 0, limit: 200 });
  assert.equal(response.items[0].id, 'origin');
  assert.equal(calls[0], 'https://img.hbbtzn.com/catalog/public/v1/latest.json');
  assert.match(calls[1], /https:\/\/hbbtzn\.com\/api\/v1\/catalog\/public\/products\?/);
});

test('a complete catalog uses ETag and reuses cached data on 304', async () => {
  const calls = [];
  const api = freshApi({
    getStorageSync: () => '',
    setStorage() {},
    request(options) {
      calls.push(options);
      if (calls.length === 1) {
        options.success({
          statusCode: 200,
          header: { ETag: '"catalog.version-one"' },
          data: { items: [{ id: 'etag-product' }], pagination: { nextCursor: null } },
        });
      } else options.success({ statusCode: 304, header: { ETag: '"catalog.version-one"' } });
      return { abort() {} };
    },
  });
  await api.listProducts({ cursor: 0, limit: 200 });
  const cached = await api.listProducts({ cursor: 0, limit: 200 });
  assert.equal(cached.items[0].id, 'etag-product');
  assert.equal(calls[1].header['if-none-match'], '"catalog.version-one"');
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
  const sync = api.listProducts({ cursor: 0, limit: 200 });
  await new Promise((resolve) => setImmediate(resolve));
  sync.abort();
  await assert.rejects(sync, ({ code }) => code === 'REQUEST_ABORTED');
  assert.equal(aborted, true);
});
