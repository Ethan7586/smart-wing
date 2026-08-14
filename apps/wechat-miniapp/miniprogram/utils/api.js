/** Native mini-program session and Commerce API transport. */

var BASE_URL = 'https://hbbtzn.com';
var ACCESS_TOKEN_KEY = 'sw_member_access_token';
var ACCESS_TOKEN_EXPIRY_KEY = 'sw_member_access_token_expires_at';
var REQUEST_TIMEOUT_MS = 10000;
var TOKEN_REFRESH_LEEWAY_MS = 30000;
var activeSessionRequest = null;
var wechatPayment = require('./wechatPayment');
var catalogApi = require('./catalogApi').createCatalogApi(performRequest, apiError, wx);

function accessToken() {
  try {
    var value = wx.getStorageSync(ACCESS_TOKEN_KEY);
    return typeof value === 'string' ? value.trim() : '';
  } catch (_error) {
    return '';
  }
}

function accessTokenExpiry() {
  try {
    var value = Number(wx.getStorageSync(ACCESS_TOKEN_EXPIRY_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch (_error) {
    return 0;
  }
}

function hasFreshAccessToken() {
  return Boolean(accessToken() && accessTokenExpiry() > Date.now() + TOKEN_REFRESH_LEEWAY_MS);
}

function clearAccessToken() {
  try {
    wx.removeStorageSync(ACCESS_TOKEN_KEY);
    wx.removeStorageSync(ACCESS_TOKEN_EXPIRY_KEY);
  } catch (_error) {
    // A failed local cleanup must not turn an API error into a false success.
  }
}

function expiryFromSession(response) {
  if (response && response.expiresAt) {
    var parsed = typeof response.expiresAt === 'number' ? response.expiresAt : Date.parse(response.expiresAt);
    if (Number.isFinite(parsed)) return parsed < 1000000000000 ? parsed * 1000 : parsed;
  }
  var seconds = Number(response && response.expiresIn);
  return Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 300000);
}

function storeSession(response) {
  var token = response && typeof response.accessToken === 'string' ? response.accessToken.trim() : '';
  if (!token || response.authenticated !== true) {
    throw apiError('INVALID_WECHAT_SESSION', '微信会话返回格式异常，请稍后重试');
  }
  wx.setStorageSync(ACCESS_TOKEN_KEY, token);
  wx.setStorageSync(ACCESS_TOKEN_EXPIRY_KEY, expiryFromSession(response));
  return response;
}

function apiError(code, message, extra) {
  var error = { code: code, message: message };
  if (extra) {
    Object.keys(extra).forEach(function (key) {
      error[key] = extra[key];
    });
  }
  return error;
}

function notWired(name) {
  return Promise.reject(
    apiError('AUTH_CHANNEL_PENDING', '会员登录令牌尚未建立，请重新进入当前页面', {
      endpoint: name,
    })
  );
}

function responseError(response, path) {
  var envelope = response && response.data && response.data.error;
  var statusCode = response && response.statusCode;
  var extras = {};
  ['requestId', 'bindingChallenge', 'expiresIn', 'retryAfterSeconds'].forEach(function (key) {
    if (envelope && envelope[key] !== undefined) extras[key] = envelope[key];
  });
  if (statusCode === 401) {
    clearAccessToken();
    return apiError((envelope && envelope.code) || 'AUTH_REQUIRED', (envelope && envelope.message) || '会员登录已失效，请重新登录', extras);
  }
  if (statusCode === 403) {
    var fallbackCode = path.indexOf('/api/v1/products') === 0 ? 'CATALOG_FORBIDDEN' : 'FORBIDDEN';
    return apiError((envelope && envelope.code) || fallbackCode, (envelope && envelope.message) || '当前会员没有执行该操作的资格', extras);
  }
  return apiError((envelope && envelope.code) || 'HTTP_' + statusCode, (envelope && envelope.message) || '服务请求失败（' + statusCode + '）', extras);
}

function networkError(error) {
  var message = (error && error.errMsg) || '';
  if (/abort/i.test(message)) return apiError('REQUEST_ABORTED', '请求已取消');
  if (/timeout/i.test(message)) return apiError('REQUEST_TIMEOUT', '请求超时，请稍后重试');
  return apiError('NETWORK_ERROR', '网络连接失败，请检查网络后重试');
}

function performRequest(method, path, data, options) {
  var settings = options || {};
  var token = settings.auth === false ? '' : accessToken();
  if (!BASE_URL || (settings.auth !== false && !token)) return notWired(path);
  var task = null;
  var promise = new Promise(function (resolve, reject) {
    var headers = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (token) headers.authorization = 'Bearer ' + token;
    Object.keys(settings.headers || {}).forEach(function (key) {
      headers[key] = settings.headers[key];
    });
    task = wx.request({
      url: BASE_URL + path,
      method: method,
      data: data,
      timeout: settings.timeout || REQUEST_TIMEOUT_MS,
      header: headers,
      success: function (response) {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
        else reject(responseError(response, path));
      },
      fail: function (error) {
        reject(networkError(error));
      },
    });
  });
  promise.abort = function () {
    if (task && typeof task.abort === 'function') task.abort();
  };
  return promise;
}
function wxLoginCode() {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      reject(apiError('REQUEST_TIMEOUT', '微信登录超时，请稍后重试'));
    }, REQUEST_TIMEOUT_MS);
    wx.login({
      success: function (result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (result && typeof result.code === 'string' && result.code.trim()) resolve(result.code.trim());
        else reject(apiError('WECHAT_LOGIN_FAILED', '微信未返回登录凭证，请重新进入小程序'));
      },
      fail: function (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(apiError('WECHAT_LOGIN_FAILED', (error && error.errMsg) || '微信登录失败，请稍后重试'));
      },
    });
  });
}
function createWechatSession() {
  return wxLoginCode()
    .then(function (code) {
      return performRequest('POST', '/api/v1/auth/wechat/session', { code: code }, { auth: false });
    })
    .then(storeSession);
}

