var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');
var presentation = require('../../utils/orderPresentation');

var app = getApp();

Page({
  data: {
    sizeClass: '',
    sizeStyle: '',
    orderNo: '',
    entryFromWechatOrderCenter: false,
    loading: true,
    error: null,
    order: null,
    paymentBusy: false,
    paymentState: 'idle',
    paymentMessage: '',
  },

  onLoad: function (options) {
    var size = app.getSizeClass();
    var orderNo = api.normalizeOrderNo(options && options.orderNo);
    this.setData({
      sizeClass: size.className,
      sizeStyle: size.rootStyle,
      orderNo: orderNo,
      entryFromWechatOrderCenter: Boolean(options && options.channel === 'wechat_order_center'),
    });
    if (!orderNo) {
      this.setData({ loading: false, error: presentation.loadErrorView({ code: 'INVALID_ORDER_NO', message: '订单编号缺失或格式不正确' }) });
      return;
    }
    this.loadOrder(false);
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onPullDownRefresh: function () {
    this.loadOrder(true);
  },

  onUnload: function () {
    ['_orderRequest', '_prepayRequest', '_statusRequest'].forEach(
      function (key) {
        var request = this[key];
        if (request && typeof request.abort === 'function') request.abort();
      }.bind(this)
    );
  },

  loadOrder: function (refreshing) {
    var self = this;
    if (!this.data.orderNo) return Promise.resolve();
    if (this._orderRequest && typeof this._orderRequest.abort === 'function') this._orderRequest.abort();
    this.setData({ loading: !refreshing || !this.data.order, error: null });
    this._orderRequest = api.getOrderByNumber(this.data.orderNo);
    return this._orderRequest.then(
      function (response) {
        if (!response || !response.order) throw { code: 'INVALID_ORDER_RESPONSE', message: '订单详情返回格式异常' };
        var order = presentation.decorateOrder(response.order);
        if (!order.id || !order.orderNo || order.orderNo !== self.data.orderNo) {
          throw { code: 'INVALID_ORDER_RESPONSE', message: '订单详情与请求编号不一致，系统已阻止展示' };
        }
        self.setData({ loading: false, error: null, order: order });
        wx.stopPullDownRefresh();
      },
      function (error) {
        if (error && error.code === 'REQUEST_ABORTED') return;
        self.setData({ loading: false, error: presentation.loadErrorView(error), order: null });
        wx.stopPullDownRefresh();
      }
    );
  },

  onRetryOrder: function () {
    this.loadOrder(false);
  },

  onOpenOrders: function () {
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  onItemImageError: function (event) {
    var index = Number(event.currentTarget.dataset.index);
    if (!this.data.order || !Number.isInteger(index) || !this.data.order.items[index]) return;
    var path = 'order.items[' + index + '].image';
    this.setData({ [path]: '' });
  },

  onPay: function () {
    var self = this;
    var order = this.data.order;
    if (this.data.paymentBusy || !order || !order.canPay) return;
    if (!this._paymentIdempotencyKey) this._paymentIdempotencyKey = api.createIdempotencyKey(order.id);
    this.setData({ paymentBusy: true, paymentState: 'preparing', paymentMessage: '正在向服务端申请微信支付参数…' });
    this._prepayRequest = api.createWechatPrepay(order.id, this._paymentIdempotencyKey);
    this._prepayRequest.then(
      function (response) {
        self.setData({ paymentState: 'requesting', paymentMessage: '请在微信支付界面完成确认' });
        api.requestWechatPayment(response).then(
          function () {
            self.confirmAcceptedPayment();
          },
          function (error) {
            self.checkAfterClientFailure(error);
          }
        );
      },
      function (error) {
        self.setData({ paymentBusy: false, paymentState: 'blocked', paymentMessage: presentation.paymentErrorCopy(error) });
      }
    );
  },

  confirmAcceptedPayment: function () {
    var self = this;
    var order = this.data.order;
    if (!order) return;
    this.setData({ paymentState: 'confirming', paymentMessage: '微信已返回，正在等待服务端确认到账…' });
    this._statusRequest = api.pollPaymentStatus(order.id, { maxAttempts: 12, intervalMs: 1500 });
    this._statusRequest.then(
      function (response) {
        self.applyPaymentStatus(response, true);
      },
      function (error) {
        if (error && error.code === 'REQUEST_ABORTED') return;
        self.setData({ paymentBusy: false, paymentState: 'processing', paymentMessage: presentation.paymentErrorCopy(error) });
      }
    );
  },

  checkAfterClientFailure: function (clientError) {
    var self = this;
    var order = this.data.order;
    if (!order) return;
    this.setData({ paymentState: 'confirming', paymentMessage: '正在向服务端核对订单状态…' });
    this._statusRequest = api.getPaymentStatus(order.id);
    this._statusRequest.then(
      function (response) {
        if (response && response.status === 'paid') return self.applyPaymentStatus(response, true);
        self.setData({
          paymentBusy: false,
          paymentState: clientError.code === 'PAYMENT_CANCELLED' ? 'cancelled' : 'failed',
          paymentMessage: clientError.message,
        });
      },
      function () {
        self.setData({
          paymentBusy: false,
          paymentState: clientError.code === 'PAYMENT_CANCELLED' ? 'cancelled' : 'failed',
          paymentMessage: clientError.message + '；服务端状态暂未取回，请稍后刷新。',
        });
      }
    );
  },

  onRefreshPaymentStatus: function () {
    var self = this;
    var order = this.data.order;
    if (this.data.paymentBusy || !order) return;
    this.setData({ paymentBusy: true, paymentState: 'confirming', paymentMessage: '正在查询服务端支付状态…' });
    this._statusRequest = api.getPaymentStatus(order.id);
    this._statusRequest.then(
      function (response) {
        self.applyPaymentStatus(response, false);
      },
      function (error) {
        self.setData({ paymentBusy: false, paymentState: 'processing', paymentMessage: presentation.paymentErrorCopy(error) });
      }
    );
  },

  applyPaymentStatus: function (response, showSuccess) {
    var status = response && response.status;
    if (status === 'paid') {
      this._paymentIdempotencyKey = '';
      this.setData({ paymentBusy: false, paymentState: 'confirmed', paymentMessage: '支付已由服务端确认', 'order.canPay': false, 'order.paymentStatus': 'paid', 'order.paymentStatusLabel': '支付成功' });
      if (showSuccess) wx.showToast({ title: '支付已确认', icon: 'success' });
      this.loadOrder(true);
      return;
    }
    var terminal = status === 'closed' || status === 'failed' || status === 'refunded';
    this.setData({
      paymentBusy: false,
      paymentState: terminal ? 'failed' : 'processing',
      paymentMessage: terminal ? '服务端确认当前支付状态：' + presentation.paymentStatusLabel(status) : '支付仍在确认，请稍后刷新。',
      'order.paymentStatus': status || 'unknown',
      'order.paymentStatusLabel': presentation.paymentStatusLabel(status),
    });
  },
});
