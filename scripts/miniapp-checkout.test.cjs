const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const miniRoot = path.join(root, 'apps/wechat-miniapp/miniprogram');

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

function item(overrides = {}) {
  return {
    id: 'cart-item-one',
    skuId: 'sku-one',
    productId: 'product-one',
    quantity: 2,
    selected: true,
    purchasable: true,
    isTest: false,
    name: '真实商品',
    priceCents: 1250,
    availableStock: 8,
    supplierId: 'supplier-one',
    supplierName: '真实供应商',
    ...overrides,
  };
}

test('cart presentation uses only eligible real rows in the payable total', () => {
  const checkoutState = loadMiniModule(path.join(miniRoot, 'utils/checkoutState.js'), { wx: {} });
  const cart = checkoutState.presentCart([item(), item({ id: 'test-row', skuId: 'sku-test', isTest: true, priceCents: 9999 }), item({ id: 'stock-row', skuId: 'sku-stock', quantity: 3, availableStock: 1 })]);
  assert.equal(cart.selectedCount, 1);
  assert.equal(cart.totalText, '25.00');
  assert.equal(cart.allSelected, true);
  assert.equal(cart.groups[0].name, '真实供应商');
  assert.equal(cart.rows[1].selected, false);
  assert.equal(cart.rows[1].disabledCopy, '测试商品不可购买');
});

test('cart and checkout omit food rows while Mini Program qualification is unavailable', () => {
  const checkoutState = loadMiniModule(path.join(miniRoot, 'utils/checkoutState.js'), { wx: {} });
  const cart = checkoutState.presentCart([
    item({ id: 'food-row', skuId: 'food-sku', categoryCode: 'food', taxonomy: { l1: 'food', l2: 'food_snack', l3: 'food_snack_nuts' } }),
    item({ id: 'digital-row', skuId: 'digital-sku', categoryCode: 'digital', taxonomy: { l1: 'digital', l2: 'digital_office', l3: 'digital_office_equipment' } }),
  ]);
  assert.deepEqual(
    cart.rows.map((row) => row.skuId),
    ['digital-sku']
  );
  assert.equal(cart.selectedCount, 1);
  assert.equal(cart.totalText, '25.00');
});

test('checkout draft contains only selected eligible rows and expires honestly', () => {
  const values = { sw_member_session_scope: 'membership-one' };
  const checkoutState = loadMiniModule(path.join(miniRoot, 'utils/checkoutState.js'), {
    wx: {
      getStorageSync: (key) => values[key],
      setStorageSync: (key, value) => {
        values[key] = value;
      },
      removeStorageSync: (key) => delete values[key],
    },
  });
  assert.equal(checkoutState.writeDraft([item(), item({ id: 'off', skuId: 'off', selected: false })]), true);
  assert.deepEqual(
    checkoutState.readDraft().items.map((row) => row.skuId),
    ['sku-one']
  );
  const draftKey = Object.keys(values).find((key) => key.includes('checkout-draft'));
  values[draftKey].storedAt = Date.now() - 11 * 60 * 1000;
  assert.equal(checkoutState.readDraft(), null);
});

test('cart cache is isolated by the authenticated membership', () => {
  const values = { sw_member_session_scope: 'membership-one' };
  const checkoutState = loadMiniModule(path.join(miniRoot, 'utils/checkoutState.js'), {
    wx: {
      getStorageSync: (key) => values[key],
      setStorageSync: (key, value) => {
        values[key] = value;
      },
      removeStorageSync: (key) => delete values[key],
    },
  });
  checkoutState.writeCart([item()]);
  assert.equal(checkoutState.readCart().items.length, 1);
  values.sw_member_session_scope = 'membership-two';
  assert.equal(checkoutState.readCart(), null);
});

test('checkout API sends scoped endpoints and idempotency headers', async () => {
  const calls = [];
  const apiError = (code, message) => ({ code, message });
  const checkoutApi = loadMiniModule(path.join(miniRoot, 'utils/checkoutApi.js'), { wx: {} }).createCheckoutApi({
    apiError,
    authenticatedRequest(method, url, data, options) {
      calls.push({ method, url, data, options });
      return Promise.resolve({ ok: true });
    },
  });
  await checkoutApi.updateCartItem('sku-one', 2, true);
  await checkoutApi.createOrder([{ skuId: 'sku-one', quantity: 2 }], { name: '张三', mobile: '13800000000', province: '湖北省', city: '武汉市', district: '武昌区', address: '真实地址 1 号' }, 'checkout-order-one');
  assert.deepEqual(calls[0], { method: 'PUT', url: '/api/v1/cart', data: { skuId: 'sku-one', quantity: 2, selected: true }, options: undefined });
  assert.equal(calls[1].url, '/api/v1/orders');
  assert.equal(calls[1].options.headers['Idempotency-Key'], 'checkout-order-one');
  await assert.rejects(checkoutApi.createOrder([], {}, 'bad'), (error) => error.code === 'INVALID_ORDER_INPUT');
});

test('payment UI never treats the client callback as payment truth', () => {
  const orderDetail = fs.readFileSync(path.join(miniRoot, 'pages/order-detail/order-detail.js'), 'utf8');
  const payment = fs.readFileSync(path.join(miniRoot, 'utils/wechatPayment.js'), 'utf8');
  assert.match(orderDetail, /pollPaymentStatus/);
  assert.match(orderDetail, /response\s*&&\s*response\.status\s*===\s*'paid'/);
  assert.doesNotMatch(payment, /success:[\s\S]{0,160}(setData|paymentStatus\s*=\s*['"]paid)/);
});
