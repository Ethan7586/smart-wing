var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');
var app = getApp();

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    sizeClass: '',
    sizeStyle: '',
    mobile: '',
    code: '',
    currentPassword: '',
    challengeId: '',
    sending: false,
    submitting: false,
    countdown: 0,
    error: '',
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
  },

  onUnload: function () {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    this.data.currentPassword = '';
    this.data.code = '';
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onBack: function () {
    wx.navigateBack();
  },

  onInput: function (event) {
    var field = event.currentTarget.dataset.field;
    if (['mobile', 'code', 'currentPassword'].indexOf(field) < 0) return;
    var update = { error: '' };
    update[field] = event.detail.value || '';
    this.setData(update);
  },

  onSendCode: function () {
    if (this.data.sending || this.data.countdown > 0) return;
    var mobile = this.data.mobile.trim();
    if (!/^1[3-9]\d{9}$/.test(mobile)) return this.setData({ error: '请输入正确的11位手机号码' });
    var self = this;
    this.setData({ sending: true, error: '' });
    api.requestPhoneVerification(mobile).then(
      function (result) {
        self.setData({ sending: false, challengeId: result.challengeId || '', countdown: Number(result.resendAfterSeconds) || 60 });
        self.startCountdown();
        wx.showToast({ title: '验证码已发送', icon: 'success' });
      },
      function (error) {
        self.setData({ sending: false, error: (error && error.message) || '验证码发送失败，请稍后重试' });
      }
    );
  },

  startCountdown: function () {
    var self = this;
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    this._countdownTimer = setInterval(function () {
      var next = Math.max(0, self.data.countdown - 1);
      self.setData({ countdown: next });
      if (!next) {
        clearInterval(self._countdownTimer);
        self._countdownTimer = null;
      }
    }, 1000);
  },

  onSubmit: function () {
    if (this.data.submitting) return;
    if (!this.data.challengeId) return this.setData({ error: '请先获取短信验证码' });
    var self = this;
    this.setData({ submitting: true, error: '' });
    api
      .verifyPhone({
        mobile: this.data.mobile.trim(),
        challengeId: this.data.challengeId,
        code: this.data.code.trim(),
        currentPassword: this.data.currentPassword,
      })
      .then(
        function () {
          self.setData({ submitting: false, code: '', currentPassword: '' });
          var pages = getCurrentPages();
          var previous = pages[pages.length - 2];
          if (previous && previous.route === 'pages/profile/profile') previous._loadedAt = 0;
          wx.showToast({ title: '手机认证完成', icon: 'success' });
          setTimeout(function () {
            wx.navigateBack();
          }, 400);
        },
        function (error) {
          self.setData({ submitting: false, code: '', currentPassword: '', error: (error && error.message) || '手机认证失败，请重试' });
        }
      );
  },
});
