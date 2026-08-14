var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();
var FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending_payment', label: '待付款' },
  { key: 'pending_shipment', label: '待发货' },
  { key: 'pending_receipt', label: '待收货' },
  { key: 'completed', label: '已完成' },
];

function centsValue(value) {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
}

function formatCents(value) {
  var cents = centsValue(value);
  if (!Number.isFinite(cents)) return '';
  var absolute = Math.abs(Math.round(cents));
  var yuan = Math.floor(absolute / 100);
  var fraction = String(absolute % 100).padStart(2, '0');
  return (cents < 0 ? '-' : '') + String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction;
}

function formatDate(value) {
  var date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '时间待同步';
  function two(part) {
    return String(part).padStart(2, '0');
  }
  return date.getFullYear() + '-' + two(date.getMonth() + 1) + '-' + two(date.getDate()) + ' ' + two(date.getHours()) + ':' + two(date.getMinutes());
}

function statusMeta(status) {
  var map = {
    pending_payment: { label: '待付款', tone: 'warning', note: '完成支付后进入履约' },
    paid: { label: '待发货', tone: 'brand', note: '支付已确认，等待履约' },
    processing: { label: '待发货', tone: 'brand', note: '商家正在处理订单' },
    pending_shipment: { label: '待发货', tone: 'brand', note: '等待商家发货' },
    shipped: { label: '待收货', tone: 'brand', note: '商品已发出' },
    pending_receipt: { label: '待收货', tone: 'brand', note: '商品已发出' },
    completed: { label: '已完成', tone: 'success', note: '订单已完成' },
    cancelled: { label: '已取消', tone: 'muted', note: '订单已取消' },
    refund_pending: { label: '退款中', tone: 'warning', note: '退款正在处理' },
    refunded: { label: '已退款', tone: 'muted', note: '退款已完成' },
  };
  return map[status] || { label: '状态同步中', tone: 'muted', note: '以后端订单状态为准' };
}

function normalizeOrder(row) {
  var source = row || {};
  var items = Array.isArray(source.items) ? source.items : [];
  var first = items[0] || {};
  var quantity = items.reduce(function (sum, item) {
    return sum + Math.max(0, Number(item.quantity) || 0);
  }, 0);
  var status = typeof source.status === 'string' ? source.status : 'unknown';
  var meta = statusMeta(status);
  var amountCents = status === 'pending_payment' ? source.payableCents : source.paidCents;
  if (!Number.isFinite(centsValue(amountCents))) {
    amountCents = Number.isFinite(centsValue(source.payableCents)) ? source.payableCents : source.goodsAmountCents;
  }
  return {
    id: typeof source.id === 'string' ? source.id : '',
    orderNo: api.normalizeOrderNo(source.orderNo) || '',
    status: status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    statusNote: meta.note,
    createdText: formatDate(source.createdAt),
    amountLabel: status === 'pending_payment' ? '应付' : '订单金额',
    amount: formatCents(amountCents),
    sourceLabel: source.supplierName || '智慧翼订单',
    itemTitle: first.productTitle || first.name || (items.length ? '订单商品' : '商品明细请打开查看'),
    itemQuantity: quantity,
    itemSummary: items.length > 1 ? '等 ' + items.length + ' 种商品' : '',
    coverUrl: first.productImage || first.image || '',
    actionLabel: status === 'pending_payment' ? '去付款' : '查看详情',
  };
}

function matchesFilter(order, key) {
  if (key === 'all') return true;
  if (key === 'pending_shipment') return ['paid', 'processing', 'pending_shipment'].indexOf(order.status) >= 0;
  if (key === 'pending_receipt') return ['shipped', 'pending_receipt'].indexOf(order.status) >= 0;
  return order.status === key;
}

