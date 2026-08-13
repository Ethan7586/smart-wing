/**
 * Commerce API service layer.
 *
 * Deliberately not wired yet. Phase 6 of the build order connects real data,
 * and none of the endpoints the mini program needs exist server-side today
 * (auth/wechat/session, member-card, member-code/*, vouchers, payments/*).
 *
 * The shape lives here from day one so pages are written against a service, not
 * against a global blob of seed data. When the endpoints ship, only this file
 * and the loaders change — no page layout moves.
 *
 * WeChat has no cookie jar, so the web app's Host-only session cookie cannot be
 * reused. A short-lived bearer token bound to member, session, device and
 * authzVersion has to be issued before any of these calls can work.
 */

var BASE_URL = ''; // Set once the request domain is whitelisted in the MP console.

function notWired(name) {
  return Promise.reject({
    code: 'API_NOT_WIRED',
    endpoint: name,
    message: '服务端接口尚未接入，当前展示为本地演示数据',
  });
}

function request(method, path, data) {
  if (!BASE_URL) return notWired(path);
  return new Promise(function (resolve, reject) {
    wx.request({
      url: BASE_URL + path,
      method: method,
      data: data,
      header: { 'content-type': 'application/json' },
      success: function (response) {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
        else reject(response.data || { code: 'HTTP_' + response.statusCode });
      },
      fail: function (error) {
        reject({ code: 'NETWORK_ERROR', message: error.errMsg });
      },
    });
  });
}

module.exports = {
  isWired: function () {
    return Boolean(BASE_URL);
  },
  getHomeSnapshot: function () {
    return request('GET', '/api/v1/home');
  },
  getBootstrap: function () {
    return request('GET', '/api/v1/bootstrap');
  },
  getCart: function () {
    return request('GET', '/api/v1/cart');
  },
  // Endpoints below do not exist server-side yet; listed so the gap is visible.
  createWechatSession: function (code) {
    return notWired('/api/v1/auth/wechat/session (未实现)');
  },
  getMemberCard: function () {
    return notWired('/api/v1/member-card (未实现)');
  },
  createMemberCodeChallenge: function () {
    return notWired('/api/v1/member-code/challenge (未实现)');
  },
};
