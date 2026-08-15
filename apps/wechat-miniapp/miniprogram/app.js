var safeArea = require('./utils/safeArea');
var sizeClass = require('./utils/sizeClass');
var demo = require('./data/demo');
var api = require('./utils/api');

var SILENT_SESSION_RETRY_INTERVAL_MS = 30000;

App({
  globalData: {
    safeArea: null,
    sizeClass: null,
    /** True while no real API is wired. Pages must surface this, not hide it. */
    isDemo: demo.IS_DEMO,
    cartCount: demo.cartCount,
    silentSession: {
      status: 'idle',
      lastAttemptAt: 0,
      errorCode: '',
      promise: null,
    },
  },

  onLaunch: function () {
    this.globalData.safeArea = safeArea.readSafeArea(true);
    this.globalData.sizeClass = sizeClass.resolveSizeClass(true);
    this.ensureSilentSession(false);
  },

  onShow: function () {
    // Capsule geometry can change when the mini program is reopened from a
    // different entry, so refresh rather than trusting the launch value.
    this.globalData.safeArea = safeArea.readSafeArea(true);
    this.ensureSilentSession(false);
  },

  /**
   * Start first-party WeChat enrollment in the background. Public catalog
   * rendering never waits for this promise; protected pages can reuse the
   * same single-flight request through utils/api.
   */
  ensureSilentSession: function (force) {
    var state = this.globalData.silentSession;
    var now = Date.now();
    if (state.promise) return state.promise;
    if (!force && state.status === 'failed' && now - state.lastAttemptAt < SILENT_SESSION_RETRY_INTERVAL_MS) {
      return Promise.resolve(null);
    }
    state.status = 'loading';
    state.lastAttemptAt = now;
    state.errorCode = '';
    state.promise = api.ensureWechatSession({ force: Boolean(force) }).then(
      function (response) {
        state.status = 'ready';
        state.promise = null;
        return response;
      },
      function (error) {
        state.status = 'failed';
        state.errorCode = (error && error.code) || 'WECHAT_SESSION_FAILED';
        state.promise = null;
        return null;
      }
    );
    return state.promise;
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
