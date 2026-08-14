var api = require('../../utils/api');
var catalog = require('../../utils/catalog');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();
var FILTERS_PENDING = {
  city: '武汉市 · 预览',
  qualification: '登录后识别可购资格',
};

function syncCopy(error) {
  var code = error && error.code;
  if (code === 'REQUEST_TIMEOUT') return { state: 'timeout', message: error.message, retryable: true };
  if (code === 'NETWORK_ERROR') return { state: 'offline', message: error.message, retryable: true };
  return { state: 'error', message: (error && error.message) || '商品同步失败，已保留分类结构', retryable: true };
}

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    sizeClass: '',
    sizeStyle: '',
    loading: true,
    loadError: null,
    cartCount: 0,
    filters: {},
    rail: [],
    railKey: '',
    tiles: [],
    syncState: 'local',
    syncMessage: '正在载入统一分类结构',
    syncRetryable: false,
  },

  onLoad: function () {
    var area = app.getSafeArea();
    var size = app.getSizeClass();
    this._loadVersion = 0;
    this._tilesByKey = {};
    this.setData({
      sizeClass: size.className,
      sizeStyle: size.rootStyle,
      nav: {
        statusBarHeight: area.statusBarHeight,
        navContentHeight: area.navContentHeight,
        navTotalHeight: area.navTotalHeight,
        rightInset: area.rightInset,
      },
    });
    this.loadCategories();
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  onUnload: function () {
    this._loadVersion += 1;
    if (this._catalogRequest && typeof this._catalogRequest.abort === 'function') this._catalogRequest.abort();
  },

  loadCategories: function () {
    var self = this;
    var version = (this._loadVersion || 0) + 1;
    this._loadVersion = version;
    if (this._catalogRequest && typeof this._catalogRequest.abort === 'function') this._catalogRequest.abort();
    this.setData({ loading: true, loadError: null });

    Promise.resolve()
      .then(function () {
        return catalog.createSnapshot([]);
      })
      .then(function (snapshot) {
        if (version !== self._loadVersion) return null;
        self.applySnapshot(snapshot, false);
        return self.refreshCatalog(version);
      })
      .catch(function (error) {
        if (version !== self._loadVersion) return;
        self.setData({ loading: false, loadError: (error && error.message) || '分类结构加载失败，请重试' });
      });
  },

  refreshCatalog: function (version) {
    var self = this;
    var activeVersion = typeof version === 'number' ? version : (this._loadVersion || 0) + 1;
    this._loadVersion = activeVersion;
    this.applySync({ state: 'syncing', message: '正在同步主商城公开商品', retryable: false });
    this._catalogRequest = api.listProducts({ cursor: 0, limit: 100 });
    return this._catalogRequest
      .then(function (response) {
        if (activeVersion !== self._loadVersion) return false;
        var products = catalog.itemsFromResponse(response);
        self.applySnapshot(catalog.createSnapshot(products), true);
        self.applySync({
          state: products.length ? 'live' : 'empty',
          message: products.length ? '主商城公开商品已连接 · 首批 ' + products.length + ' 件已载入' : '主商城当前暂无公开商品',
          retryable: products.length === 0,
        });
        return true;
      })
      .catch(function (error) {
        if (activeVersion !== self._loadVersion) return false;
        self.applySync(syncCopy(error));
        return false;
      });
  },

  applySnapshot: function (snapshot, keepSelection) {
    var current = keepSelection ? this.data.railKey : '';
    var key = catalog.preferredRailKey(snapshot, current);
    this._tilesByKey = snapshot.tilesByKey;
    this.setData({
      loading: false,
      loadError: null,
      cartCount: 0,
      filters: FILTERS_PENDING,
      rail: snapshot.rail,
      railKey: key,
      tiles: snapshot.tilesByKey[key] || [],
    });
  },

  applySync: function (status) {
    this.setData({ syncState: status.state, syncMessage: status.message, syncRetryable: status.retryable });
  },

  onSelectRail: function (event) {
    var key = event.currentTarget.dataset.key;
    if (key === this.data.railKey || !this._tilesByKey[key]) return;
    this.setData({ railKey: key, tiles: this._tilesByKey[key] });
  },

  onImageError: function (event) {
    var index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.tiles[index]) return;
    var path = 'tiles[' + index + '].image';
    this.setData({ [path]: null });
    if (this._tilesByKey[this.data.railKey] && this._tilesByKey[this.data.railKey][index]) {
      this._tilesByKey[this.data.railKey][index].image = null;
    }
  },

  onOpenProducts: function (event) {
    var item = event.currentTarget.dataset.item;
    if (!item || !item.productCount) {
      wx.showToast({ title: '当前分类暂无公开商品', icon: 'none' });
      return;
    }
    var title = encodeURIComponent(item.label || '公开商品');
    var category = encodeURIComponent(this.data.railKey === 'featured' ? '' : this.data.railKey);
    wx.navigateTo({ url: '/pages/products/products?title=' + title + '&category=' + category });
  },

  onRetry: function () {
    this.loadCategories();
  },

  onRetrySync: function () {
    this.refreshCatalog();
  },

  onPending: function (event) {
    wx.showToast({
      title: (event.currentTarget.dataset.label || '该功能') + '将在阶段 2 后续页面接通',
      icon: 'none',
    });
  },
});