function errorView(error) {
  var code = error && error.code;
  if (code === 'WECHAT_BINDING_REQUIRED') {
    return { kind: 'binding', title: '先绑定智慧翼会员', message: '微信身份尚未关联现有会员。绑定只建立登录别名，不会创建第二份余额或订单。', retryable: false };
  }
  if (code === 'REQUEST_TIMEOUT') return { kind: 'timeout', title: '订单加载超时', message: error.message, retryable: true };
  if (code === 'NETWORK_ERROR') return { kind: 'offline', title: '网络连接失败', message: error.message, retryable: true };
  if (code === 'FORBIDDEN' || code === 'CATALOG_FORBIDDEN') return { kind: 'forbidden', title: '暂时无法查看订单', message: error.message, retryable: false };
  return { kind: 'error', title: '订单加载失败', message: (error && error.message) || '服务暂时不可用，请稍后重试', retryable: true };
}

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    sizeClass: '',
    sizeStyle: '',
    filters: FILTERS,
    activeFilter: 'all',
    searchOpen: false,
    searchKeyword: '',
    loading: true,
    refreshing: false,
    error: null,
    orders: [],
    displayOrders: [],
    bindingRequired: false,
    bindingUsername: '',
    bindingPassword: '',
    bindingBusy: false,
    bindingError: '',
  },

  onLoad: function () {
    var area = app.getSafeArea();
    var size = app.getSizeClass();
    this._orders = [];
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
    this.loadOrders(false);
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 3 });
    if (this._hasShownOnce && this._loadedAt && !this.data.loading) this.loadOrders(true);
    this._hasShownOnce = true;
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onPullDownRefresh: function () {
    this.loadOrders(true);
  },

  onUnload: function () {
    if (this._ordersRequest && typeof this._ordersRequest.abort === 'function') this._ordersRequest.abort();
    this.data.bindingPassword = '';
  },

  loadOrders: function (refreshing) {
    var self = this;
    if (this._ordersRequest && typeof this._ordersRequest.abort === 'function') this._ordersRequest.abort();
    this.setData({
      loading: !refreshing || !this._orders.length,
      refreshing: Boolean(refreshing),
      error: null,
      bindingRequired: false,
      bindingError: '',
    });
    this._ordersRequest = api.listOrders();
    return this._ordersRequest.then(
      function (response) {
        if (!response || !Array.isArray(response.items)) throw { code: 'INVALID_ORDERS_RESPONSE', message: '订单列表返回格式异常' };
        self._orders = response.items.map(normalizeOrder).filter(function (order) {
          return Boolean(order.id && order.orderNo);
        });
        self._loadedAt = Date.now();
        self.applyFilter(self.data.activeFilter);
        self.setData({ loading: false, refreshing: false, error: null });
        wx.stopPullDownRefresh();
      },
      function (error) {
        if (error && error.code === 'REQUEST_ABORTED') return;
        var view = errorView(error);
        self._bindingChallenge = view.kind === 'binding' ? error.bindingChallenge || '' : '';
        self.setData({
          loading: false,
          refreshing: false,
          error: view,
          bindingRequired: view.kind === 'binding',
          bindingPassword: '',
        });
        wx.stopPullDownRefresh();
      }
    );
  },

  applyFilter: function (key) {
    var active = FILTERS.some(function (filter) {
      return filter.key === key;
    })
      ? key
      : 'all';
    var keyword = this.data.searchKeyword.toLowerCase();
    this.setData({
      activeFilter: active,
      orders: this._orders,
      displayOrders: this._orders.filter(function (order) {
        if (!matchesFilter(order, active)) return false;
        if (!keyword) return true;
        return [order.orderNo, order.itemTitle, order.sourceLabel].join(' ').toLowerCase().indexOf(keyword) >= 0;
      }),
    });
  },

  onSelectFilter: function (event) {
    this.applyFilter(event.currentTarget.dataset.key);
  },

  onRetry: function () {
    this.loadOrders(false);
  },

  onToggleSearch: function () {
    var self = this;
    var next = !this.data.searchOpen;
    this.setData({ searchOpen: next, searchKeyword: next ? this.data.searchKeyword : '' }, function () {
      self.applyFilter(self.data.activeFilter);
    });
  },

  onSearchInput: function (event) {
    var self = this;
    this.setData({ searchKeyword: (event.detail.value || '').trim() }, function () {
      self.applyFilter(self.data.activeFilter);
    });
  },

  onOpenOrder: function (event) {
    var orderNo = api.normalizeOrderNo(event.currentTarget.dataset.orderNo);
    if (!orderNo) return wx.showToast({ title: '订单编号无效，请刷新后重试', icon: 'none' });
    wx.navigateTo({ url: '/pages/order-detail/order-detail?orderNo=' + encodeURIComponent(orderNo) + '&channel=orders' });
  },

  onImageError: function (event) {
    var orderId = event.currentTarget.dataset.orderId;
    this._orders = this._orders.map(function (order) {
      return order.id === orderId ? Object.assign({}, order, { coverUrl: '' }) : order;
    });
    this.applyFilter(this.data.activeFilter);
  },

  onBindingUsernameInput: function (event) {
    this.setData({ bindingUsername: (event.detail.value || '').trim(), bindingError: '' });
  },

  onBindingPasswordInput: function (event) {
    this.setData({ bindingPassword: event.detail.value || '', bindingError: '' });
  },

  onBindMember: function () {
    var self = this;
    var username = this.data.bindingUsername;
    var password = this.data.bindingPassword;
    if (this.data.bindingBusy) return;
    if (!this._bindingChallenge) return this.loadOrders(false);
    if (!username || !password) return this.setData({ bindingError: '请输入现有智慧翼账号和密码' });
    this.setData({ bindingBusy: true, bindingError: '' });
    api.bindWechatMember({ bindingChallenge: this._bindingChallenge, username: username, password: password }).then(
      function () {
        self._bindingChallenge = '';
        self.setData({ bindingBusy: false, bindingRequired: false, bindingUsername: '', bindingPassword: '' });
        self.loadOrders(false);
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
});