function ensureWechatSession(options) {
  var settings = options || {};
  if (settings.force) clearAccessToken();
  if (!settings.force && hasFreshAccessToken()) {
    return Promise.resolve({ authenticated: true, cached: true });
  }
  if (activeSessionRequest) return activeSessionRequest;
  var request = createWechatSession();
  activeSessionRequest = request.then(
    function (response) {
      activeSessionRequest = null;
      return response;
    },
    function (error) {
      activeSessionRequest = null;
      throw error;
    }
  );
  return activeSessionRequest;
}

function authenticatedRequest(method, path, data, options) {
  var cancelled = false;
  var activeRequest = null;
  var retried = false;

  function run(forceSession) {
    return ensureWechatSession({ force: forceSession }).then(function () {
      if (cancelled) throw apiError('REQUEST_ABORTED', '请求已取消');
      activeRequest = performRequest(method, path, data, options);
      return activeRequest.catch(function (error) {
        if (!retried && error && error.code === 'AUTH_REQUIRED') {
          retried = true;
          return run(true);
        }
        throw error;
      });
    });
  }

  var promise = run(false);
  promise.abort = function () {
    cancelled = true;
    if (activeRequest && typeof activeRequest.abort === 'function') activeRequest.abort();
  };
  return promise;
}

var memberApi = require('./memberApi').createMemberApi({
  storage: wx,
  catalogApi: catalogApi,
  performRequest: performRequest,
  authenticatedRequest: authenticatedRequest,
  apiError: apiError,
  storeSession: storeSession,
});

module.exports = Object.assign(
  {
    isWired: function () {
      return Boolean(BASE_URL && hasFreshAccessToken());
    },
    connectionState: function () {
      return BASE_URL && hasFreshAccessToken() ? { ready: true } : { ready: false, code: 'WECHAT_SESSION_REQUIRED' };
    },
    clearAccessToken: clearAccessToken,
    ensureWechatSession: ensureWechatSession,
    createWechatSession: function () {
      return ensureWechatSession({ force: true });
    },
    listProducts: catalogApi.listProducts,
    readCachedProducts: catalogApi.readCachedProducts,
    catalogCacheLimit: catalogApi.cacheLimit,
    getCart: function () {
      return performRequest('GET', '/api/v1/cart');
    },
    getOrderByNumber: function (orderNo) {
      var validOrderNo = wechatPayment.normalizeOrderNo(orderNo);
      if (!validOrderNo) return wechatPayment.rejectedRequest(apiError('INVALID_ORDER_NO', '订单编号无效，请从订单列表重新进入'));
      return authenticatedRequest('GET', '/api/v1/orders/by-number/' + encodeURIComponent(validOrderNo));
    },
    createWechatPrepay: function (orderId, idempotencyKey) {
      var validOrderId = wechatPayment.normalizeOrderId(orderId);
      if (!validOrderId) return wechatPayment.rejectedRequest(apiError('INVALID_ORDER_ID', '订单标识无效，请重新打开订单'));
      if (!idempotencyKey || idempotencyKey.length > 120) {
        return wechatPayment.rejectedRequest(apiError('INVALID_IDEMPOTENCY_KEY', '支付请求标识无效，请重新发起支付'));
      }
      return authenticatedRequest(
        'POST',
        '/api/v1/orders/' + encodeURIComponent(validOrderId) + '/payments/wechat/prepay',
        {},
        {
          headers: { 'Idempotency-Key': idempotencyKey },
        }
      );
    },
    getPaymentStatus: function (orderId) {
      var validOrderId = wechatPayment.normalizeOrderId(orderId);
      if (!validOrderId) return wechatPayment.rejectedRequest(apiError('INVALID_ORDER_ID', '订单标识无效，请重新打开订单'));
      return authenticatedRequest('GET', '/api/v1/orders/' + encodeURIComponent(validOrderId) + '/payment-status');
    },
    normalizeOrderNo: wechatPayment.normalizeOrderNo,
    createIdempotencyKey: wechatPayment.createIdempotencyKey,
    requestWechatPayment: function (payment) {
      return wechatPayment.requestWechatPayment(payment, apiError);
    },
    pollPaymentStatus: function (orderId, options) {
      return wechatPayment.pollPaymentStatus(orderId, options, module.exports.getPaymentStatus, apiError);
    },
    createMemberCodeChallenge: function () {
      return notWired('/api/v1/member-code/challenge (未实现)');
    },
  },
  memberApi
);
