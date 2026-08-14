/**
 * Commerce API service layer for the native mini program.
 *
 * The HTTPS service is shared with the main Shop; database access never occurs
 * in the client. Requests become live only after the server issues a mini-app
 * bearer token. Until that channel exists, pages may use public/static
 * contracts but must label member-specific values as unavailable.
 */

var BASE_URL = 'https://hbbtzn.com';
var ACCESS_TOKEN_KEY = 'sw_member_access_token';
var REQUEST_TIMEOUT_MS = 10000;

function accessToken() {
  try {
    var value = wx.getStorageSync(ACCESS_TOKEN_KEY);
    return typeof value === 'string' ? value.trim() : '';
  } catch (_error) {
    return '';
  }
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
    apiError('AUTH_CHANNEL_PENDING', '商品目录已就绪，会员登录令牌通道尚未接通', {
      endpoint: name,
    })
  );
}

function responseError(response) {
  var envelope = response && response.data && response.data.error;
  if (response.statusCode === 401) return apiError('AUTH_REQUIRED', '会员登录已失效，请重新登录');
  if (response.statusCode === 403) return apiError('CATALOG_FORBIDDEN', '当前会员没有查看该商品目录的资格');
  return apiError((envelope && envelope.code) || 'HTTP_' + response.statusCode, (envelope && envelope.message) || '服务请求失败（' + response.statusCode + '）', envelope && envelope.requestId ? { requestId: envelope.requestId } : null);
}

function networkError(error) {
  var message = (error && error.errMsg) || '';
  if (/abort/i.test(message)) return apiError('REQUEST_ABORTED', '请求已取消');
  if (/timeout/i.test(message)) return apiError('REQUEST_TIMEOUT', '商品同步超时，请稍后重试');
  return apiError('NETWORK_ERROR', '网络连接失败，已保留本地分类结构');
}

function request(method, path, data) {
  var token = accessToken();
  if (!BASE_URL || !token) return notWired(path);
  var task = null;
  var promise = new Promise(function (resolve, reject) {
    task = wx.request({
      url: BASE_URL + path,
      method: method,
      data: data,
      timeout: REQUEST_TIMEOUT_MS,
      header: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer ' + token,
      },
      success: function (response) {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
        else reject(responseError(response));
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

function productPath(options) {
  var input = options || {};
  var parts = ['mall=smart-wing-demo'];
  if (input.category) parts.push('category=' + encodeURIComponent(input.category));
  if (typeof input.cursor === 'number') parts.push('cursor=' + input.cursor);
  parts.push('limit=' + (input.limit || 100));
  return '/api/v1/products?' + parts.join('&');
}

function listProducts(options) {
  return request('GET', productPath(options));
}

function listAllProducts() {
  var items = [];
  var pageCount = 0;
  var activeRequest = null;
  var cancelled = false;

  function next(cursor) {
    pageCount += 1;
    if (cancelled) return Promise.reject(apiError('REQUEST_ABORTED', '请求已取消'));
    if (pageCount > 60) return Promise.reject(apiError('CATALOG_PAGE_LIMIT', '商品目录分页超过安全上限'));
    activeRequest = listProducts({ cursor: cursor, limit: 100 });
    return activeRequest.then(function (response) {
      if (!response || !Array.isArray(response.items) || !response.pagination) {
        return Promise.reject(apiError('INVALID_CATALOG_RESPONSE', '商品目录返回格式异常'));
      }
      items = items.concat(response.items);
      return response.pagination.nextCursor === null ? { items: items, requestId: response.requestId } : next(response.pagination.nextCursor);
    });
  }

  var promise = next(0);
  promise.abort = function () {
    cancelled = true;
    if (activeRequest && typeof activeRequest.abort === 'function') activeRequest.abort();
  };
  return promise;
}

module.exports = {
  isWired: function () {
    return Boolean(BASE_URL && accessToken());
  },
  connectionState: function () {
    return BASE_URL && accessToken() ? { ready: true } : { ready: false, code: 'AUTH_CHANNEL_PENDING' };
  },
  getHomeSnapshot: function () {
    return request('GET', '/api/v1/home');
  },
  getBootstrap: function () {
    return request('GET', '/api/v1/bootstrap');
  },
  listProducts: listProducts,
  listAllProducts: listAllProducts,
  getCart: function () {
    return request('GET', '/api/v1/cart');
  },
  // Endpoints below remain explicit gaps; no secret or fake identity is stored.
  createWechatSession: function () {
    return notWired('/api/v1/auth/wechat/session (未实现)');
  },
  getMemberCard: function () {
    return notWired('/api/v1/member-card (未实现)');
  },
  createMemberCodeChallenge: function () {
    return notWired('/api/v1/member-code/challenge (未实现)');
  },
};
