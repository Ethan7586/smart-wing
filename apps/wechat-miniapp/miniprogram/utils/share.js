var OFFICIAL_URL = 'https://hbbtzn.com/';

function cleanTitle(value) {
  var title = String(value || '').trim();
  return title || '智慧翼福利商城';
}

function cleanPath(value) {
  var path = String(value || '').trim();
  if (!path) return '/pages/home/home';
  return path.charAt(0) === '/' ? path : '/' + path;
}

function cleanQuery(value) {
  return String(value || '')
    .trim()
    .replace(/^\?/, '');
}

function enableMenu() {
  if (typeof wx === 'undefined' || typeof wx.showShareMenu !== 'function') return;
  wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
}

function appMessage(options) {
  var input = options || {};
  return {
    title: cleanTitle(input.title),
    path: cleanPath(input.path),
  };
}

function timeline(options) {
  var input = options || {};
  return {
    title: cleanTitle(input.title),
    query: cleanQuery(input.query),
  };
}

function copyOfficialUrl() {
  if (typeof wx === 'undefined' || typeof wx.setClipboardData !== 'function') return false;
  wx.setClipboardData({
    data: OFFICIAL_URL,
    fail: function () {
      if (typeof wx.showToast === 'function') wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' });
    },
  });
  return true;
}

module.exports = {
  OFFICIAL_URL: OFFICIAL_URL,
  enableMenu: enableMenu,
  appMessage: appMessage,
  timeline: timeline,
  copyOfficialUrl: copyOfficialUrl,
};
