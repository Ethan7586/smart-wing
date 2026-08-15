var accountPresentation = require('./accountPresentation');
var runtimeCacheFactory = require('./runtimeCache').createRuntimeCache;

function createMemberApi(dependencies) {
  var deps = dependencies || {};
  var runtimeCache = runtimeCacheFactory(deps.storage);
  var activeHomeRequest = null;
  var activeOrdersRequest = null;

  function singleFlight(current, create, clear) {
    if (current) return current;
    var request = create();
    return request.then(
      function (value) {
        clear();
        return value;
      },
      function (error) {
        clear();
        throw error;
      }
    );
  }

  function getHomeSnapshot() {
    activeHomeRequest = singleFlight(
      activeHomeRequest,
      function () {
        return deps.authenticatedRequest('GET', '/api/v1/home').then(function (response) {
          runtimeCache.writeHome(response);
          return response;
        });
      },
      function () {
        activeHomeRequest = null;
      }
    );
    return activeHomeRequest;
  }

  function listOrders() {
    activeOrdersRequest = singleFlight(
      activeOrdersRequest,
      function () {
        return deps.authenticatedRequest('GET', '/api/v1/orders').then(function (response) {
          if (response && Array.isArray(response.items)) runtimeCache.writeOrders(response);
          return response;
        });
      },
      function () {
        activeOrdersRequest = null;
      }
    );
    return activeOrdersRequest;
  }

  function prefetchAccountData() {
    var home = runtimeCache.readHome();
    var orders = runtimeCache.readOrders();
    var tasks = [];
    if (!home || home.stale) tasks.push(getHomeSnapshot());
    if (!orders || orders.stale) tasks.push(listOrders());
    return Promise.all(
      tasks.map(function (task) {
        return task.catch(function () {
          return null;
        });
      })
    );
  }

  function prefetchPublicCatalog() {
    var cached = deps.catalogApi.readCachedProducts();
    if (cached && !cached.cache.stale) return Promise.resolve(cached);
    return deps.catalogApi.listProducts({ cursor: 0, limit: deps.catalogApi.cacheLimit }).catch(function () {
      return cached;
    });
  }

  return {
    bindWechatMember: function (input) {
      var body = input || {};
      if (!body.bindingChallenge || !body.username || !body.password) {
        return Promise.reject(deps.apiError('INVALID_WECHAT_BIND_INPUT', '会员绑定信息不完整'));
      }
      return deps.performRequest('POST', '/api/v1/auth/wechat/bind', { bindingChallenge: body.bindingChallenge, username: body.username, password: body.password }, { auth: false }).then(function (response) {
        runtimeCache.clear();
        return deps.storeSession(response);
      });
    },
    registerWechatMember: function (input) {
      var body = input || {};
      if (!body.bindingChallenge || !body.username || !body.password || !body.displayName || !body.inviteCode || body.acceptedTerms !== true) {
        return Promise.reject(deps.apiError('INVALID_WECHAT_REGISTRATION', '微信注册信息不完整'));
      }
      return deps
        .performRequest(
          'POST',
          '/api/v1/auth/wechat/register',
          {
            bindingChallenge: body.bindingChallenge,
            username: body.username,
            password: body.password,
            displayName: body.displayName,
            inviteCode: body.inviteCode,
            acceptedTerms: true,
          },
          { auth: false }
        )
        .then(function (response) {
          runtimeCache.clear();
          return deps.storeSession(response);
        });
    },
    requestPhoneVerification: function (mobile) {
      if (!/^1[3-9]\d{9}$/.test(String(mobile || '').trim())) {
        return Promise.reject(deps.apiError('INVALID_MOBILE', '请输入正确的11位手机号码'));
      }
      return deps.authenticatedRequest('POST', '/api/v1/auth/security/otp', {
        mobile: String(mobile).trim(),
        purpose: 'phone_change',
      });
    },
    verifyPhone: function (input) {
      var body = input || {};
      if (!/^1[3-9]\d{9}$/.test(String(body.mobile || '').trim()) || !body.challengeId || !/^\d{6}$/.test(String(body.code || '')) || !body.currentPassword) {
        return Promise.reject(deps.apiError('INVALID_PHONE_VERIFICATION', '手机号验证信息不完整'));
      }
      return deps
        .authenticatedRequest('POST', '/api/v1/auth/phone/change', {
          newMobile: String(body.mobile).trim(),
          challengeId: body.challengeId,
          code: String(body.code),
          currentPassword: body.currentPassword,
        })
        .then(function (response) {
          runtimeCache.clear();
          return response;
        });
    },
    getHomeSnapshot: getHomeSnapshot,
    readCachedHomeSnapshot: runtimeCache.readHome,
    getBootstrap: function () {
      return deps.authenticatedRequest('GET', '/api/v1/bootstrap');
    },
    listOrders: listOrders,
    readCachedOrders: runtimeCache.readOrders,
    prefetchAccountData: prefetchAccountData,
    prefetchPublicCatalog: prefetchPublicCatalog,
    getMemberCard: function () {
      var cached = runtimeCache.readHome();
      if (cached) {
        var cachedCard = accountPresentation.memberCard(cached.data);
        if (cachedCard) {
          // Paint the last server-confirmed card immediately. A stale card may
          // improve perceived speed, but it never authorizes a member code:
          // challenge issuance is independently validated by the server.
          if (cached.stale) getHomeSnapshot().catch(function () {});
          return Promise.resolve(cachedCard);
        }
      }
      return getHomeSnapshot().then(function (response) {
        var card = accountPresentation.memberCard(response);
        if (!card) throw deps.apiError('INVALID_MEMBER_CARD_RESPONSE', '会员资料返回格式异常');
        return card;
      });
    },
  };
}

module.exports = { createMemberApi: createMemberApi };
