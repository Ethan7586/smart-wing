var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();
var STATES = {
  ready: { key: 'ready', icon: 'i-shield-check-success', tone: 'ok', title: '会员码正常', desc: '45 秒动态更新，核验后立即失效' },
  unverified: { key: 'unverified', icon: 'i-shield-alert-danger', tone: 'warn', title: '手机未认证', desc: '完成短信验证后才能核验权益' },
  frozen: { key: 'frozen', icon: 'i-snowflake-danger', tone: 'danger', title: '账号已冻结', desc: '请联系企业管理员或客服处理' },
  disabled: { key: 'disabled', icon: 'i-lock-danger', tone: 'danger', title: '会员码已停用', desc: '会员关系已停用或离职，核验被拒绝' },
  failed: { key: 'failed', icon: 'i-circle-alert-danger', tone: 'danger', title: '会员码不可用', desc: '凭证未签发，请重试' },
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
    codeStatus: 'idle',
    codeError: '',
    challengeId: '',
    expiresAt: '',
    matrix: null,
    seconds: 0,
  },

  onLoad: function () {
    var area = app.getSafeArea();
    var size = app.getSizeClass();
    this._requestVersion = 0;
    this._visible = true;
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

  onShow: function () {
    this._visible = true;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 2 });
    if (this.data.card && this.data.state.key === 'ready' && this.data.codeStatus !== 'ready') this.issueChallenge();
  },

  onHide: function () {
    this._visible = false;
    this.closeChallenge();
  },

  onUnload: function () {
    this._visible = false;
    this.closeChallenge();
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
    if (this.data.codeStatus === 'ready') this.drawMatrix(this.data.matrix);
  },

  loadCard: function () {
    var self = this;
    this.setData({ loading: true, loadError: null });
    api
      .getMemberCard()
      .then(function (card) {
        self.applyCard(card);
      })
      .catch(function (error) {
        self.setData({ loading: false, card: null, loadError: (error && error.message) || '会员卡加载失败，请重试' });
      });
  },

  applyCard: function (card) {
    var state = STATES.unverified;
    if (card && card.status === 'frozen') state = STATES.frozen;
    else if (card && card.status === 'disabled') state = STATES.disabled;
    else if (card && card.phoneVerified === false) state = STATES.unverified;
    else if (card) state = STATES.ready;
    this.setData({ loading: false, loadError: null, card: card, state: state });
    if (state.key === 'ready' && this._visible) this.issueChallenge();
  },

  issueChallenge: function () {
    var self = this;
    var version = ++this._requestVersion;
    this.stopTicking();
    this.setData({ codeStatus: 'issuing', codeError: '', challengeId: '', matrix: null, seconds: 0 });
    api
      .createMemberCodeChallenge()
      .then(function (result) {
        if (!self._visible || version !== self._requestVersion) return;
        if (!validChallenge(result)) throw { message: '会员码签发结果无效，请重试' };
        self.setData(
          {
            codeStatus: 'ready',
            challengeId: result.challengeId,
            expiresAt: result.expiresAt,
            matrix: result.matrix,
            seconds: secondsRemaining(result.expiresAt),
          },
          function () {
            self.drawMatrix(result.matrix);
            self.startTicking();
          }
        );
      })
      .catch(function (error) {
        if (!self._visible || version !== self._requestVersion) return;
        self.setData({ codeStatus: 'error', codeError: (error && error.message) || '会员码签发失败，请重试', matrix: null, seconds: 0 });
      });
  },

  drawMatrix: function (matrix) {
    var self = this;
    if (!Array.isArray(matrix) || !matrix.length) return;
    wx.nextTick(function () {
      wx.createSelectorQuery()
        .in(self)
        .select('.qr-canvas')
        .boundingClientRect(function (rect) {
          if (!rect || !rect.width || !self._visible) return;
          var context = wx.createCanvasContext('memberCodeCanvas', self);
          var quiet = 4;
          var total = matrix.length + quiet * 2;
          var cell = rect.width / total;
          context.setFillStyle('white');
          context.fillRect(0, 0, rect.width, rect.height);
          context.setFillStyle('black');
          matrix.forEach(function (row, rowIndex) {
            row.forEach(function (dark, columnIndex) {
              if (dark) context.fillRect((columnIndex + quiet) * cell, (rowIndex + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
            });
          });
          context.draw();
        })
        .exec();
    });
  },

  startTicking: function () {
    var self = this;
    this.stopTicking();
    this._timer = setInterval(function () {
      var seconds = secondsRemaining(self.data.expiresAt);
      if (seconds <= 0) {
        self.stopTicking();
        if (self._visible) self.issueChallenge();
        return;
      }
      if (seconds !== self.data.seconds) self.setData({ seconds: seconds });
    }, 250);
  },

  stopTicking: function () {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  },

  closeChallenge: function () {
    this.stopTicking();
    this._requestVersion += 1;
    var challengeId = this.data.challengeId;
    this.setData({ codeStatus: 'idle', challengeId: '', expiresAt: '', matrix: null, seconds: 0 });
    if (challengeId) api.revokeMemberCodeChallenge(challengeId).catch(function () {});
  },

  onRefresh: function () {
    this.issueChallenge();
  },

  onStopCode: function () {
    this.closeChallenge();
    this.setData({ codeStatus: 'revoked', codeError: '本次会员码已停用，点击刷新可重新签发' });
  },

  onBrighten: function () {
    wx.setScreenBrightness({ value: 1 });
    wx.showToast({ title: '已调亮屏幕', icon: 'none' });
  },

  onRetry: function () {
    if (this.data.loadError) this.loadCard();
    else this.issueChallenge();
  },

  onPending: function (event) {
    wx.showToast({ title: (event.currentTarget.dataset.label || '该功能') + '将在后续版本启用', icon: 'none' });
  },
});

function validChallenge(result) {
  return Boolean(result && result.challengeId && result.expiresAt && Array.isArray(result.matrix) && result.matrix.length > 0);
}

function secondsRemaining(expiresAt) {
  var value = Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000);
  return Number.isFinite(value) && value > 0 ? value : 0;
}
