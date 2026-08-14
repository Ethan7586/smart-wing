/**
 * Size class resolution.
 *
 * rpx scales everything with the screen — including text. A 20rpx label is
 * 8.5px on a 320pt phone and 11.5px on a 430pt one, from the same source. That
 * is backwards: layout should scale with the screen, text should stay roughly
 * constant in physical size.
 *
 * Every page puts the returned class on its root element. The four classes are
 * generated into styles/tokens.wxss from mobile-platforms.json → sizeClasses,
 * and all four are equally official mobile VI, not a baseline plus fallbacks.
 *
 * Boundaries are duplicated here from the JSON because WXSS/JS in the mini
 * program cannot import repository files. scripts/check-miniapp-vi.mjs asserts
 * the two stay in sync.
 */
var BOUNDARIES = [
  { key: 'compact', maxWidthPt: 344 },
  { key: 'standard', maxWidthPt: 392 },
  { key: 'regular', maxWidthPt: 428 },
  { key: 'large', maxWidthPt: Infinity },
];

var cached = null;

function resolveSizeClass(force) {
  if (cached && !force) return cached;

  var width = 375;
  try {
    width = wx.getWindowInfo().windowWidth || 375;
  } catch (error) {
    console.warn('[sizeClass] window query failed, assuming the 375pt baseline', error);
  }

  var match = BOUNDARIES[BOUNDARIES.length - 1];
  for (var i = 0; i < BOUNDARIES.length; i += 1) {
    if (width <= BOUNDARIES[i].maxWidthPt) {
      match = BOUNDARIES[i];
      break;
    }
  }

  cached = { key: match.key, className: 'sz-' + match.key, widthPt: width };
  return cached;
}

module.exports = {
  resolveSizeClass: resolveSizeClass,
  clearSizeClassCache: function () {
    cached = null;
  },
};
