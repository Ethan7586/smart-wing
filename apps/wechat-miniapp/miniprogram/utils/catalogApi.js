var CACHE_KEY = 'sw-public-catalog-window-v2';
var CACHE_VERSION = 2;
var CACHE_LIMIT = 200;
var CACHE_TTL_MS = 15 * 60 * 1000;

function createCatalogApi(performRequest, apiError, storage) {
  var storageApi = storage || {};

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

  function writeCache(response, category) {
    if (!response || !Array.isArray(response.items) || typeof storageApi.setStorageSync !== 'function') return;
    try {
      storageApi.setStorageSync(storageKey(category), {
        version: CACHE_VERSION,
        storedAt: Date.now(),
        category: category || '',
        items: cacheItems(response.items),
        requestId: response.requestId || '',
      });
    } catch (_error) {
      // Storage pressure must not turn a successful network request into a failure.
    }
  }

  function readCachedProducts(category) {
    if (typeof storageApi.getStorageSync !== 'function') return null;
    try {
      var envelope = storageApi.getStorageSync(storageKey(category));
      if ((!envelope || envelope.version !== CACHE_VERSION) && category) {
        envelope = storageApi.getStorageSync(storageKey(''));
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
        },
      };
    } catch (_error) {
      return null;
    }
  }

  function listProducts(options) {
    var input = options || {};
    var request = performRequest('GET', productPath(input), undefined, { auth: false });
    var promise = request.then(function (response) {
      if (!response || !Array.isArray(response.items) || !response.pagination) {
        return Promise.reject(apiError('INVALID_CATALOG_RESPONSE', '商品目录返回格式异常'));
      }
      var bounded = Object.assign({}, response, { items: response.items.slice(0, CACHE_LIMIT) });
      if (!input.cursor) writeCache(bounded, input.category);
      return bounded;
    });
    promise.abort = function () {
      if (request && typeof request.abort === 'function') request.abort();
    };
    return promise;
  }

  return { listProducts: listProducts, readCachedProducts: readCachedProducts, cacheLimit: CACHE_LIMIT };
}

module.exports = { createCatalogApi: createCatalogApi };
