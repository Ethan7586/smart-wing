var cacheModule = require('./catalogCache');
var CACHE_LIMIT = cacheModule.cacheLimit;
var CDN_CATALOG_URL = 'https://img.hbbtzn.com/catalog/public/v1/latest.json';

function createCatalogApi(performRequest, apiError, storage) {
  var cache = cacheModule.createCatalogCache(storage);
  var activeRequests = {};

  function productPath(options) {
    var input = options || {};
    var parts = [];
    if (input.category) parts.push('category=' + encodeURIComponent(input.category));
    if (typeof input.cursor === 'number') parts.push('cursor=' + input.cursor);
    parts.push('limit=' + Math.min(Math.max(Number(input.limit) || CACHE_LIMIT, 1), CACHE_LIMIT));
    return '/api/v1/catalog/public/products?' + parts.join('&');
  }

  function subscribe(key, createRequest) {
    var entry = activeRequests[key];
    if (!entry) {
      var request = createRequest();
      entry = { request: request, consumers: 0, settled: false };
      entry.promise = request.then(
        function (value) {
          entry.settled = true;
          delete activeRequests[key];
          return value;
        },
        function (error) {
          entry.settled = true;
          delete activeRequests[key];
          throw error;
        }
      );
      activeRequests[key] = entry;
    }
    entry.consumers += 1;
    var cancelled = false;
    var rejectConsumer = null;
    var consumer = new Promise(function (resolve, reject) {
      rejectConsumer = reject;
      entry.promise.then(
        function (value) {
          if (!cancelled) resolve(value);
        },
        function (error) {
          if (!cancelled) reject(error);
        }
      );
    });
    consumer.abort = function () {
      if (cancelled || entry.settled) return;
      cancelled = true;
      entry.consumers -= 1;
      rejectConsumer(apiError('REQUEST_ABORTED', '请求已取消'));
      if (entry.consumers <= 0 && entry.request && typeof entry.request.abort === 'function') entry.request.abort();
    };
    return consumer;
  }

  function responseEtag(result, body) {
    var headers = (result && result.header) || {};
    var header = headers.etag || headers.ETag || '';
    if (header) return header;
    var version = body && body.mirror && body.mirror.catalogVersion;
    return version ? '"' + version + '"' : '';
  }

  function fetchCatalog(url, cached, timeout) {
    var headers = {};
    if (cached && cached.cache && cached.cache.complete && cached.cache.etag) headers['if-none-match'] = cached.cache.etag;
    return performRequest('GET', url, undefined, {
      auth: false,
      allowNotModified: true,
      rawResponse: true,
      timeout: timeout,
      headers: headers,
    });
  }

  function listProducts(options) {
    var input = options || {};
    var path = productPath(input);
    return subscribe(path, function () {
      var cached = cache.read(input.category);
      var active = null;
      var cancelled = false;
      var useCdn = !input.category && Number(input.cursor || 0) === 0 && Number(input.limit || CACHE_LIMIT) === CACHE_LIMIT;
      function run(url, timeout) {
        if (cancelled) return Promise.reject(apiError('REQUEST_ABORTED', '请求已取消'));
        active = fetchCatalog(url, cached, timeout);
        return active;
      }
      var network = useCdn
        ? run(CDN_CATALOG_URL, 1500).catch(function () {
            return run(path, 10000);
          })
        : run(path, 10000);
      var request = network.then(function (result) {
        if (result.statusCode === 304 && cached) return cached;
        var response = result.data;
        if (!response || !Array.isArray(response.items) || !response.pagination) {
          return Promise.reject(apiError('INVALID_CATALOG_RESPONSE', '商品目录返回格式异常'));
        }
        var bounded = Object.assign({}, response, { items: cacheModule.cacheItems(response.items) });
        if (!input.cursor) cache.write(bounded, input.category, responseEtag(result, response));
        return bounded;
      });
      request.abort = function () {
        cancelled = true;
        if (active && typeof active.abort === 'function') active.abort();
      };
      return request;
    });
  }

  return {
    listProducts: listProducts,
    readCachedProducts: cache.read,
    hydrateBundledCatalog: cache.hydrate,
    cacheLimit: CACHE_LIMIT,
    criticalLimit: cacheModule.criticalLimit,
    cdnCatalogUrl: CDN_CATALOG_URL,
  };
}

module.exports = { createCatalogApi: createCatalogApi };
