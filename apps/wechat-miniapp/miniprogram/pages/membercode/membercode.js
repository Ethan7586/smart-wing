var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();

/**
 * The five states 会员码主方案 §6 requires. Each carries an icon, a colour and
 * words — VI 4.2 forbids colour as the only signal, and a frozen member must
 * understand why the code stopped working.
 */
var STATES = {
  ready: { key: 'ready', icon: 'i-shield-check-success', tone: 'ok', title: '会员码正常', desc: '可在合作门店出示核验' },
  unverified: { key: 'unverified', icon: 'i-shield-alert-danger', tone: 'warn', title: '手机未认证', desc: '完成短信验证后才能核验权益' },
  frozen: { key: 'frozen', icon: 'i-snowflake-danger', tone: 'danger', title: '账号已冻结', desc: '请联系企业管理员或客服处理' },
  disabled: { key: 'disabled', icon: 'i-lock-danger', tone: 'danger', title: '会员码已停用', desc: '会员关系已停用或离职，核验被拒绝' },
  failed: { key: 'failed', icon: 'i-circle-alert-danger', tone: 'danger', title: '核验失败', desc: '凭证已失效，请刷新后重试' },
};

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    sizeClass: '',
    sizeStyle: '',
    loading: true,
    loadError: null,

    card: null,
    state: STATES.ready,
    /** Countdown seconds. Comes from tokens.json wingCode.validSeconds. */
    seconds: 45,
    /**
     * True while the code on screen is a local placeholder rather than a
     * server-issued challenge. 会员码主方案 §6 forbids passing a static image
     * off as a live code, so the page says so instead of hiding it.
     */
    simulated: true,
    challenge: '',
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
    this.startTicking();
  },

  /** A code left running in the background is a code someone screenshotted. */
  onHide: function () {
    this.stopTicking();
  },

  onUnload: function () {
    this.stopTicking();
  },

  loadCard: function () {
    var self = this;
    this.setData({ loading: true, loadError: null });

    if (!api.isWired()) {
      this.applyCard(null);
      return;
    }

    api
      .getMemberCard()
      .then(function (card) {
        self.applyCard(card);
      })
      .catch(function (error) {
        // A missing endpoint is not the same as a broken one. Either way the
        // card must not invent a membership.
        self.setData({
          loading: false,
          card: null,
          loadError: (error && error.message) || '会员卡加载失败，请重试',
        });
      });
  },

  applyCard: function (card) {
    // No card means no verified identity, so the code cannot be "ready" — the
    // card header already says 手机未认证 and the status band must agree with it.
    var state = STATES.unverified;
    if (card && card.status === 'frozen') state = STATES.frozen;
    else if (card && card.status === 'disabled') state = STATES.disabled;
    else if (card && card.phoneVerified === false) state = STATES.unverified;
    else if (card) state = STATES.ready;

    this.setData({
      loading: false,
      loadError: null,
      card: card,
      state: state,
      simulated: true,
    });
    this.refreshChallenge();
  },

  /**
   * The real contract is POST /api/v1/member-code/challenge, which returns a
   * short-lived opaque credential. It does not exist server-side yet, so the
   * page renders a clearly-labelled placeholder and keeps the refresh cycle
   * so the wiring is a one-line change later.
   */
  refreshChallenge: function () {
    var self = this;
    if (!api.isWired()) {
      this.setData({ challenge: '', simulated: true, seconds: 45 });
      return;
    }
    api
      .createMemberCodeChallenge()
      .then(function (result) {
        self.setData({
          challenge: (result && result.credential) || '',
          simulated: false,
          seconds: (result && result.validSeconds) || 45,
        });
      })
      .catch(function () {
        self.setData({ challenge: '', simulated: true, seconds: 45 });
      });
  },

  startTicking: function () {
    var self = this;
    this.stopTicking();
    this._timer = setInterval(function () {
      var next = self.data.seconds - 1;
      if (next <= 0) {
        self.refreshChallenge();
        self.setData({ seconds: 45 });
        return;
      }
      self.setData({ seconds: next });
    }, 1000);
  },

  stopTicking: function () {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  onRefresh: function () {
    this.refreshChallenge();
    this.setData({ seconds: 45 });
    wx.showToast({ title: '会员码已刷新', icon: 'none' });
  },

  onBrighten: function () {
    wx.setScreenBrightness({ value: 1 });
    wx.showToast({ title: '已调亮屏幕', icon: 'none' });
  },

  onRetry: function () {
    this.loadCard();
  },

  onPending: function (event) {
    wx.showToast({
      title: (event.currentTarget.dataset.label || '该功能') + '将在服务端接口接通后启用',
      icon: 'none',
    });
  },
});
