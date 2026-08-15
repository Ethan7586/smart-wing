var api = require('../../utils/api');
var checkoutState = require('../../utils/checkoutState');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();

function emptyRecipient() {
  return { name: '', mobile: '', province: '', city: '', district: '', address: '' };
}

function addressToRecipient(address) {
  var value = address || {};
  return {
    name: value.name || '',
    mobile: value.phone || value.mobile || '',
    province: value.province || '',
    city: value.city || '',
    district: value.district || '',
    address: value.detail || value.address || '',
  };
}

function orderFromResponse(response) {
  var order = response && response.order;
  return order && typeof order.id === 'string' && typeof order.orderNo === 'string' ? order : null;
}

Page({
  data: {
    nav: {},
    sizeClass: '',
    sizeStyle: '',
    items: [],
    totalText: '0.00',
    recipient: emptyRecipient(),
    region: [],
    regionText: '请选择省 / 市 / 区',
    addressLoading: true,
    addressMessage: '',
    saveAddress: false,
    submitting: false,
    error: '',
  },

  onLoad: function () {
    var size = app.getSizeClass();
    var draft = checkoutState.readDraft();
    this.setData({ nav: app.getSafeArea(), sizeClass: size.className, sizeStyle: size.rootStyle });
    if (!draft) {
      this.setData({ addressLoading: false, error: '结算信息已失效，请返回购物车重新选择商品' });
      return;
    }
    var cart = checkoutState.presentCart(draft.items);
    if (
      !cart.rows.length ||
      cart.rows.some(function (item) {
        return !item.enabled;
      })
    ) {
      this.setData({ addressLoading: false, error: '结算商品状态已变化，请返回购物车重新确认' });
      return;
    }
    this._draftItems = cart.rows;
    this.setData({ items: cart.rows, totalText: cart.totalText });
    this.loadAddresses();
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ nav: app.getSafeArea(true), sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onUnload: function () {
    if (this._request && typeof this._request.abort === 'function') this._request.abort();
  },

  onBack: function () {
    wx.navigateBack({
      fail: function () {
        wx.redirectTo({ url: '/pages/cart/cart' });
      },
    });
  },

  loadAddresses: function () {
    var self = this;
    this._request = api.getAddresses();
    this._request.then(
      function (response) {
        var items = response && Array.isArray(response.items) ? response.items : [];
        var selected =
          items.find(function (item) {
            return item.isDefault;
          }) || items[0];
        if (!selected) {
          self.setData({ addressLoading: false, addressMessage: '尚无收货地址，请填写本次订单的真实收货信息。' });
          return;
        }
        var recipient = addressToRecipient(selected);
        self.setData({
          addressLoading: false,
          addressMessage: '已载入默认收货地址',
          recipient: recipient,
          region: [recipient.province, recipient.city, recipient.district],
          regionText: [recipient.province, recipient.city, recipient.district].filter(Boolean).join(' / '),
        });
      },
      function (error) {
        if (error && error.code === 'REQUEST_ABORTED') return;
        self.setData({ addressLoading: false, addressMessage: '地址簿暂未载入，可直接填写本次订单地址。' });
      }
    );
  },

  onFieldInput: function (event) {
    var field = event.currentTarget.dataset.field;
    if (['name', 'mobile', 'address'].indexOf(field) < 0) return;
    this.setData({ ['recipient.' + field]: event.detail.value });
  },

  onRegionChange: function (event) {
    var region = event.detail.value || [];
    if (region.length < 3) return;
    this.setData({
      'recipient.province': region[0],
      'recipient.city': region[1],
      'recipient.district': region[2],
      region: region,
      regionText: region.join(' / '),
    });
  },

  onToggleSaveAddress: function () {
    this.setData({ saveAddress: !this.data.saveAddress });
  },

  validate: function () {
    var recipient = this.data.recipient;
    if (!recipient.name.trim()) return '请填写收货人姓名';
    if (!/^1\d{10}$/.test(recipient.mobile.trim())) return '请填写真实的 11 位大陆手机号';
    if (!recipient.province || !recipient.city || !recipient.district) return '请选择完整省市区';
    if (!recipient.address.trim()) return '请填写详细收货地址';
    return '';
  },

  onSubmit: function () {
    var self = this;
    if (this.data.submitting || this.data.addressLoading || this.data.error) return;
    var validation = this.validate();
    if (validation) {
      wx.showToast({ title: validation, icon: 'none' });
      return;
    }
    var recipient = Object.assign({}, this.data.recipient);
    var items = this._draftItems.map(function (item) {
      return { skuId: item.skuId, quantity: item.quantity };
    });
    if (!this._idempotencyKey) this._idempotencyKey = api.createIdempotencyKey('checkout');
    this.setData({ submitting: true });
    var save = this.data.saveAddress
      ? api.saveAddress({
          name: recipient.name,
          phone: recipient.mobile,
          province: recipient.province,
          city: recipient.city,
          district: recipient.district,
          detail: recipient.address,
          tag: '',
          isDefault: true,
        })
      : Promise.resolve();
    save
      .then(function () {
        self._request = api.createOrder(items, recipient, self._idempotencyKey);
        return self._request;
      })
      .then(
        function (response) {
          var order = orderFromResponse(response);
          if (!order) throw { code: 'INVALID_ORDER_RESPONSE', message: '订单创建成功响应缺少订单编号' };
          checkoutState.clearDraft();
          checkoutState.clearCart();
          wx.redirectTo({ url: '/pages/order-detail/order-detail?orderNo=' + encodeURIComponent(order.orderNo) + '&autoPay=1' });
        },
        function (error) {
          self.setData({ submitting: false });
          wx.showToast({ title: (error && error.message) || '提交订单失败，请重试', icon: 'none', duration: 2600 });
        }
      );
  },
});
