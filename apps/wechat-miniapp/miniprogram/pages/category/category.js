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
  if (code === 'WECHAT_BINDING_REQUIRED') {
    return { state: 'auth', message: '首次使用请绑定现有智慧翼会员，绑定后自动同步商品', retryable: false };
  }
  if (code === 'REQUEST_TIMEOUT') return { state: 'timeout', message: error.message, retryable: true };
  if (code === 'NETWORK_ERROR') return { state: 'offline', message: error.message, retryable: true };
  if (code === 'AUTH_REQUIRED' || code === 'AUTH_CHANNEL_PENDING') {
    return { state: 'auth', message: '分类结构已载入 · 商品数据等待会员登录', retryable: false };
  }
  if (code === 'CATALOG_FORBIDDEN') return { state: 'auth', message: error.message, retryable: false };
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
    bindingRequired: false,
    bindingUsername: '',
    bindingPassword: '',
    bindingBusy: false,
    bindingError: '',
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
    this._bindingChallenge = '';
    this.data.bindingPassword = '';
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
    this.setData({ bindingRequired: false, bindingError: '' });
    this.applySync({ state: 'syncing', message: '正在登录并同步当前会员可见商品', retryable: false });
    this._catalogRequest = api.listAllProducts();
    return this._catalogRequest
      .then(function (response) {
        if (activeVersion !== self._loadVersion) return false;
        var products = catalog.itemsFromResponse(response);
        var purchasableCount = products.filter(function (product) {
          return product.purchasable === true;
        }).length;
        self.applySnapshot(catalog.createSnapshot(products), true);
        self.applySync({
          state: products.length ? 'live' : 'empty',
          message: products.length ? '主商城已同步 · ' + products.length + ' 件可见 / ' + purchasableCount + ' 件可购' : '当前会员暂无可见商品',
          retryable: products.length === 0,
        });
        return true;
      })
      .catch(function (error) {
        if (activeVersion !== self._loadVersion) return false;
        if (error && error.code === 'WECHAT_BINDING_REQUIRED') {
          self._bindingChallenge = error.bindingChallenge || '';
          self.setData({
            bindingRequired: true,
            bindingPassword: '',
            bindingBusy: false,
            bindingError: self._bindingChallenge ? '' : '绑定凭证缺失，请重新登录',
          });
        }
        self.applySync(syncCopy(error));
        return false;
      });
  },

  applySnapshot: function (snapshot, keepSelection) {
    var current = keepSelection ? this.data.railKey : '';
    var key = current && snapshot.tilesByKey[current] ? current : snapshot.rail.length ? snapshot.rail[0].key : '';
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

  onRetry: function () {
    this.loadCategories();
  },

  onRetrySync: function () {
    this.refreshCatalog();
  },

  onBindingUsername: function (event) {
    this.setData({ bindingUsername: (event.detail.value || '').trim(), bindingError: '' });
  },

  onBindingPassword: function (event) {
    this.setData({ bindingPassword: event.detail.value || '', bindingError: '' });
  },

  onBindMember: function () {
    var self = this;
    var username = this.data.bindingUsername;
    var password = this.data.bindingPassword;
    if (this.data.bindingBusy) return;
    if (!this._bindingChallenge) return this.refreshCatalog();
    if (!username || !password) return this.setData({ bindingError: '请输入现有智慧翼账号和密码' });
    this.setData({ bindingBusy: true, bindingError: '' });
    api
      .bindWechatMember({
        bindingChallenge: this._bindingChallenge,
        username: username,
        password: password,
      })
      .then(
        function () {
          self._bindingChallenge = '';
          self.setData({
            bindingRequired: false,
            bindingUsername: '',
            bindingPassword: '',
            bindingBusy: false,
          });
          self.refreshCatalog();
        },
        function (error) {
          self.setData({
            bindingBusy: false,
            bindingPassword: '',
            bindingError: (error && error.message) || '会员绑定失败，请核对账号后重试',
          });
        }
      );
  },

  onPending: function (event) {
    wx.showToast({
      title: (event.currentTarget.dataset.label || '该功能') + '将在阶段 2 后续页面接通',
      icon: 'none',
    });
  },
});
