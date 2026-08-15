var api = require('../../utils/api');
var accountPresentation = require('../../utils/accountPresentation');
var sizeClassUtil = require('../../utils/sizeClass');
var share = require('../../utils/share');

var app = getApp();

var HOME_CATEGORIES = [
  { key: 'food', title: '商超到家', desc: '食品饮料与日用好物', icon: 'shopping-basket' },
  { key: 'appliance', title: '家用电器', desc: '家庭电器与品质生活', icon: 'package' },
  { key: 'digital', title: '数码办公', desc: '办公设备与数码产品', icon: 'laptop' },
  { key: 'home', title: '家居日用', desc: '家居用品与收纳清洁', icon: 'store' },
];

var MEMBER_CODE_CTA = {
  title: '到店出示会员码',
  desc: '登录并完成手机认证后使用',
};

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
    signedIn: false,

    scope: {},
    quotaLabel: '',
    quotaAmount: '',
    quotaPendingText: '',
    identityNotice: '',
    identityNoticeTone: 'info',
    cartCount: 0,
    segments: HOME_CATEGORIES,
    memberCodeCta: MEMBER_CODE_CTA,
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
    var member = home && !home.memberError ? accountPresentation.memberSummary(home) : null;
    var signedIn = Boolean(member && (member.memberName || member.employeeNo));
    var welfareCents = member && Number.isFinite(member.welfareCents) ? member.welfareCents : null;
    var memberError = home && home.memberError;
    this.setData({
      loading: false,
      loadError: null,
      signedIn: signedIn,
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
      segments: HOME_CATEGORIES,
      memberCodeCta: MEMBER_CODE_CTA,
      recommendations: decorateProducts(products.slice(0, 6)),
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

  onOpenCart: function () {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  onOpenSearch: function () {
    wx.navigateTo({ url: '/pages/products/products?title=' + encodeURIComponent('搜索商品') + '&focus=1' });
  },

  onOpenProfile: function () {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  onOpenSegment: function (event) {
    var segment = event.currentTarget.dataset.item;
    if (!segment || !segment.key) return;
    wx.navigateTo({
      url: '/pages/products/products?title=' + encodeURIComponent(segment.title) + '&category=' + encodeURIComponent(segment.key),
    });
  },

  onOpenAllProducts: function () {
    wx.navigateTo({ url: '/pages/products/products?title=' + encodeURIComponent('全部公开商品') });
  },

  onOpenRecommendation: function (event) {
    var index = Number(event.currentTarget.dataset.index);
    var product = this.data.recommendations[index];
    if (!product || !product.id) return;
    wx.setStorageSync('sw-public-product-' + product.id, product);
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + encodeURIComponent(product.id) });
  },

  onRecommendationImageError: function (event) {
    var index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.recommendations[index]) return;
    this.setData({ ['recommendations[' + index + '].image']: null });
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
