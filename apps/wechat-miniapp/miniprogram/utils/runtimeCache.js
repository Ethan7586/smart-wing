var CACHE_VERSION = 1;
var CACHE_TTL_MS = 2 * 60 * 1000;
var HOME_KEY = 'sw-member-home-v1';
var ORDERS_KEY = 'sw-member-orders-v1';

function createRuntimeCache(storage) {
  var storageApi = storage || {};
  var memory = {};

  function read(key) {
    try {
      var envelope = memory[key];
      if (!envelope && typeof storageApi.getStorageSync === 'function') {
        envelope = storageApi.getStorageSync(key);
        if (envelope) memory[key] = envelope;
      }
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
    if (data === undefined) return;
    var envelope = {
      version: CACHE_VERSION,
      storedAt: Date.now(),
      data: data,
    };
    memory[key] = envelope;
    if (typeof storageApi.setStorage === 'function') {
      storageApi.setStorage({ key: key, data: envelope, fail: function () {} });
      return;
    }
    if (typeof storageApi.setStorageSync !== 'function') return;
    try {
      storageApi.setStorageSync(key, envelope);
    } catch (_error) {
      // A full local cache must never turn a successful API response into an error.
    }
  }

  function clear() {
    delete memory[HOME_KEY];
    delete memory[ORDERS_KEY];
    if (typeof storageApi.removeStorage === 'function') {
      storageApi.removeStorage({ key: HOME_KEY, fail: function () {} });
      storageApi.removeStorage({ key: ORDERS_KEY, fail: function () {} });
      return;
    }
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
