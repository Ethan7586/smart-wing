var CACHE_KEY = 'sw-public-catalog-window-v4';
var CRITICAL_CACHE_KEY = 'sw-public-catalog-critical-v1:all';
var CACHE_VERSION = 4;
var CACHE_LIMIT = 200;
var CRITICAL_LIMIT = 24;
var CACHE_TTL_MS = 15 * 60 * 1000;
var criticalSeed = require('../data/catalog-seed-critical.generated');
var completeSeed = null;

function productCategory(product) {
  return (product && product.taxonomy && product.taxonomy.l1) || (product && product.categoryCode) || '';
}

function cacheItems(items, limit) {
  return (Array.isArray(items) ? items : []).slice(0, limit || CACHE_LIMIT).map(function (item) {
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

function selectCriticalItems(items) {
  var groups = {};
  cacheItems(items).forEach(function (item) {
    var key = productCategory(item) || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  var keys = Object.keys(groups);
  var selected = [];
  while (
    selected.length < CRITICAL_LIMIT &&
    keys.some(function (key) {
      return groups[key].length;
    })
  ) {
    keys.forEach(function (key) {
      if (groups[key].length && selected.length < CRITICAL_LIMIT) selected.push(groups[key].shift());
    });
  }
  return selected;
}

function createCatalogCache(storage) {
  var storageApi = storage || {};
  var memory = {};

  function fullKey(category) {
    return CACHE_KEY + ':' + (category || 'all');
  }

  function valid(value) {
    return value && value.version === CACHE_VERSION && Array.isArray(value.items) && value.items.length > 0;
  }

  function persist(key, envelope) {
    if (typeof storageApi.setStorage === 'function') {
      storageApi.setStorage({ key: key, data: envelope, fail: function () {} });
      return;
    }
    if (typeof storageApi.setStorageSync !== 'function') return;
    try {
      storageApi.setStorageSync(key, envelope);
    } catch (_error) {
      // Storage pressure must not turn a successful request into a failure.
    }
  }

  function envelopeFrom(items, options) {
    var settings = options || {};
    return {
      version: CACHE_VERSION,
      storedAt: Number(settings.storedAt || Date.now()),
      category: settings.category || '',
      items: cacheItems(items, settings.limit || CACHE_LIMIT),
      requestId: settings.requestId || '',
      etag: settings.etag || '',
      mirror: settings.mirror || null,
      complete: settings.complete === true,
      source: settings.source || 'network',
    };
  }

  function seedEnvelope(seed, complete) {
    return envelopeFrom(seed.items, {
      storedAt: Date.parse(seed.generatedAt) || 0,
      requestId: complete ? 'bundled-catalog-seed' : 'bundled-critical-seed',
      complete: complete,
      source: complete ? 'bundle-full' : 'bundle-critical',
      limit: complete ? CACHE_LIMIT : CRITICAL_LIMIT,
    });
  }

  function responseFrom(envelope, category) {
    var items = envelope.items;
    if (category) {
      items = items.filter(function (product) {
        return productCategory(product) === category;
      });
    }
    if (!items.length) return null;
    return {
      items: items,
      mirror: envelope.mirror,
      requestId: envelope.requestId || 'miniapp-cache',
      pagination: { cursor: 0, nextCursor: null, limit: CACHE_LIMIT },
      cache: {
        hit: true,
        stale: Date.now() - Number(envelope.storedAt || 0) > CACHE_TTL_MS,
        storedAt: Number(envelope.storedAt || 0),
        source: envelope.source || 'storage',
        complete: envelope.complete === true,
        etag: envelope.etag || '',
      },
    };
  }

  function read(category) {
    try {
      var full = memory[fullKey(category)] || memory[fullKey('')];
      if (valid(full)) return responseFrom(full, category);
      var critical = memory[CRITICAL_CACHE_KEY];
      if (!critical && typeof storageApi.getStorageSync === 'function') {
        critical = storageApi.getStorageSync(CRITICAL_CACHE_KEY);
        if (valid(critical)) memory[CRITICAL_CACHE_KEY] = critical;
      }
      if (!valid(critical)) {
        critical = seedEnvelope(criticalSeed, false);
        memory[CRITICAL_CACHE_KEY] = critical;
      }
      return responseFrom(critical, category);
    } catch (_error) {
      return responseFrom(seedEnvelope(criticalSeed, false), category);
    }
  }

  function asyncStored(key) {
    if (typeof storageApi.getStorage === 'function') {
      return new Promise(function (resolve) {
        storageApi.getStorage({
          key: key,
          success: function (result) {
            resolve(valid(result && result.data) ? result.data : null);
          },
          fail: function () {
            resolve(null);
          },
        });
      });
    }
    try {
      return Promise.resolve(typeof storageApi.getStorageSync === 'function' ? storageApi.getStorageSync(key) : null);
    } catch (_error) {
      return Promise.resolve(null);
    }
  }

  function hydrate() {
    var key = fullKey('');
    if (valid(memory[key])) return Promise.resolve(responseFrom(memory[key]));
    return asyncStored(key).then(function (stored) {
      var envelope = stored;
      if (!valid(envelope) || envelope.complete !== true) {
        if (!completeSeed) completeSeed = require('../data/catalog-seed.generated');
        envelope = seedEnvelope(completeSeed, true);
        persist(key, envelope);
      }
      memory[key] = envelope;
      return responseFrom(envelope);
    });
  }

  function write(response, category, etag) {
    if (!response || !Array.isArray(response.items)) return;
    var full = envelopeFrom(response.items, {
      category: category,
      requestId: response.requestId,
      etag: etag,
      mirror: response.mirror,
      complete: true,
    });
    memory[fullKey(category)] = full;
    persist(fullKey(category), full);
    if (!category) {
      var critical = envelopeFrom(selectCriticalItems(response.items), {
        limit: CRITICAL_LIMIT,
        requestId: response.requestId,
        etag: etag,
        mirror: response.mirror,
        complete: false,
      });
      memory[CRITICAL_CACHE_KEY] = critical;
      persist(CRITICAL_CACHE_KEY, critical);
    }
  }

  return { read: read, hydrate: hydrate, write: write };
}

module.exports = {
  createCatalogCache: createCatalogCache,
  cacheItems: cacheItems,
  cacheLimit: CACHE_LIMIT,
  criticalLimit: CRITICAL_LIMIT,
};
