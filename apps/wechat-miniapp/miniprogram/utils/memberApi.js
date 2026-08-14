var accountPresentation = require('./accountPresentation');
var runtimeCacheFactory = require('./runtimeCache').createRuntimeCache;

function createMemberApi(dependencies) {
  var deps = dependencies || {};
  var runtimeCache = runtimeCacheFactory(deps.storage);

  function getHomeSnapshot() {
    return deps.authenticatedRequest('GET', '/api/v1/home').then(function (response) {
      runtimeCache.writeHome(response);
      return response;
    });
  }

  function listOrders() {
    return deps.authenticatedRequest('GET', '/api/v1/orders').then(function (response) {
      if (response && Array.isArray(response.items)) runtimeCache.writeOrders(response);
      return response;
    });
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
      return getHomeSnapshot().then(function (response) {
        var card = accountPresentation.memberCard(response);
        if (!card) throw deps.apiError('INVALID_MEMBER_CARD_RESPONSE', '会员资料返回格式异常');
        return card;
      });
    },
  };
}

module.exports = { createMemberApi: createMemberApi };
