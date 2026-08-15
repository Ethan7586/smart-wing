var api = require('../../utils/api');
var checkoutState = require('../../utils/checkoutState');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();

function errorView(error) {
  var code = error && error.code;
  if (code === 'WECHAT_BINDING_REQUIRED') return { kind: 'binding', title: '请先绑定商城会员', message: '绑定后才能读取你的购物车与购买资格。', retryable: false };
  if (code === 'PHONE_VERIFICATION_REQUIRED') return { kind: 'assurance', title: '需要完成手机认证', message: error.message, retryable: false };
  if (code === 'NETWORK_ERROR' || code === 'REQUEST_TIMEOUT') return { kind: 'offline', title: '购物车暂时没有同步', message: error.message, retryable: true };
  return { kind: 'error', title: '购物车加载失败', message: (error && error.message) || '请稍后重试', retryable: true };
}

Page({
  data: {
    nav: {},
    sizeClass: '',
    sizeStyle: '',
    loading: true,
    refreshing: false,
    error: null,
    cart: { rows: [], groups: [], selectedCount: 0, totalText: '0.00', allSelected: false },
    busyId: '',
    selectingAll: false,
  },

  onLoad: function () {
    var size = app.getSizeClass();
    this.setData({ nav: app.getSafeArea(), sizeClass: size.className, sizeStyle: size.rootStyle });
    var cached = checkoutState.readCart();
    if (cached) this.applyItems(cached.items, false);
    this.loadCart(!cached);
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ nav: app.getSafeArea(true), sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onPullDownRefresh: function () {
    this.loadCart(false, true);
  },

  onUnload: function () {
    if (this._request && typeof this._request.abort === 'function') this._request.abort();
  },

  applyItems: function (items, store) {
    this._items = Array.isArray(items)
      ? items.map(function (item) {
          return Object.assign({}, item);
        })
      : [];
    if (store !== false) checkoutState.writeCart(this._items);
    this.setData({ cart: checkoutState.presentCart(this._items), loading: false, error: null });
  },

  loadCart: function (showLoading, refreshing) {
    var self = this;
    if (this._request && typeof this._request.abort === 'function') this._request.abort();
    this.setData({ loading: Boolean(showLoading), refreshing: Boolean(refreshing), error: null });
    this._request = api.getCart();
    return this._request.then(
      function (response) {
        self.applyItems(response && response.items, true);
        self.setData({ refreshing: false });
        wx.stopPullDownRefresh();
      },
      function (error) {
        if (error && error.code === 'REQUEST_ABORTED') return;
        self.setData({ loading: false, refreshing: false, error: errorView(error) });
        wx.stopPullDownRefresh();
      }
    );
  },

  onBack: function () {
    wx.navigateBack({
      fail: function () {
        wx.switchTab({ url: '/pages/home/home' });
      },
    });
  },

  onRetry: function () {
    this.loadCart(true);
  },

  onOpenBinding: function () {
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  findItem: function (itemId) {
    return (this._items || []).find(function (item) {
      return item.id === itemId;
    });
  },

  syncItem: function (item, next) {
    var self = this;
    if (!item || this.data.busyId) return;
    var previous = Object.assign({}, item);
    Object.assign(item, next);
    this.applyItems(this._items, true);
    this.setData({ busyId: item.id });
    this._request = api.updateCartItem(item.skuId, item.quantity, Boolean(item.selected));
    this._request.then(
      function () {
        self.setData({ busyId: '' });
      },
      function (error) {
        var current = self.findItem(previous.id);
        if (current) Object.assign(current, previous);
        self.applyItems(self._items, true);
        self.setData({ busyId: '' });
        wx.showToast({ title: (error && error.message) || '购物车更新失败', icon: 'none' });
      }
    );
  },

  onToggleItem: function (event) {
    var item = this.findItem(event.currentTarget.dataset.id);
    if (item && checkoutState.presentCart([item]).rows[0].enabled) this.syncItem(item, { selected: !item.selected });
  },

  onDecrease: function (event) {
    var item = this.findItem(event.currentTarget.dataset.id);
    if (item && item.quantity > 1) this.syncItem(item, { quantity: item.quantity - 1 });
  },

  onIncrease: function (event) {
    var item = this.findItem(event.currentTarget.dataset.id);
    if (item && item.quantity < Math.min(99, Number(item.availableStock) || 0)) this.syncItem(item, { quantity: item.quantity + 1 });
  },

  onRemove: function (event) {
    var self = this;
    var item = this.findItem(event.currentTarget.dataset.id);
    if (!item || this.data.busyId) return;
    wx.showModal({
      title: '移除商品',
      content: '确定从购物车移除“' + item.name + '”吗？',
      success: function (result) {
        if (!result.confirm) return;
        var previous = self._items.slice();
        self.applyItems(
          previous.filter(function (row) {
            return row.id !== item.id;
          }),
          true
        );
        self.setData({ busyId: item.id });
        self._request = api.deleteCartItem(item.id);
        self._request.then(
          function () {
            self.setData({ busyId: '' });
          },
          function (error) {
            self.applyItems(previous, true);
            self.setData({ busyId: '' });
            wx.showToast({ title: (error && error.message) || '移除失败', icon: 'none' });
          }
        );
      },
    });
  },

  onToggleAll: function () {
    var self = this;
    if (this.data.selectingAll || this.data.busyId) return;
    var nextSelected = !this.data.cart.allSelected;
    var enabled = checkoutState.presentCart(this._items).rows.filter(function (item) {
      return item.enabled && item.selected !== nextSelected;
    });
    if (!enabled.length) return;
    var previous = this._items.map(function (item) {
      return Object.assign({}, item);
    });
    var ids = {};
    enabled.forEach(function (item) {
      ids[item.id] = true;
    });
    this._items.forEach(function (item) {
      if (ids[item.id]) item.selected = nextSelected;
    });
    this.applyItems(this._items, true);
    this.setData({ selectingAll: true });
    Promise.all(
      enabled.map(function (item) {
        return api.updateCartItem(item.skuId, item.quantity, nextSelected);
      })
    ).then(
      function () {
        self.setData({ selectingAll: false });
      },
      function (error) {
        self.applyItems(previous, true);
        self.setData({ selectingAll: false });
        wx.showToast({ title: (error && error.message) || '全选更新失败', icon: 'none' });
      }
    );
  },

  onImageError: function (event) {
    var item = this.findItem(event.currentTarget.dataset.id);
    if (item) {
      item.coverUrl = '';
      this.applyItems(this._items, true);
    }
  },

  onCheckout: function () {
    if (!this.data.cart.selectedCount || !checkoutState.writeDraft(this._items)) return;
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  },
});
