var sizeClassUtil = require('../../utils/sizeClass');
var share = require('../../utils/share');
var api = require('../../utils/api');
var checkoutState = require('../../utils/checkoutState');
var catalogPolicy = require('../../utils/catalogPolicy');

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
    canBuy: Boolean(product.skuId && !product.isTest && Number.isFinite(price) && price > 0 && Number.isInteger(stock) && stock > 0),
  });
}

Page({
  data: { nav: {}, sizeClass: '', sizeStyle: '', product: null, error: '', cartBusy: false },

  onLoad: function (options) {
    share.enableMenu();
    var area = app.getSafeArea();
    var size = app.getSizeClass();
    var id = options.id ? decodeURIComponent(options.id) : '';
    var stored = id ? wx.getStorageSync('sw-public-product-' + id) : null;
    var visible = stored && stored.id === id && catalogPolicy.isProductVisible(stored);
    this.setData({
      nav: area,
      sizeClass: size.className,
      sizeStyle: size.rootStyle,
      product: visible ? presentProduct(stored) : null,
      error: visible ? '' : stored && stored.id === id ? '该商品暂未在小程序开放' : '商品信息未缓存，请从商品列表重新进入',
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

  onOpenCart: function () {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  addToCart: function (openCart) {
    var self = this;
    var product = this.data.product;
    if (this.data.cartBusy || !product || !product.canBuy) return;
    this.setData({ cartBusy: true });
    var cached = checkoutState.readCart();
    var source = cached ? Promise.resolve({ items: cached.items }) : api.getCart();
    source
      .then(function (response) {
        var items = response && Array.isArray(response.items) ? response.items : [];
        var existing = items.find(function (item) {
          return item.skuId === product.skuId;
        });
        var existingQuantity = existing ? Number(existing.quantity) : 0;
        var maximum = Math.min(Number(product.availableStock), 99);
        if (existingQuantity >= maximum) throw { code: 'CART_STOCK_LIMIT', message: '已达到当前可购库存上限' };
        var quantity = Math.min(maximum, existingQuantity + 1);
        return api.updateCartItem(product.skuId, quantity, true);
      })
      .then(
        function () {
          checkoutState.clearCart();
          self.setData({ cartBusy: false });
          if (openCart) wx.navigateTo({ url: '/pages/cart/cart' });
          else wx.showToast({ title: '已加入购物车', icon: 'success' });
        },
        function (error) {
          self.setData({ cartBusy: false });
          if (error && error.code === 'WECHAT_BINDING_REQUIRED') {
            wx.showModal({
              title: '请先绑定商城会员',
              content: '绑定后才能确认购买资格并加入购物车。',
              confirmText: '前往绑定',
              success: function (result) {
                if (result.confirm) wx.switchTab({ url: '/pages/orders/orders' });
              },
            });
            return;
          }
          wx.showToast({ title: (error && error.message) || '加入购物车失败', icon: 'none' });
        }
      );
  },

  onAddCart: function () {
    this.addToCart(false);
  },

  onBuyNow: function () {
    this.addToCart(true);
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
