var payment = require('./wechatPayment');

function rejected(apiError, code, message) {
  return payment.rejectedRequest(apiError(code, message));
}

function validSkuId(value) {
  var id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 100 ? id : '';
}

function validCartItemId(value) {
  var id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 100 ? id : '';
}

function validItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 50) return null;
  var seen = {};
  var normalized = [];
  for (var index = 0; index < items.length; index += 1) {
    var skuId = validSkuId(items[index] && items[index].skuId);
    var quantity = Number(items[index] && items[index].quantity);
    if (!skuId || seen[skuId] || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
    seen[skuId] = true;
    normalized.push({ skuId: skuId, quantity: quantity });
  }
  return normalized;
}

function validRecipient(recipient) {
  var value = recipient || {};
  var required = ['name', 'mobile', 'province', 'city', 'district', 'address'];
  var result = {};
  for (var index = 0; index < required.length; index += 1) {
    var field = required[index];
    var text = typeof value[field] === 'string' ? value[field].trim() : '';
    if (!text || text.length > (field === 'address' ? 200 : 50)) return null;
    result[field] = text;
  }
  return /^1\d{10}$/.test(result.mobile) ? result : null;
}

function createCheckoutApi(options) {
  var authenticatedRequest = options.authenticatedRequest;
  var apiError = options.apiError;

  function getPaymentStatus(orderId) {
    var validOrderId = payment.normalizeOrderId(orderId);
    if (!validOrderId) return rejected(apiError, 'INVALID_ORDER_ID', '订单标识无效，请重新打开订单');
    return authenticatedRequest('GET', '/api/v1/orders/' + encodeURIComponent(validOrderId) + '/payment-status');
  }

  return {
    getCart: function () {
      return authenticatedRequest('GET', '/api/v1/cart');
    },
    updateCartItem: function (skuId, quantity, selected) {
      var id = validSkuId(skuId);
      var count = Number(quantity);
      if (!id || !Number.isInteger(count) || count < 1 || count > 99 || typeof selected !== 'boolean') {
        return rejected(apiError, 'INVALID_CART_INPUT', '购物车商品或数量无效');
      }
      return authenticatedRequest('PUT', '/api/v1/cart', { skuId: id, quantity: count, selected: selected });
    },
    deleteCartItem: function (itemId) {
      var id = validCartItemId(itemId);
      if (!id) return rejected(apiError, 'INVALID_CART_ITEM_ID', '购物车商品标识无效');
      return authenticatedRequest('DELETE', '/api/v1/cart/' + encodeURIComponent(id));
    },
    getAddresses: function () {
      return authenticatedRequest('GET', '/api/v1/addresses');
    },
    saveAddress: function (address) {
      return authenticatedRequest('PUT', '/api/v1/addresses', address);
    },
    createOrder: function (items, recipient, idempotencyKey) {
      var normalizedItems = validItems(items);
      var normalizedRecipient = validRecipient(recipient);
      if (!normalizedItems || !normalizedRecipient) return rejected(apiError, 'INVALID_ORDER_INPUT', '订单商品或收货信息不完整');
      if (!idempotencyKey || idempotencyKey.length > 120) return rejected(apiError, 'INVALID_IDEMPOTENCY_KEY', '订单提交标识无效，请重新结算');
      return authenticatedRequest('POST', '/api/v1/orders', { items: normalizedItems, recipient: normalizedRecipient }, { headers: { 'Idempotency-Key': idempotencyKey } });
    },
    getOrderByNumber: function (orderNo) {
      var validOrderNo = payment.normalizeOrderNo(orderNo);
      if (!validOrderNo) return rejected(apiError, 'INVALID_ORDER_NO', '订单编号无效，请从订单列表重新进入');
      return authenticatedRequest('GET', '/api/v1/orders/by-number/' + encodeURIComponent(validOrderNo));
    },
    createWechatPrepay: function (orderId, idempotencyKey) {
      var validOrderId = payment.normalizeOrderId(orderId);
      if (!validOrderId) return rejected(apiError, 'INVALID_ORDER_ID', '订单标识无效，请重新打开订单');
      if (!idempotencyKey || idempotencyKey.length > 120) return rejected(apiError, 'INVALID_IDEMPOTENCY_KEY', '支付请求标识无效，请重新发起支付');
      return authenticatedRequest('POST', '/api/v1/orders/' + encodeURIComponent(validOrderId) + '/payments/wechat/prepay', {}, { headers: { 'Idempotency-Key': idempotencyKey } });
    },
    getPaymentStatus: getPaymentStatus,
    normalizeOrderNo: payment.normalizeOrderNo,
    createIdempotencyKey: payment.createIdempotencyKey,
    requestWechatPayment: function (input) {
      return payment.requestWechatPayment(input, apiError);
    },
    pollPaymentStatus: function (orderId, settings) {
      return payment.pollPaymentStatus(orderId, settings, getPaymentStatus, apiError);
    },
  };
}

module.exports = { createCheckoutApi: createCheckoutApi };
