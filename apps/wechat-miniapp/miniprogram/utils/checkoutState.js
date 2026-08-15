var CART_CACHE_KEY = 'sw-cart-snapshot-v1';
var CHECKOUT_DRAFT_KEY = 'sw-checkout-draft-v1';
var CART_TTL_MS = 2 * 60 * 1000;
var DRAFT_TTL_MS = 10 * 60 * 1000;
var SESSION_SCOPE_KEY = 'sw_member_session_scope';

function scopedKey(key) {
  var scope = storageRead(SESSION_SCOPE_KEY);
  return typeof scope === 'string' && scope ? key + ':' + scope : '';
}

function storageRead(key) {
  try {
    return wx.getStorageSync(key) || null;
  } catch (_error) {
    return null;
  }
}

function storageWrite(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (_error) {
    // Cache failure must never block the authenticated server path.
  }
}

function storageRemove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (_error) {}
}

function money(cents) {
  var value = Number(cents);
  return Number.isSafeInteger(value) && value >= 0 ? (value / 100).toFixed(2) : '';
}

function qualificationCopy(item) {
  var reason = item && item.qualification && item.qualification.purchaseReason;
  var messages = {
    MEMBERSHIP_INACTIVE: '会员身份不可用',
    SKU_NOT_AVAILABLE: '商品已下架',
    COMMERCIAL_RESOURCE_NOT_LISTED: '商品暂不可购买',
    BRAND_NOT_AUTHORIZED: '品牌授权暂不可用',
    PURCHASE_LIMIT_EXCEEDED: '已超过限购数量',
    CITY_NOT_ELIGIBLE: '当前地址不在配送范围',
  };
  return messages[reason] || '当前商品不可购买';
}

function specText(specs) {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return '';
  return Object.keys(specs)
    .slice(0, 3)
    .map(function (key) {
      return String(specs[key]);
    })
    .filter(Boolean)
    .join(' · ');
}

function presentItem(item) {
  var quantity = Number(item && item.quantity);
  var priceCents = Number(item && item.priceCents);
  var stock = Number(item && item.availableStock);
  var validQuantity = Number.isInteger(quantity) && quantity > 0 && quantity <= 99;
  var validPrice = Number.isSafeInteger(priceCents) && priceCents > 0;
  var validStock = Number.isInteger(stock) && stock >= quantity;
  var enabled = Boolean(item && item.purchasable && !item.isTest && validQuantity && validPrice && validStock);
  return Object.assign({}, item, {
    quantity: validQuantity ? quantity : 1,
    priceCents: validPrice ? priceCents : null,
    availableStock: Number.isInteger(stock) && stock >= 0 ? stock : 0,
    image: item && item.coverUrl ? item.coverUrl : '',
    specText: specText(item && item.specs),
    priceText: validPrice ? money(priceCents) : '',
    lineText: validPrice && validQuantity ? money(priceCents * quantity) : '',
    enabled: enabled,
    selected: Boolean(item && item.selected && enabled),
    disabledCopy: enabled ? '' : item && item.isTest ? '测试商品不可购买' : qualificationCopy(item),
  });
}

function presentCart(items) {
  var rows = (Array.isArray(items) ? items : []).map(presentItem);
  var groupMap = {};
  var groups = [];
  rows.forEach(function (item, index) {
    item.flatIndex = index;
    var key = item.supplierId || 'unknown';
    if (!groupMap[key]) {
      groupMap[key] = { key: key, name: item.supplierName || '供应商待同步', items: [] };
      groups.push(groupMap[key]);
    }
    groupMap[key].items.push(item);
  });
  var selected = rows.filter(function (item) {
    return item.selected;
  });
  var enabled = rows.filter(function (item) {
    return item.enabled;
  });
  return {
    rows: rows,
    groups: groups,
    selectedCount: selected.length,
    totalText: money(
      selected.reduce(function (sum, item) {
        return sum + item.priceCents * item.quantity;
      }, 0)
    ),
    allSelected: Boolean(
      enabled.length &&
        enabled.every(function (item) {
          return item.selected;
        })
    ),
  };
}

function readEnvelope(key, ttl) {
  var resolvedKey = scopedKey(key);
  if (!resolvedKey) return null;
  var value = storageRead(resolvedKey);
  if (!value || !Array.isArray(value.items) || !Number.isFinite(value.storedAt) || Date.now() - value.storedAt > ttl) return null;
  return value;
}

function writeCart(items) {
  var key = scopedKey(CART_CACHE_KEY);
  if (key) storageWrite(key, { items: Array.isArray(items) ? items : [], storedAt: Date.now() });
}

function writeDraft(items) {
  var selected = presentCart(items).rows.filter(function (item) {
    return item.selected;
  });
  if (!selected.length) return false;
  var key = scopedKey(CHECKOUT_DRAFT_KEY);
  if (!key) return false;
  storageWrite(key, { items: selected, storedAt: Date.now() });
  return true;
}

module.exports = {
  money: money,
  presentCart: presentCart,
  readCart: function () {
    return readEnvelope(CART_CACHE_KEY, CART_TTL_MS);
  },
  writeCart: writeCart,
  clearCart: function () {
    var key = scopedKey(CART_CACHE_KEY);
    if (key) storageRemove(key);
  },
  readDraft: function () {
    return readEnvelope(CHECKOUT_DRAFT_KEY, DRAFT_TTL_MS);
  },
  writeDraft: writeDraft,
  clearDraft: function () {
    var key = scopedKey(CHECKOUT_DRAFT_KEY);
    if (key) storageRemove(key);
  },
};
