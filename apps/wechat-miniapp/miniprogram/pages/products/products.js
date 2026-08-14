var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();
var PAGE_SIZE = 24;

function presentProduct(product) {
  var price = Number(product.priceCents);
  var stock = Number(product.availableStock);
  return Object.assign({}, product, {
    image: product.coverUrl || null,
    priceText: Number.isFinite(price) && price > 0 ? '¥' + (price / 100).toFixed(2) : '价格待同步',
    stockText: Number.isFinite(stock) && stock > 0 ? '库存 ' + stock : product.isTest ? '非商业测试数据' : '暂不可售',
  });
}

Page({
  data: {
    nav: {},
    sizeClass: '',
    sizeStyle: '',
    title: '公开商品',
    category: '',
    products: [],
    nextCursor: 0,
    loading: true,
    loadingMore: false,
    hasMore: true,
    loadError: '',
  },

  onLoad: function (options) {
    var area = app.getSafeArea();
    var size = app.getSizeClass();
    this.setData({
      title: options.title ? decodeURIComponent(options.title) : '公开商品',
      category: options.category ? decodeURIComponent(options.category) : '',
      nav: area,
      sizeClass: size.className,
      sizeStyle: size.rootStyle,
    });
    this.loadPage(true);
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
    if (this.data.hasMore && !this.data.loadingMore) this.loadPage(false);
  },

  onPullDownRefresh: function () {
    this.loadPage(true).finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  loadPage: function (reset) {
    var self = this;
    if (this._request && typeof this._request.abort === 'function') this._request.abort();
    var cursor = reset ? 0 : this.data.nextCursor;
    this.setData(reset ? { loading: true, loadError: '', products: [] } : { loadingMore: true, loadError: '' });
    this._request = api.listProducts({ category: this.data.category, cursor: cursor, limit: PAGE_SIZE });
    return this._request
      .then(function (response) {
        if (!response || !Array.isArray(response.items) || !response.pagination) throw new Error('商品目录返回格式异常');
        var nextProducts = response.items.map(presentProduct);
        self.setData({
          products: reset ? nextProducts : self.data.products.concat(nextProducts),
          nextCursor: response.pagination.nextCursor,
          hasMore: response.pagination.nextCursor !== null,
          loading: false,
          loadingMore: false,
        });
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
    this.loadPage(this.data.products.length === 0);
  },

  onImageError: function (event) {
    var index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.products[index]) return;
    this.setData({ ['products[' + index + '].image']: null });
  },

  onOpenProduct: function (event) {
    var index = Number(event.currentTarget.dataset.index);
    var product = this.data.products[index];
    if (!product) return;
    wx.setStorageSync('sw-public-product-' + product.id, product);
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + encodeURIComponent(product.id) });
  },
});
