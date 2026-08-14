var api = require('../../utils/api');
var accountPresentation = require('../../utils/accountPresentation');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();

/** Cents to a grouped decimal string. Money maths never happens in WXML. */
function formatCents(cents) {
  if (!Number.isFinite(Number(cents))) return '—';
  var value = Number(cents);
  var yuan = Math.floor(Math.abs(value) / 100);
  var fraction = String(Math.abs(value) % 100).padStart(2, '0');
  return String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction;
}

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    sizeClass: '',
    sizeStyle: '',
    loading: true,
    loadError: null,

    signedIn: false,
    member: null,
    welfare: '—',
    meal: '—',
    voucherCount: null,
    points: null,

    orderShortcuts: [
      { key: 'unpaid', label: '待付款', icon: 'credit-card' },
      { key: 'shipping', label: '待收货', icon: 'gift' },
      { key: 'aftersale', label: '售后', icon: 'headphones' },
      { key: 'all', label: '全部订单', icon: 'file-text' },
    ],
  },

  onLoad: function () {
    var area = app.getSafeArea();
    var size = app.getSizeClass();
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
    this.loadProfile();
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
  },

  /**
   * Balances are the one thing this page must never guess. If the request
   * fails the page shows an error and zeroes, it does not fall back to a
   * seed figure that would read as the member's own money.
   */
  loadProfile: function () {
    var self = this;
    this.setData({ loading: true, loadError: null });

    api
      .getHomeSnapshot()
      .then(function (home) {
        var member = accountPresentation.memberSummary(home);
        if (!member.memberName && !member.employeeNo) throw { code: 'INVALID_PROFILE_RESPONSE', message: '会员资料返回格式异常' };
        self.setData({
          loading: false,
          signedIn: true,
          member: member,
          welfare: formatCents(member.welfareCents),
          meal: formatCents(member.mealCents),
          voucherCount: null,
          points: null,
        });
      })
      .catch(function (error) {
        var code = error && error.code;
        if (code === 'AUTH_REQUIRED' || code === 'AUTH_CHANNEL_PENDING') {
          self.setData({ loading: false, signedIn: false, member: null, loadError: null });
          return;
        }
        self.setData({
          loading: false,
          signedIn: false,
          member: null,
          loadError: (error && error.message) || '账户信息加载失败，请重试',
        });
      });
  },

  onOpenMemberCode: function () {
    wx.switchTab({ url: '/pages/membercode/membercode' });
  },

  onOpenOrders: function () {
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  onRetry: function () {
    this.loadProfile();
  },

  onPending: function (event) {
    wx.showToast({
      title: (event.currentTarget.dataset.label || '该功能') + '将在服务端接口接通后启用',
      icon: 'none',
    });
  },
});
