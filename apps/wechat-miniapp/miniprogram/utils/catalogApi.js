var CACHE_KEY = 'sw-public-catalog-window-v3';
var CACHE_VERSION = 3;
var CACHE_LIMIT = 200;
var CACHE_TTL_MS = 15 * 60 * 1000;
var bundledSeed = require('../data/catalog-seed.generated');

function createCatalogApi(performRequest, apiError, storage) {
  var storageApi = storage || {};
  var memoryCache = {};
  var activeRequests = {};

  function storageKey(category) {
    return CACHE_KEY + ':' + (category || 'all');
  }

  function productPath(options) {
    var input = options || {};
    var parts = [];
    if (input.category) parts.push('category=' + encodeURIComponent(input.category));
    if (typeof input.cursor === 'number') parts.push('cursor=' + input.cursor);
    parts.push('limit=' + Math.min(Math.max(Number(input.limit) || CACHE_LIMIT, 1), CACHE_LIMIT));
    return '/api/v1/catalog/public/products?' + parts.join('&');
  }

  function productCategory(product) {
    return (product && product.taxonomy && product.taxonomy.l1) || (product && product.categoryCode) || '';
  }

  function cacheItems(items) {
    return (Array.isArray(items) ? items : []).slice(0, CACHE_LIMIT).map(function (item) {
      return {
        id: item.id,
        skuId: item.skuId,
        name: item.name,
        subtitle: item.subtitle,
        categoryCode: item.categoryCode,
        taxonomy: item.taxonomy,
        coverUrl: item.coverUrl,
        priceCents: item.priceCents,
        marketPriceCents: item.marketPriceCents,
        availableStock: item.availableStock,
        supplierName: item.supplierName,
        isTest: item.isTest,
        purchasable: item.purchasable,
      };
    });
  }

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : []).slice(0, CACHE_LIMIT).map(function (item) {
      return Object.assign({}, item);
    });
  }

  function writeCache(response, category) {
    if (!response || !Array.isArray(response.items)) return;
    var key = storageKey(category);
    var envelope = {
      version: CACHE_VERSION,
      storedAt: Date.now(),
      category: category || '',
      items: cacheItems(response.items),
      requestId: response.requestId || '',
    };
    memoryCache[key] = envelope;
    if (typeof storageApi.setStorage === 'function') {
      storageApi.setStorage({ key: key, data: envelope, fail: function () {} });
      return;
    }
    if (typeof storageApi.setStorageSync !== 'function') return;
    try {
      storageApi.setStorageSync(key, envelope);
    } catch (_error) {
      // Storage pressure must not turn a successful network request into a failure.
    }
  }

  function readCachedProducts(category) {
    try {
      var key = storageKey(category);
      var envelope = memoryCache[key];
      if (!envelope && typeof storageApi.getStorageSync === 'function') {
        envelope = storageApi.getStorageSync(key);
        if (envelope) memoryCache[key] = envelope;
      }
      if ((!envelope || envelope.version !== CACHE_VERSION) && category) {
        key = storageKey('');
        envelope = memoryCache[key];
        if (!envelope && typeof storageApi.getStorageSync === 'function') {
          envelope = storageApi.getStorageSync(key);
          if (envelope) memoryCache[key] = envelope;
        }
      }
      if ((!envelope || envelope.version !== CACHE_VERSION) && bundledSeed && bundledSeed.version === 1 && Array.isArray(bundledSeed.items)) {
        key = storageKey('');
        envelope = {
          version: CACHE_VERSION,
          storedAt: Date.parse(bundledSeed.generatedAt) || 0,
          category: '',
          items: cacheItems(bundledSeed.items),
          requestId: 'bundled-catalog-seed',
          source: 'bundle',
        };
        memoryCache[key] = envelope;
      }
      if (!envelope || envelope.version !== CACHE_VERSION || !Array.isArray(envelope.items)) return null;
      var items = envelope.items.slice(0, CACHE_LIMIT);
      if (category) {
        items = items.filter(function (product) {
          return productCategory(product) === category;
        });
      }
      if (!items.length) return null;
      return {
        items: items,
        requestId: envelope.requestId || 'miniapp-cache',
        pagination: { cursor: 0, nextCursor: null, limit: CACHE_LIMIT },
        cache: {
          hit: true,
          stale: Date.now() - Number(envelope.storedAt || 0) > CACHE_TTL_MS,
          storedAt: Number(envelope.storedAt || 0),
          source: envelope.source || 'storage',
        },
      };
    } catch (_error) {
      return null;
    }
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

  function listProducts(options) {
    var input = options || {};
    var path = productPath(input);
    return subscribe(path, function () {
      var request = performRequest('GET', path, undefined, { auth: false });
      var promise = request.then(function (response) {
        if (!response || !Array.isArray(response.items) || !response.pagination) {
          return Promise.reject(apiError('INVALID_CATALOG_RESPONSE', '商品目录返回格式异常'));
        }
        var bounded = Object.assign({}, response, {
          items: normalizeItems(response.items),
        });
        if (!input.cursor) writeCache(bounded, input.category);
        return bounded;
      });
      promise.abort = function () {
        if (request && typeof request.abort === 'function') request.abort();
      };
      return promise;
    });
  }

  return { listProducts: listProducts, readCachedProducts: readCachedProducts, cacheLimit: CACHE_LIMIT };
}

module.exports = { createCatalogApi: createCatalogApi };
