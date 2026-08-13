/**
 * WeChat capsule and safe-area geometry.
 *
 * The previous implementation hard-coded a top inset, which collided with the
 * notch on some devices and left a gap on others. Every value here is read from
 * the device at runtime; nothing about the navigation bar may be a constant.
 *
 * CommonJS on purpose: it is supported by every base library version.
 */

/** Only used if the WeChat APIs throw. Never the design. */
var FALLBACK = {
  statusBarHeight: 44,
  navContentHeight: 32,
  navTotalHeight: 76,
  capsuleWidth: 87,
  rightInset: 96,
  safeAreaBottom: 0,
  windowWidth: 375,
};

var cached = null;

function readSafeArea(force) {
  if (cached && !force) return cached;

  try {
    var windowInfo = wx.getWindowInfo();
    var capsule = wx.getMenuButtonBoundingClientRect();
    var statusBarHeight = windowInfo.statusBarHeight || FALLBACK.statusBarHeight;

    // The capsule sits vertically centred in the navigation content area, so the
    // gap above it equals the gap below it.
    var gap = Math.max(capsule.top - statusBarHeight, 4);
    var navContentHeight = capsule.height + gap * 2;

    // Horizontal room the capsule occupies. Mirrored on the left so a centred
    // title stays centred and right-aligned actions never slide underneath it.
    var rightInset = Math.max(windowInfo.windowWidth - capsule.left, 0) + 8;

    var safeAreaBottom = windowInfo.safeArea
      ? Math.max(windowInfo.screenHeight - windowInfo.safeArea.bottom, 0)
      : 0;

    cached = {
      statusBarHeight: statusBarHeight,
      navContentHeight: navContentHeight,
      navTotalHeight: statusBarHeight + navContentHeight,
      capsuleWidth: capsule.width,
      rightInset: rightInset,
      safeAreaBottom: safeAreaBottom,
      windowWidth: windowInfo.windowWidth,
    };
  } catch (error) {
    console.warn('[safeArea] device query failed, using fallback', error);
    cached = Object.assign({}, FALLBACK);
  }

  return cached;
}

module.exports = {
  readSafeArea: readSafeArea,
  clearSafeAreaCache: function () {
    cached = null;
  },
};
