var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');
var share = require('../../utils/share');

var app = getApp();
var CACHE_WINDOW_SIZE = 200;
var RENDER_BATCH_SIZE = 12;

function presentProduct(product) {
  var price = Number(product.priceCents);
  var stock = Number(product.availableStock);
  return Object.assign({}, product, {
    image: product.coverUrl || null,
    priceText: Number.isFinite(price) && price > 0 ? '¥' + (price / 100).toFixed(2) : '价格待同步',
    stockText: Number.isFinite(stock) && stock > 0 ? '库存 ' + stock : product.isTest ? '非商业测试数据' : '暂不可售',
  });
}

function afterFirstPaint(callback) {
  if (typeof wx.nextTick === 'function') wx.nextTick(callback);
  else setTimeout(callback, 0);
}

Page({
  data: {
    nav: {},
    sizeClass: '',
    sizeStyle: '',
    title: '公开商品',
    category: '',
    products: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    loadError: '',
    cacheText: '正在准备商品缓存',
  },

  onLoad: function (options) {
    share.enableMenu();
    var area = app.getSafeArea();
    var size = app.getSizeClass();
    this.setData({
      title: options.title ? decodeURIComponent(options.title) : '公开商品',
      category: options.category ? decodeURIComponent(options.category) : '',
      nav: area,
      sizeClass: size.className,
      sizeStyle: size.rootStyle,
    });
    this._windowProducts = [];
    this._visibleCount = 0;
    var cached = api.readCachedProducts(this.data.category);
    if (cached) {
      this.applyWindow(cached.items, true);
      this.setData({ cacheText: '关键商品已就绪 · ' + cached.items.length + ' 件立即可见' });
      afterFirstPaint(
        function () {
          this.hydrateWindow();
        }.bind(this)
      );
    } else {
      this.refreshWindow(true);
    }
  },

  hydrateWindow: function () {
    var self = this;
    return api
      .hydrateBundledCatalog()
      .then(function (hydrated) {
        if (!hydrated) return false;
        var items = self.data.category
          ? hydrated.items.filter(function (product) {
              return product.taxonomy && product.taxonomy.l1 === self.data.category;
            })
          : hydrated.items;
        self.applyWindow(items, true);
        self.setData({ cacheText: '完整目录已就绪 · ' + items.length + ' 件已缓存' });
        if (hydrated.cache && hydrated.cache.stale) return self.refreshWindow(false);
        return true;
      })
      .catch(function () {
        return self.refreshWindow(false);
      });
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onUnload: function () {
    if (this._request && typeof this._request.abort === 'function') this._request.abort();
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loadingMore) this.revealMore();
  },

  onPullDownRefresh: function () {
    this.refreshWindow(false).finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  applyWindow: function (items, resetVisible) {
    this._windowProducts = (Array.isArray(items) ? items : []).slice(0, CACHE_WINDOW_SIZE).map(presentProduct);
    this._visibleCount = resetVisible ? Math.min(RENDER_BATCH_SIZE, this._windowProducts.length) : Math.min(Math.max(this._visibleCount, RENDER_BATCH_SIZE), this._windowProducts.length);
    this.setData({
      products: this._windowProducts.slice(0, this._visibleCount),
      hasMore: this._visibleCount < this._windowProducts.length,
      loading: false,
      loadingMore: false,
      loadError: '',
    });
  },

  revealMore: function () {
    this._visibleCount = Math.min(this._visibleCount + RENDER_BATCH_SIZE, this._windowProducts.length);
    this.setData({
      products: this._windowProducts.slice(0, this._visibleCount),
      hasMore: this._visibleCount < this._windowProducts.length,
      loadingMore: false,
    });
  },

  refreshWindow: function (showLoading) {
    var self = this;
    if (this._request && typeof this._request.abort === 'function') this._request.abort();
    this.setData(showLoading ? { loading: true, loadError: '', products: [] } : { loadError: '', cacheText: '正在后台更新 200 件商品缓存' });
    this._request = api.listProducts({ category: this.data.category, cursor: 0, limit: CACHE_WINDOW_SIZE });
    return this._request
      .then(function (response) {
        if (!response || !Array.isArray(response.items) || !response.pagination) throw new Error('商品目录返回格式异常');
        self.applyWindow(response.items, showLoading || self._visibleCount === 0);
        self.setData({ cacheText: '已缓存 ' + self._windowProducts.length + ' 件商品，可随时浏览' });
      })
      .catch(function (error) {
        if (error && error.code === 'REQUEST_ABORTED') return;
        self.setData({ loading: false, loadingMore: false, loadError: (error && error.message) || '商品加载失败，请重试' });
      });
  },

  onBack: function () {
    wx.navigateBack();
  },

  onRetry: function () {
    this.refreshWindow(this.data.products.length === 0);
  },

  onImageError: function (event) {
    var index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.products[index]) return;
    this.setData({ ['products[' + index + '].image']: null });
    if (this._windowProducts[index]) this._windowProducts[index].image = null;
  },

  onOpenProduct: function (event) {
    var index = Number(event.currentTarget.dataset.index);
    var product = this.data.products[index];
    if (!product) return;
    wx.setStorageSync('sw-public-product-' + product.id, product);
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + encodeURIComponent(product.id) });
  },

  onShareAppMessage: function () {
    var query = '?title=' + encodeURIComponent(this.data.title || '公开商品') + '&category=' + encodeURIComponent(this.data.category || '');
    return share.appMessage({ title: '智慧翼福利商城｜' + (this.data.title || '公开商品'), path: '/pages/products/products' + query });
  },

  onShareTimeline: function () {
    return share.timeline({
      title: '智慧翼福利商城｜' + (this.data.title || '公开商品'),
      query: 'title=' + encodeURIComponent(this.data.title || '公开商品') + '&category=' + encodeURIComponent(this.data.category || ''),
    });
  },
});
