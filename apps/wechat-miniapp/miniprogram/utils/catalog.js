/**
 * Native catalog projection.
 *
 * The navigation structure is generated from the same taxonomy consumed by
 * the main Shop. Qualified products only enrich that stable structure with
 * cover images and counts; a slow or unavailable network must never collapse
 * the category page back to an empty placeholder.
 */

var taxonomy = require('../data/catalog-taxonomy.generated');

function copyTile(tile) {
  return {
    key: tile.key,
    label: tile.label,
    matchCodes: (tile.matchCodes || []).slice(),
    image: null,
    productCount: 0,
  };
}

function baseTilesByKey() {
  var leaves = taxonomy.leaves || [];
  var result = {
    featured: (taxonomy.mobileBrowse.featured || []).map(function (item) {
      return copyTile({ key: item.code, label: item.nameZh, matchCodes: item.matchCodes });
    }),
  };

  (taxonomy.mobileBrowse.rail || []).forEach(function (categoryCode) {
    var categoryLeaves = leaves.filter(function (leaf) {
      return leaf.l1 === categoryCode;
    });
    result[categoryCode] = categoryLeaves.map(function (leaf) {
      return copyTile({ key: leaf.code, label: leaf.nameZh, matchCodes: [leaf.code] });
    });
  });
  return result;
}

function rail() {
  var categoryByCode = {};
  (taxonomy.categories || []).forEach(function (category) {
    categoryByCode[category.code] = category;
  });
  return [{ key: 'featured', label: '精选' }].concat(
    (taxonomy.mobileBrowse.rail || []).map(function (code) {
      return { key: code, label: categoryByCode[code] ? categoryByCode[code].nameZh : code };
    })
  );
}

function secureImage(value) {
  return typeof value === 'string' && (/^https:\/\//.test(value) || /^\//.test(value)) ? value : null;
}

function productTile(product, index) {
  return {
    key: 'public-product-' + (product.id || index),
    label: product.name || product.title || '商品信息待同步',
    matchCodes: [],
    image: secureImage(product.coverUrl),
    productCount: 1,
    productId: product.id || '',
  };
}

function productMatches(product, tile, railKey) {
  var productTaxonomy = product && product.taxonomy;
  if (!productTaxonomy) return false;
  if (tile.matchCodes.indexOf(productTaxonomy.l3) !== -1) return true;
  return railKey !== 'featured' && productTaxonomy.l1 === railKey && tile.matchCodes.length === 0;
}

function enrichTiles(tilesByKey, products) {
  var result = {};
  Object.keys(tilesByKey).forEach(function (railKey) {
    result[railKey] = tilesByKey[railKey].map(function (sourceTile) {
      var tile = copyTile(sourceTile);
      var matched = products.filter(function (product) {
        return productMatches(product, tile, railKey);
      });
      tile.productCount = matched.length;
      for (var index = 0; index < matched.length; index += 1) {
        var cover = secureImage(matched[index].coverUrl);
        if (cover) {
          tile.image = cover;
          break;
        }
      }
      return tile;
    });
  });
  return result;
}

function createSnapshot(products) {
  var safeProducts = Array.isArray(products) ? products : [];
  var base = baseTilesByKey();
  var tilesByKey = safeProducts.length ? enrichTiles(base, safeProducts) : base;
  var featuredProducts = safeProducts.filter(function (product) {
    return product && typeof product.id === 'string';
  });
  if (featuredProducts.length) {
    tilesByKey.featured = featuredProducts.slice(0, 12).map(productTile);
  }
  return {
    rail: rail(),
    tilesByKey: tilesByKey,
    products: safeProducts,
    productCount: safeProducts.length,
    taxonomyVersion: taxonomy.version,
  };
}

function preferredRailKey(snapshot, currentKey) {
  var rails = snapshot && Array.isArray(snapshot.rail) ? snapshot.rail : [];
  var tilesByKey = (snapshot && snapshot.tilesByKey) || {};
  function hasProducts(key) {
    return (tilesByKey[key] || []).some(function (tile) {
      return tile.productCount > 0;
    });
  }
  if (currentKey && tilesByKey[currentKey] && hasProducts(currentKey)) return currentKey;
  for (var index = 0; index < rails.length; index += 1) {
    if (hasProducts(rails[index].key)) return rails[index].key;
  }
  if (currentKey && tilesByKey[currentKey]) return currentKey;
  return rails.length ? rails[0].key : '';
}

function tileProductCount(tiles) {
  return (Array.isArray(tiles) ? tiles : []).reduce(function (total, tile) {
    var count = Number(tile && tile.productCount);
    return total + (Number.isFinite(count) && count > 0 ? count : 0);
  }, 0);
}

function itemsFromResponse(response) {
  if (!response || !Array.isArray(response.items)) {
    var error = new Error('商品目录返回格式异常');
    error.code = 'INVALID_CATALOG_RESPONSE';
    throw error;
  }
  return response.items.filter(function (product) {
    return product && typeof product.id === 'string' && product.taxonomy && typeof product.taxonomy.l1 === 'string';
  });
}

module.exports = {
  createSnapshot: createSnapshot,
  preferredRailKey: preferredRailKey,
  tileProductCount: tileProductCount,
  itemsFromResponse: itemsFromResponse,
};
