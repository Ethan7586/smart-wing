/**
 * Size class resolution.
 *
 * Phones: rpx scales everything with the screen, text included. A 20rpx label
 * is 8.5px on a 320pt phone and 11.5px on a 430pt one, from the same source.
 * Layout should scale; text should hold a roughly constant physical size, so
 * each phone class carries a fixed inverse text factor.
 *
 * Tablets: the same mechanism breaks down. 750rpx always equals the screen
 * width, so on a 1024pt iPad one rpx is 1.37pt — a 32rpx inset becomes 44pt and
 * a 48rpx icon becomes 65pt. No fixed factor fixes that, because the deviation
 * depends on the actual width. Tablets therefore compute BOTH factors at
 * runtime as 375 / windowWidth, which pulls every absolute dimension back to
 * the physical size a phone would give it, and additionally cap the content
 * column so the layout does not stretch across the full panel.
 *
 * Boundaries are duplicated from mobile-platforms.json because the mini program
 * cannot import repository files; scripts/check-miniapp-vi.mjs asserts they
 * stay in sync.
 */
var BOUNDARIES = [
  { key: 'compact', maxWidthPt: 344, contentMaxWidthPt: null },
  { key: 'standard', maxWidthPt: 392, contentMaxWidthPt: null },
  { key: 'regular', maxWidthPt: 428, contentMaxWidthPt: null },
  { key: 'large', maxWidthPt: 599, contentMaxWidthPt: null },
  { key: 'tablet', maxWidthPt: 899, contentMaxWidthPt: 600 },
  { key: 'tabletWide', maxWidthPt: Infinity, contentMaxWidthPt: 720 },
];

/** The design baseline. Tablet factors pull dimensions back toward this width. */
var BASELINE_PT = 375;

var cached = null;

function resolveSizeClass(force) {
  if (cached && !force) return cached;

  var width = BASELINE_PT;
  try {
    width = wx.getWindowInfo().windowWidth || BASELINE_PT;
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

  var isTablet = match.contentMaxWidthPt !== null;
  // Phones read their factors from the generated .sz-* class; only tablets need
  // a runtime value, so an empty style string leaves the class in charge.
  var scale = isTablet ? BASELINE_PT / width : null;
  var contentWidth = isTablet ? Math.min(match.contentMaxWidthPt, width) : null;

  var rootStyle = '';
  if (isTablet) {
    rootStyle = '--sw-text-scale: ' + scale.toFixed(4) + '; ' + '--sw-space-scale: ' + scale.toFixed(4) + '; ' + '--sw-content-width: ' + contentWidth + 'px;';
  }

  cached = {
    key: match.key,
    className: 'sz-' + match.key,
    widthPt: width,
    isTablet: isTablet,
    scale: scale,
    contentWidthPt: contentWidth,
    rootStyle: rootStyle,
  };
  return cached;
}

module.exports = {
  resolveSizeClass: resolveSizeClass,
  clearSizeClassCache: function () {
    cached = null;
  },
};
