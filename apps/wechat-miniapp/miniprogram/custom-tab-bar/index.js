var safeArea = require('../utils/safeArea');

Component({
  data: {
    selected: 0,
    safeBottom: 0,
    // Order is frozen by 冻结决议 8. Member code is always centre and never
    // replaced by an avatar, a publish button or a plain scanner.
    tabs: [
      { key: 'home', path: '/pages/home/home', icon: 'house', label: '首页' },
      { key: 'category', path: '/pages/category/category', icon: 'layout-grid', label: '分类' },
      { key: 'membercode', path: '/pages/membercode/membercode', label: '会员码', center: true },
      { key: 'orders', path: '/pages/orders/orders', icon: 'receipt-text', label: '订单' },
      { key: 'profile', path: '/pages/profile/profile', icon: 'user', label: '我的' },
    ],
  },

  lifetimes: {
    attached: function () {
      this.setData({ safeBottom: safeArea.readSafeArea().safeAreaBottom });
    },
  },

  methods: {
    onTap: function (event) {
      var index = event.currentTarget.dataset.index;
      var target = this.data.tabs[index];
      if (!target || index === this.data.selected) return;
      wx.switchTab({ url: target.path });
    },
  },
});
