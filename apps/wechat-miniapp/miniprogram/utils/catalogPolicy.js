/**
 * Mini Program commerce qualification boundary.
 *
 * The main Shop and source catalog remain intact. A category is exposed in the
 * Mini Program only after the corresponding WeChat service category and
 * qualification are approved. Flip one flag after approval to restore every
 * related Mini Program entry consistently.
 */

var FOOD_COMMERCE_ENABLED = false;
var FOOD_FEATURED_KEYS = {
  featured_snack: true,
  featured_grain: true,
  featured_dairy: true,
  featured_fresh: true,
  featured_deli: true,
  featured_drink: true,
  featured_health: true,
};
var FOOD_HOME_SEGMENTS = { grocery: true, dining: true };

function productL1(product) {
  var taxonomy = product && product.taxonomy;
  return (taxonomy && taxonomy.l1) || (product && product.categoryCode) || '';
}

function isProductVisible(product) {
  if (FOOD_COMMERCE_ENABLED) return true;
  var taxonomy = (product && product.taxonomy) || {};
  var categoryCode = (product && product.categoryCode) || '';
  return productL1(product) !== 'food' && !/^food(?:_|$)/.test(categoryCode) && !/^food(?:_|$)/.test(taxonomy.l2 || '') && !/^food(?:_|$)/.test(taxonomy.l3 || '');
}

function filterProducts(products) {
  return (Array.isArray(products) ? products : []).filter(isProductVisible);
}

function isRailVisible(code) {
  return FOOD_COMMERCE_ENABLED || code !== 'food';
}

function isFeaturedTileVisible(tile) {
  if (FOOD_COMMERCE_ENABLED) return true;
  if (tile && FOOD_FEATURED_KEYS[tile.code || tile.key]) return false;
  return !(
    tile &&
    (tile.matchCodes || []).some(function (code) {
      return /^food(?:_|$)/.test(code);
    })
  );
}

function isHomeSegmentVisible(segment) {
  if (!segment || segment.reviewEnabled === false) return false;
  return FOOD_COMMERCE_ENABLED || !FOOD_HOME_SEGMENTS[segment.key];
}

module.exports = {
  foodCommerceEnabled: FOOD_COMMERCE_ENABLED,
  filterProducts: filterProducts,
  isProductVisible: isProductVisible,
  isRailVisible: isRailVisible,
  isFeaturedTileVisible: isFeaturedTileVisible,
  isHomeSegmentVisible: isHomeSegmentVisible,
};
