function createCatalogApi(performRequest, apiError) {
  function productPath(options) {
    var input = options || {};
    var parts = [];
    if (input.category) parts.push('category=' + encodeURIComponent(input.category));
    if (typeof input.cursor === 'number') parts.push('cursor=' + input.cursor);
    parts.push('limit=' + (input.limit || 100));
    return '/api/v1/products?' + parts.join('&');
  }

  function listProducts(options) {
    return performRequest('GET', productPath(options));
  }

  function listAllProducts() {
    var items = [];
    var pageCount = 0;
    var activeRequest = null;
    var cancelled = false;

    function next(cursor) {
      pageCount += 1;
      if (cancelled) return Promise.reject(apiError('REQUEST_ABORTED', '请求已取消'));
      if (pageCount > 60) return Promise.reject(apiError('CATALOG_PAGE_LIMIT', '商品目录分页超过安全上限'));
      activeRequest = listProducts({ cursor: cursor, limit: 100 });
      return activeRequest.then(function (response) {
        if (!response || !Array.isArray(response.items) || !response.pagination) {
          return Promise.reject(apiError('INVALID_CATALOG_RESPONSE', '商品目录返回格式异常'));
        }
        items = items.concat(response.items);
        return response.pagination.nextCursor === null ? { items: items, requestId: response.requestId } : next(response.pagination.nextCursor);
      });
    }

    var promise = next(0);
    promise.abort = function () {
      cancelled = true;
      if (activeRequest && typeof activeRequest.abort === 'function') activeRequest.abort();
    };
    return promise;
  }

  return { listProducts: listProducts, listAllProducts: listAllProducts };
}

module.exports = { createCatalogApi: createCatalogApi };
