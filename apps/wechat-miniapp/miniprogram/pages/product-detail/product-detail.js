var sizeClassUtil = require('../../utils/sizeClass');
var share = require('../../utils/share');

var app = getApp();

function presentProduct(product) {
  var price = Number(product.priceCents);
  var marketPrice = Number(product.marketPriceCents);
  var stock = Number(product.availableStock);
  return Object.assign({}, product, {
    image: product.coverUrl || null,
    priceText: Number.isFinite(price) && price > 0 ? '¥' + (price / 100).toFixed(2) : '价格待同步',
    marketPriceText: Number.isFinite(marketPrice) && marketPrice > price ? '市场价 ¥' + (marketPrice / 100).toFixed(2) : '',
    stockText: Number.isFinite(stock) && stock > 0 ? '库存 ' + stock : '暂无可售库存',
    sourceText: product.isTest ? '非商业测试数据' : product.supplierName || '供应商待同步',
  });
}

Page({
  data: { nav: {}, sizeClass: '', sizeStyle: '', product: null, error: '' },

  onLoad: function (options) {
    share.enableMenu();
    var area = app.getSafeArea();
    var size = app.getSizeClass();
    var id = options.id ? decodeURIComponent(options.id) : '';
    var stored = id ? wx.getStorageSync('sw-public-product-' + id) : null;
    this.setData({
      nav: area,
      sizeClass: size.className,
      sizeStyle: size.rootStyle,
      product: stored && stored.id === id ? presentProduct(stored) : null,
      error: stored && stored.id === id ? '' : '商品信息未缓存，请从商品列表重新进入',
    });
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onBack: function () {
    wx.navigateBack();
  },

  onImageError: function () {
    this.setData({ 'product.image': null });
  },

  onShareAppMessage: function () {
    var product = this.data.product;
    return share.appMessage({
      title: product && product.name ? product.name + '｜智慧翼福利商城' : '智慧翼福利商城',
      path: product && product.id ? '/pages/product-detail/product-detail?id=' + encodeURIComponent(product.id) : '/pages/home/home',
    });
  },

  onShareTimeline: function () {
    var product = this.data.product;
    return share.timeline({
      title: product && product.name ? product.name + '｜智慧翼福利商城' : '智慧翼福利商城',
      query: product && product.id ? 'id=' + encodeURIComponent(product.id) : '',
    });
  },
});
