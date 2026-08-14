const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const apiPath = path.join(root, 'apps/wechat-miniapp/miniprogram/utils/api.js');
const seedPath = path.join(root, 'apps/wechat-miniapp/miniprogram/data/catalog-seed.generated.js');
const criticalSeedPath = path.join(root, 'apps/wechat-miniapp/miniprogram/data/catalog-seed-critical.generated.js');
const appPath = path.join(root, 'apps/wechat-miniapp/miniprogram/app.js');

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

test('a fresh install paints a small critical catalog, then hydrates the complete window', async () => {
  const seed = loadMiniModule(seedPath);
  const criticalSeed = loadMiniModule(criticalSeedPath);
  const api = freshApi({ getStorageSync: () => '' });
  const cached = api.readCachedProducts();
  assert.equal(seed.items.length, 200);
  assert.equal(criticalSeed.items.length, 24);
  assert.deepEqual([...new Set(criticalSeed.items.map((item) => item.taxonomy.l1))].sort(), ['appliance', 'digital', 'food', 'home', 'personal', 'welfare']);
  assert.equal(cached.items.length, 24);
  assert.equal(cached.cache.source, 'bundle-critical');
  assert.equal(cached.cache.complete, false);
  const hydrated = await api.hydrateBundledCatalog();
  assert.equal(hydrated.items.length, 200);
  assert.equal(hydrated.cache.complete, true);
});

test('large catalog cache writes asynchronously and remains immediately readable from memory', async () => {
  const asyncWrites = [];
  const api = freshApi({
    getStorageSync: () => '',
    setStorageSync() {
      throw new Error('synchronous storage must not run when async storage is available');
    },
    setStorage(options) {
      asyncWrites.push(options);
    },
    request(options) {
      options.success({
        statusCode: 200,
        data: { items: [{ id: 'instant', taxonomy: { l1: 'food' } }], pagination: { nextCursor: null } },
      });
    },
  });
  await api.listProducts({ cursor: 0, limit: 200 });
  assert.ok(asyncWrites.some((write) => write.key.includes('public-catalog-window')));
  assert.equal(api.readCachedProducts().items[0].id, 'instant');
});

test('cold-path package budgets keep synchronous catalog work small', () => {
  const criticalBytes = fs.statSync(criticalSeedPath).size;
  const completeBytes = fs.statSync(seedPath).size;
  const miniRoot = path.join(root, 'apps/wechat-miniapp/miniprogram');
  const files = fs.readdirSync(miniRoot, { recursive: true, withFileTypes: true });
  const totalBytes = files.filter((entry) => entry.isFile()).reduce((total, entry) => total + fs.statSync(path.join(entry.parentPath, entry.name)).size, 0);
  assert.ok(criticalBytes < 20_000, `critical catalog is ${criticalBytes} bytes`);
  assert.ok(completeBytes < 150_000, `complete catalog is ${completeBytes} bytes`);
  assert.ok(totalBytes < 500_000, `main package is ${totalBytes} bytes`);
});

test('the mini-program preserves the server-selected shared media URL', async () => {
  const source = 'https://img.hbbtzn.com/catalog/products/image-product/cover-test.webp';
  const api = freshApi({
    getStorageSync: () => '',
    request(options) {
      options.success({
        statusCode: 200,
        data: {
          items: [
            {
              id: 'image-product',
              coverUrl: source,
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

test('app launch does not start catalog, login, home, or order requests', () => {
  const source = fs.readFileSync(appPath, 'utf8');
  const launchBlock = source.match(/onLaunch:\s*function\s*\(\)\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(launchBlock, 'app.js must expose a readable onLaunch block');
  assert.doesNotMatch(source, /require\(['"]\.\/utils\/api['"]\)/);
  assert.doesNotMatch(launchBlock[1], /prefetch|wx\.request|wx\.login|setTimeout/);
});
