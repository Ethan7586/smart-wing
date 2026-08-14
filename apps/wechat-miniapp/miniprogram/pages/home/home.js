var demo = require('../../data/demo');
var api = require('../../utils/api');
var accountPresentation = require('../../utils/accountPresentation');
var sizeClassUtil = require('../../utils/sizeClass');

var app = getApp();

/** Cents to a grouped decimal string. Money maths never happens in WXML. */
function formatCents(cents) {
  var yuan = Math.floor(Math.abs(cents) / 100);
  var fraction = String(Math.abs(cents) % 100).padStart(2, '0');
  var grouped = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (cents < 0 ? '-' : '') + grouped + '.' + fraction;
}

function decorateProducts(list) {
  return (Array.isArray(list) ? list : []).map(function (item) {
    var priceCents = Number(item.priceCents);
    var marketPriceCents = Number(item.marketPriceCents);
    return Object.assign({}, item, {
      skuId: item.skuId || item.id,
      title: item.title || item.name || '商品信息待同步',
      price: Number.isFinite(priceCents) && priceCents > 0 ? formatCents(priceCents) : '',
      marketPrice: Number.isFinite(marketPriceCents) && marketPriceCents > priceCents ? formatCents(marketPriceCents) : '',
      tag: item.tag || (item.isTest ? '测试目录' : '公开商品'),
      source: item.source || item.supplierName || '主商城',
      image: item.image || item.coverUrl || null,
    });
  });
}

Page({
  data: {
    nav: { statusBarHeight: 0, navContentHeight: 0, navTotalHeight: 0, rightInset: 0 },
    sizeClass: '',
    sizeStyle: '',
    scrolled: false,
    loading: true,
    loadError: null,
    isDemo: false,

    scope: {},
    quotaLabel: '',
    quotaAmount: '',
    quotaPendingText: '',
    identityNotice: '',
    identityNoticeTone: 'info',
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
    this.loadHome();
  },

  /** Tablets rotate and split-screen; a launch-time measurement goes stale. */
  onResize: function () {
    sizeClassUtil.clearSizeClassCache();
    var next = app.getSizeClass(true);
    this.setData({ sizeClass: next.className, sizeStyle: next.rootStyle });
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  loadHome: function () {
    var self = this;
    this.setData({ loading: true, loadError: null });
    var memberRequest = api.isWired()
      ? api.getHomeSnapshot().catch(function (error) {
          return { memberError: error };
        })
      : Promise.resolve(null);
    Promise.all([api.listProducts({ cursor: 0, limit: 200 }), memberRequest])
      .then(function (results) {
        var catalog = results[0];
        if (!catalog || !Array.isArray(catalog.items)) throw new Error('公开商品目录返回格式异常');
        self.applySnapshot(results[1], catalog.items);
      })
      .catch(function (error) {
        self.setData({
          loading: false,
          loadError: (error && error.message) || '福利数据加载失败，请重试',
        });
      });
  },

  applySnapshot: function (home, products) {
    var member = home && !home.memberError ? accountPresentation.memberSummary(home) : null;
    var signedIn = Boolean(member && (member.memberName || member.employeeNo));
    var welfareCents = member && Number.isFinite(member.welfareCents) ? member.welfareCents : null;
    var memberError = home && home.memberError;
    this.setData({
      loading: false,
      loadError: null,
      isDemo: false,
      scope: {
        enterpriseName: (member && (member.enterpriseName || member.mallName)) || '公开福利商城',
        departmentName: (member && member.departmentName) || '登录后识别企业福利',
      },
      quotaLabel: signedIn ? '福利卡余额' : '会员福利资产',
      quotaAmount: welfareCents === null ? '' : formatCents(welfareCents),
      quotaPendingText: signedIn ? '资产待同步' : '登录后查看',
      identityNotice: memberError ? '会员福利暂不可用，公开商品仍可浏览' : signedIn && !member.phoneVerified ? '手机未认证 · 支付与核验功能受限' : signedIn ? '会员身份与福利资产已连接' : '登录后识别福利资产与可购资格',
      identityNoticeTone: signedIn && member && !member.phoneVerified ? 'danger' : 'info',
      cartCount: 0,
      entries: demo.entries,
      hero: demo.hero,
      partners: demo.partners,
      segments: demo.segments,
      memberCodeCta: demo.memberCodeCta,
      recommendations: decorateProducts(products.slice(0, 2)),
    });
  },

  /** Hairline under the fixed bar, only once content is passing beneath it. */
  onPageScroll: function (event) {
    var scrolled = event.scrollTop > 0;
    if (scrolled !== this.data.scrolled) this.setData({ scrolled: scrolled });
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
