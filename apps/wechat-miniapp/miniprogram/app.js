var safeArea = require('./utils/safeArea');
var sizeClass = require('./utils/sizeClass');
var demo = require('./data/demo');
var api = require('./utils/api');

App({
  globalData: {
    safeArea: null,
    sizeClass: null,
    /** True while no real API is wired. Pages must surface this, not hide it. */
    isDemo: demo.IS_DEMO,
    cartCount: demo.cartCount,
  },

  onLaunch: function () {
    this.globalData.safeArea = safeArea.readSafeArea(true);
    this.globalData.sizeClass = sizeClass.resolveSizeClass(true);
    api.prefetchPublicCatalog();
    setTimeout(function () {
      api.prefetchAccountData();
    }, 800);
  },

  onShow: function () {
    // Capsule geometry can change when the mini program is reopened from a
    // different entry, so refresh rather than trusting the launch value.
    this.globalData.safeArea = safeArea.readSafeArea(true);
  },

  /** Page roots apply this class so the size-class tokens take effect. */
  getSizeClass: function (force) {
    if (force || !this.globalData.sizeClass) this.globalData.sizeClass = sizeClass.resolveSizeClass(true);
    return this.globalData.sizeClass;
  },

  getSafeArea: function () {
    if (!this.globalData.safeArea) this.globalData.safeArea = safeArea.readSafeArea(true);
    return this.globalData.safeArea;
  },

  getCartCount: function () {
    return this.globalData.cartCount;
  },

  onError: function (error) {
    console.error('[app] runtime error', error);
  },

  onUnhandledRejection: function (event) {
    // API_NOT_WIRED is expected until phase 6; do not spam the console with it.
    var reason = event && event.reason;
    if (reason && reason.code === 'API_NOT_WIRED') return;
    console.error('[app] unhandled rejection', reason);
  },
});
