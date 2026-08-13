var demo = require('../../data/demo');
var api = require('../../utils/api');

var app = getApp();

/** Cents to a grouped decimal string. Money maths never happens in WXML. */
function formatCents(cents) {
  var yuan = Math.floor(Math.abs(cents) / 100);
  var fraction = String(Math.abs(cents) % 100).padStart(2, '0');
  var grouped = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (cents < 0 ? '-' : '') + grouped + '.' + fraction;
}

function decorateProducts(list) {
  return list.map(function (item) {
    return Object.assign({}, item, {
      price: formatCents(item.priceCents),
      marketPrice: item.marketPriceCents ? formatCents(item.marketPriceCents) : '',
    });
  });
}

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    loading: true,
    loadError: null,
    isDemo: false,

    scope: {},
    quotaLabel: '',
    quotaAmount: '',
    phoneVerified: true,
    phoneNotice: '',
    cartCount: 0,
    entries: [],
    hero: {},
    partners: [],
    segments: [],
    memberCodeCta: {},
    recommendations: [],
  },

  onLoad: function () {
    var area = app.getSafeArea();
    this.setData({
      nav: {
        statusBarHeight: area.statusBarHeight,
        navContentHeight: area.navContentHeight,
        navTotalHeight: area.navTotalHeight,
        rightInset: area.rightInset,
      },
    });
    this.loadHome();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  /**
   * Real data first. Only if the API layer is not wired at all do we fall back
   * to the seed set, and that fallback is announced on screen. A wired API that
   * *fails* must surface an error state — it must never silently show demo
   * numbers as if they were the member's own balance.
   */
  loadHome: function () {
    var self = this;
    this.setData({ loading: true, loadError: null });

    if (!api.isWired()) {
      this.applySnapshot(demo, true);
      return;
    }

    api
      .getHomeSnapshot()
      .then(function (snapshot) {
        self.applySnapshot(snapshot, false);
      })
      .catch(function (error) {
        self.setData({
          loading: false,
          loadError: (error && error.message) || '福利数据加载失败，请重试',
        });
      });
  },

  applySnapshot: function (snapshot, isDemo) {
    this.setData({
      loading: false,
      loadError: null,
      isDemo: isDemo,
      scope: snapshot.scope,
      quotaLabel: snapshot.assets.monthlyQuotaLabel,
      quotaAmount: formatCents(snapshot.assets.monthlyQuotaCents),
      phoneVerified: snapshot.assets.phoneVerified,
      phoneNotice: snapshot.assets.phoneNotice,
      cartCount: snapshot.cartCount,
      entries: snapshot.entries,
      hero: snapshot.hero,
      partners: snapshot.partners,
      segments: snapshot.segments,
      memberCodeCta: snapshot.memberCodeCta,
      recommendations: decorateProducts(snapshot.recommendations),
    });
  },

  onRetry: function () {
    this.loadHome();
  },

  // Phase 2 wires these. Announcing "not built" beats a dead tap.
  onPending: function (event) {
    wx.showToast({
      title: (event.currentTarget.dataset.label || '该功能') + '将在后续阶段实现',
      icon: 'none',
    });
  },

  onOpenMemberCode: function () {
    wx.switchTab({ url: '/pages/membercode/membercode' });
  },
});
