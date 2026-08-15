var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();

var STATES = {
  ready: { key: 'ready', icon: 'i-shield-check-success', tone: 'ok', title: '会员身份正常', desc: '会员码须由服务端签发后才能用于门店核验' },
  unverified: { key: 'unverified', icon: 'i-shield-alert-danger', tone: 'warn', title: '手机未认证', desc: '完成短信验证后才能核验权益' },
  frozen: { key: 'frozen', icon: 'i-snowflake-danger', tone: 'danger', title: '账号已冻结', desc: '请联系企业管理员或客服处理' },
  disabled: { key: 'disabled', icon: 'i-lock-danger', tone: 'danger', title: '会员关系已停用', desc: '当前身份不能用于门店核验' },
};

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    sizeClass: '',
    sizeStyle: '',
    loading: true,
    loadError: null,
    signedIn: false,
    card: null,
    state: STATES.unverified,
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
    this.loadCard();
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    if (this._hasShownOnce) this.loadCard(true);
    this._hasShownOnce = true;
  },

  loadCard: function (refreshing) {
    var self = this;
    this.setData({ loading: !refreshing, loadError: null });
    api
      .getMemberCard()
      .then(function (card) {
        self.applyCard(card);
      })
      .catch(function (error) {
        var code = error && error.code;
        if (code === 'AUTH_REQUIRED' || code === 'AUTH_CHANNEL_PENDING' || code === 'WECHAT_BINDING_REQUIRED') {
          self.setData({ loading: false, signedIn: false, card: null, loadError: null });
          return;
        }
        self.setData({ loading: false, signedIn: false, card: null, loadError: (error && error.message) || '会员身份加载失败，请重试' });
      });
  },

  applyCard: function (card) {
    var state = STATES.ready;
    if (card && card.status === 'frozen') state = STATES.frozen;
    else if (card && card.status === 'disabled') state = STATES.disabled;
    else if (!card || card.phoneVerified === false) state = STATES.unverified;
    this.setData({ loading: false, loadError: null, signedIn: Boolean(card), card: card, state: state });
  },

  onOpenAuth: function () {
    wx.navigateTo({ url: '/pages/auth/auth' });
  },

  onVerifyPhone: function () {
    wx.navigateTo({ url: '/pages/phone-verification/phone-verification' });
  },

  onRetry: function () {
    this.loadCard();
  },
});
