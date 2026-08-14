const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../apps/wechat-miniapp/miniprogram/utils/wechatPayment.js'), 'utf8');

function loadPayment(wxRuntime) {
  const miniModule = { exports: {} };
  new Function('module', 'exports', 'wx', source)(miniModule, miniModule.exports, wxRuntime);
  return miniModule.exports;
}

const payment = loadPayment(undefined);

function apiError(code, message, extra) {
  return Object.assign({ code, message }, extra || {});
}

test('mini-program payment helpers validate order identifiers', () => {
  assert.equal(payment.normalizeOrderNo('SW202608140001'), 'SW202608140001');
  assert.equal(payment.normalizeOrderNo('SW_ORDER-20260814'), 'SW_ORDER-20260814');
  assert.equal(payment.normalizeOrderNo('SW|unsafe'), '');
  assert.equal(payment.normalizeOrderNo('../bad'), '');
  assert.match(payment.createIdempotencyKey('order-one'), /^miniapp-order-one-/);
});

test('mini-program payment polling trusts only the server terminal state', async () => {
  let calls = 0;
  const result = await payment.pollPaymentStatus('order-one', { maxAttempts: 3, intervalMs: 1 }, () => Promise.resolve({ status: ++calls === 1 ? 'pending' : 'paid' }), apiError);
  assert.equal(result.status, 'paid');
  assert.equal(calls, 2);
});

test('mini-program rejects incomplete provider parameters before calling wx.requestPayment', async () => {
  global.wx = { requestPayment: () => assert.fail('wx.requestPayment must not run') };
  await assert.rejects(payment.requestWechatPayment({ signType: 'RSA' }, apiError), (error) => error.code === 'INVALID_PREPAY_RESPONSE');
  delete global.wx;
});

test('mini-program passes the server prepay response directly to wx.requestPayment', async () => {
  let received;
  const paymentWithWx = loadPayment({
    requestPayment: (input) => {
      received = input;
      input.success();
    },
  });
  const serverResponse = {
    timeStamp: '1786665600',
    nonceStr: 'merchantNonce123',
    package: 'prepay_id=wxPrepay1234567890',
    signType: 'RSA',
    paySign: 'signed-by-server',
  };
  await paymentWithWx.requestWechatPayment(serverResponse, apiError);
  assert.equal(received.package, serverResponse.package);
  assert.equal(received.paySign, serverResponse.paySign);
});
