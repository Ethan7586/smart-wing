const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../apps/wechat-miniapp/miniprogram/utils/orderPresentation.js'), 'utf8');
const miniModule = { exports: {} };
new Function('module', 'exports', source)(miniModule, miniModule.exports);
const presentation = miniModule.exports;

test('order detail consumes the canonical payment response', () => {
  const order = presentation.decorateOrder({
    id: 'order-one',
    orderNo: 'SW202608140001',
    status: 'pending_payment',
    paymentStatus: 'pending',
    payableCents: 8800,
    createdAt: '2026-08-14T00:00:00.000Z',
    items: [{ id: 'item-one', name: '福利商品', quantity: 2, unitPriceCents: 4400, lineAmountCents: 8800 }],
  });
  assert.equal(order.orderNo, 'SW202608140001');
  assert.equal(order.total, '88.00');
  assert.equal(order.items[0].total, '88.00');
  assert.equal(order.canPay, true);
});

test('paid payment evidence prevents the client from offering payment again', () => {
  const order = presentation.decorateOrder({
    id: 'order-two',
    orderNo: 'SW202608140002',
    status: 'pending_payment',
    paymentStatus: 'paid',
    payableCents: 1,
  });
  assert.equal(order.statusLabel, '支付已确认');
  assert.equal(order.canPay, false);
});
