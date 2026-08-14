var CACHE_VERSION = 1;
var CACHE_TTL_MS = 2 * 60 * 1000;
var HOME_KEY = 'sw-member-home-v1';
var ORDERS_KEY = 'sw-member-orders-v1';

function createRuntimeCache(storage) {
  var storageApi = storage || {};

  function read(key) {
    if (typeof storageApi.getStorageSync !== 'function') return null;
    try {
      var envelope = storageApi.getStorageSync(key);
      if (!envelope || envelope.version !== CACHE_VERSION || envelope.data === undefined) return null;
      var storedAt = Number(envelope.storedAt || 0);
      return {
        data: envelope.data,
        storedAt: storedAt,
        stale: Date.now() - storedAt > CACHE_TTL_MS,
      };
    } catch (_error) {
      return null;
    }
  }

  function write(key, data) {
    if (data === undefined || typeof storageApi.setStorageSync !== 'function') return;
    try {
      storageApi.setStorageSync(key, {
        version: CACHE_VERSION,
        storedAt: Date.now(),
        data: data,
      });
    } catch (_error) {
      // A full local cache must never turn a successful API response into an error.
    }
  }

  function clear() {
    if (typeof storageApi.removeStorageSync !== 'function') return;
    try {
      storageApi.removeStorageSync(HOME_KEY);
      storageApi.removeStorageSync(ORDERS_KEY);
    } catch (_error) {
      // Cache cleanup is best effort; authorization remains server enforced.
    }
  }

  return {
    readHome: function () {
      return read(HOME_KEY);
    },
    writeHome: function (data) {
      write(HOME_KEY, data);
    },
    readOrders: function () {
      return read(ORDERS_KEY);
    },
    writeOrders: function (data) {
      write(ORDERS_KEY, data);
    },
    clear: clear,
  };
}

module.exports = { createRuntimeCache: createRuntimeCache };
