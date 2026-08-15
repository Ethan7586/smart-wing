var api = require('../../utils/api');
var sizeClassUtil = require('../../utils/sizeClass');
var app = getApp();

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    sizeClass: '',
    sizeStyle: '',
    mode: 'register',
    preparing: true,
    ready: false,
    busy: false,
    error: '',
    username: '',
    password: '',
    displayName: '',
    inviteCode: '',
    acceptedTerms: false,
  },

  onLoad: function (options) {
    var area = app.getSafeArea();
    var size = app.getSizeClass();
    this.setData({
      mode: options && options.mode === 'bind' ? 'bind' : 'register',
      sizeClass: size.className,
      sizeStyle: size.rootStyle,
      nav: {
        statusBarHeight: area.statusBarHeight,
        navContentHeight: area.navContentHeight,
        navTotalHeight: area.navTotalHeight,
        rightInset: area.rightInset,
      },
    });
    this.prepareWechatIdentity();
  },

  onUnload: function () {
    this.data.password = '';
    this._bindingChallenge = '';
  },

  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  prepareWechatIdentity: function () {
    var self = this;
    this._bindingChallenge = '';
    this.setData({ preparing: true, ready: false, error: '' });
    api.createWechatSession().then(
      function () {
        wx.switchTab({ url: '/pages/profile/profile' });
      },
      function (error) {
        if (error && error.code === 'WECHAT_BINDING_REQUIRED' && error.bindingChallenge) {
          self._bindingChallenge = error.bindingChallenge;
          self.setData({ preparing: false, ready: true, error: '' });
          return;
        }
        self.setData({ preparing: false, ready: false, error: (error && error.message) || '微信身份确认失败，请重试' });
      }
    );
  },

  onBack: function () {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/profile/profile' });
  },

  onSwitchMode: function (event) {
    if (this.data.busy) return;
    this.setData({ mode: event.currentTarget.dataset.mode === 'bind' ? 'bind' : 'register', password: '', error: '' });
  },

  onInput: function (event) {
    var field = event.currentTarget.dataset.field;
    if (['username', 'password', 'displayName', 'inviteCode'].indexOf(field) < 0) return;
    var update = { error: '' };
    update[field] = event.detail.value || '';
    this.setData(update);
  },

  onToggleTerms: function () {
    this.setData({ acceptedTerms: !this.data.acceptedTerms, error: '' });
  },

  onSubmit: function () {
    if (this.data.busy || !this.data.ready) return;
    if (!this._bindingChallenge) return this.prepareWechatIdentity();
    var self = this;
    var input = {
      bindingChallenge: this._bindingChallenge,
      username: this.data.username.trim(),
      password: this.data.password,
    };
    var action;
    if (this.data.mode === 'register') {
      input.displayName = this.data.displayName.trim();
      input.inviteCode = this.data.inviteCode.trim();
      input.acceptedTerms = this.data.acceptedTerms;
      action = api.registerWechatMember(input);
    } else {
      action = api.bindWechatMember(input);
    }
    this.setData({ busy: true, error: '' });
    action.then(
      function () {
        self._bindingChallenge = '';
        self.setData({ busy: false, password: '' });
        wx.showToast({ title: self.data.mode === 'register' ? '注册成功' : '绑定成功', icon: 'success' });
        setTimeout(function () {
          wx.switchTab({ url: '/pages/profile/profile' });
        }, 400);
      },
      function (error) {
        var expired = error && error.code === 'WECHAT_BINDING_EXPIRED';
        self.setData({ busy: false, password: '', error: (error && error.message) || '操作失败，请稍后重试' });
        if (expired) self.prepareWechatIdentity();
      }
    );
  },
});
