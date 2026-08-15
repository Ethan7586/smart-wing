var api = require('../../utils/api');
var presentation = require('../../utils/orderPresentation');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();

Page({
  data: { nav: {}, sizeClass: '', sizeStyle: '', orderNo: '', loading: true, error: '', order: null },

  onLoad: function (options) {
    var size = app.getSizeClass();
    var orderNo = api.normalizeOrderNo(options && options.orderNo);
    this.setData({ nav: app.getSafeArea(), sizeClass: size.className, sizeStyle: size.rootStyle, orderNo: orderNo });
    if (!orderNo) {
      this.setData({ loading: false, error: '支付结果缺少订单编号，请前往订单列表查看' });
      return;
    }
    this.loadOrder();
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ nav: app.getSafeArea(true), sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onUnload: function () {
    if (this._request && typeof this._request.abort === 'function') this._request.abort();
  },

  loadOrder: function () {
    var self = this;
    this.setData({ loading: true, error: '' });
    this._request = api.getOrderByNumber(this.data.orderNo);
    this._request.then(
      function (response) {
        if (!response || !response.order) throw { message: '订单结果返回格式异常' };
        var order = presentation.decorateOrder(response.order);
        self.setData({ loading: false, order: order, error: '' });
      },
      function (error) {
        if (error && error.code === 'REQUEST_ABORTED') return;
        self.setData({ loading: false, error: (error && error.message) || '支付结果暂未取回' });
      }
    );
  },

  onRetry: function () {
    this.loadOrder();
  },

  onOpenOrder: function () {
    wx.redirectTo({ url: '/pages/order-detail/order-detail?orderNo=' + encodeURIComponent(this.data.orderNo) });
  },

  onContinue: function () {
    wx.switchTab({ url: '/pages/home/home' });
  },
});
