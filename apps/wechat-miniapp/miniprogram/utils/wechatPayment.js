function normalizeOrderNo(value) {
  var orderNo = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/.test(orderNo) ? orderNo : '';
}

function normalizeOrderId(value) {
  var orderId = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_\-]{6,80}$/.test(orderId) ? orderId : '';
}

function rejectedRequest(error) {
  var promise = Promise.reject(error);
  promise.abort = function () {};
  return promise;
}

function createIdempotencyKey(orderId) {
  var safeOrderId = normalizeOrderId(orderId) || 'order';
  return ['miniapp', safeOrderId.slice(0, 36), Date.now().toString(36), Math.random().toString(36).slice(2, 12)].join('-').slice(0, 120);
}

function requestWechatPayment(payment, apiError) {
  var input = payment || {};
  if (typeof input.timeStamp !== 'string' || typeof input.nonceStr !== 'string' || typeof input.package !== 'string' || input.package.indexOf('prepay_id=') !== 0 || input.signType !== 'RSA' || typeof input.paySign !== 'string') {
    return Promise.reject(apiError('INVALID_PREPAY_RESPONSE', '微信支付参数不完整，系统已阻止调用支付'));
  }
  return new Promise(function (resolve, reject) {
    wx.requestPayment({
      timeStamp: input.timeStamp,
      nonceStr: input.nonceStr,
      package: input.package,
      signType: input.signType,
      paySign: input.paySign,
      success: function () {
        resolve({ clientAccepted: true });
      },
      fail: function (error) {
        var message = (error && error.errMsg) || '';
        if (/cancel/i.test(message)) reject(apiError('PAYMENT_CANCELLED', '你已取消微信支付'));
        else reject(apiError('REQUEST_PAYMENT_FAILED', '微信支付未完成，请稍后重试'));
      },
    });
  });
}

function pollPaymentStatus(orderId, options, getPaymentStatus, apiError) {
  var settings = options || {};
  var maxAttempts = settings.maxAttempts || 12;
  var intervalMs = settings.intervalMs || 1500;
  var attempts = 0;
  var timer = null;
  var activeRequest = null;
  var cancelled = false;
  var lastStatus = null;
  var lastError = null;
  var terminalStatuses = { paid: true, closed: true, failed: true, refunded: true };
  var resolvePromise;
  var rejectPromise;

  function finishError() {
    rejectPromise(
      apiError('PAYMENT_CONFIRMATION_TIMEOUT', '支付结果仍在确认，请稍后刷新订单状态', {
        lastStatus: lastStatus,
        lastError: lastError,
      })
    );
  }

  function tick() {
    if (cancelled) return rejectPromise(apiError('REQUEST_ABORTED', '支付状态查询已取消'));
    attempts += 1;
    activeRequest = getPaymentStatus(orderId);
    activeRequest.then(
      function (response) {
        lastError = null;
        lastStatus = response && response.status;
        if (terminalStatuses[lastStatus]) return resolvePromise(response);
        if (attempts >= maxAttempts) return finishError();
        timer = setTimeout(tick, intervalMs);
      },
      function (error) {
        lastError = error;
        if (error && ['WECHAT_BINDING_REQUIRED', 'FORBIDDEN', 'PHONE_VERIFICATION_REQUIRED'].indexOf(error.code) >= 0) return rejectPromise(error);
        if (attempts >= maxAttempts) return finishError();
        timer = setTimeout(tick, intervalMs);
      }
    );
  }

  var promise = new Promise(function (resolve, reject) {
    resolvePromise = resolve;
    rejectPromise = reject;
    tick();
  });
  promise.abort = function () {
    cancelled = true;
    if (timer) clearTimeout(timer);
    if (activeRequest && typeof activeRequest.abort === 'function') activeRequest.abort();
  };
  return promise;
}

module.exports = {
  normalizeOrderNo: normalizeOrderNo,
  normalizeOrderId: normalizeOrderId,
  rejectedRequest: rejectedRequest,
  createIdempotencyKey: createIdempotencyKey,
  requestWechatPayment: requestWechatPayment,
  pollPaymentStatus: pollPaymentStatus,
};
