var demo = require('../../data/demo');
var api = require('../../utils/api');
var accountPresentation = require('../../utils/accountPresentation');
var catalogPolicy = require('../../utils/catalogPolicy');
var sizeClassUtil = require('../../utils/sizeClass');
var share = require('../../utils/share');

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

function afterFirstPaint(callback) {
  if (typeof wx.nextTick === 'function') wx.nextTick(callback);
  else setTimeout(callback, 0);
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
    share.enableMenu();
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
    var cachedCatalog = api.readCachedProducts();
    var cachedHome = api.readCachedHomeSnapshot();
    if (cachedCatalog) this.applySnapshot(cachedHome && cachedHome.data, cachedCatalog.items);
    else this.setData({ loading: true, loadError: null });

    afterFirstPaint(function () {
      self.refreshHome(cachedHome, cachedCatalog);
    });
    return Promise.resolve(true);
  },

  refreshHome: function (cachedHome, cachedCatalog) {
    var self = this;
    var catalogRequest = Promise.resolve(cachedCatalog);
    if (!cachedCatalog || !cachedCatalog.cache.complete) catalogRequest = api.hydrateBundledCatalog();
    catalogRequest = catalogRequest.then(function (localCatalog) {
      if (!localCatalog || (localCatalog.cache && localCatalog.cache.stale)) {
        return api.listProducts({ cursor: 0, limit: 200 });
      }
      return localCatalog;
    });
    var needsMember = !cachedHome || cachedHome.stale;
    var memberRequest = needsMember ? api.getHomeSnapshot() : Promise.resolve(null);
    return Promise.all([
      catalogRequest.catch(function (error) {
        return { catalogError: error };
      }),
      memberRequest.catch(function (error) {
        return { memberError: error };
      }),
    ])
      .then(function (results) {
        var catalogResult = results[0];
        var memberResult = results[1];
        var products = catalogResult && Array.isArray(catalogResult.items) ? catalogResult.items : cachedCatalog && cachedCatalog.items;
        if (!products) throw (catalogResult && catalogResult.catalogError) || new Error('公开商品目录返回格式异常');
        var member = memberResult && !memberResult.memberError ? memberResult : cachedHome && cachedHome.data;
        if (!member && memberResult && memberResult.memberError) member = { memberError: memberResult.memberError };
        self.applySnapshot(member, products);
      })
      .catch(function (error) {
        if (cachedCatalog) return;
        self.setData({
          loading: false,
          loadError: (error && error.message) || '福利数据加载失败，请重试',
        });
      });
  },

  applySnapshot: function (home, products) {
    var visibleProducts = catalogPolicy.filterProducts(products);
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
      segments: demo.segments.filter(catalogPolicy.isHomeSegmentVisible),
      memberCodeCta: demo.memberCodeCta,
      recommendations: decorateProducts(visibleProducts.slice(0, 2)),
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

  onOpenCart: function () {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  onOpenMemberCode: function () {
    wx.switchTab({ url: '/pages/membercode/membercode' });
  },

  onShareAppMessage: function () {
    return share.appMessage({ title: '智慧翼福利商城', path: '/pages/home/home' });
  },

  onShareTimeline: function () {
    return share.timeline({ title: '智慧翼福利商城' });
  },
});
