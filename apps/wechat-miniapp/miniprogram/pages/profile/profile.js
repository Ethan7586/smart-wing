var app = getApp();

Page({
  data: { navTotalHeight: 0 },

  onLoad: function () {
    this.setData({ navTotalHeight: app.getSafeArea().navTotalHeight });
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
  },
});
