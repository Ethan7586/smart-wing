function centsValue(value) {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
}

function formatCents(value) {
  var cents = centsValue(value);
  if (!Number.isFinite(cents)) return '';
  var absolute = Math.abs(Math.round(cents));
  var yuan = Math.floor(absolute / 100);
  var fraction = String(absolute % 100).padStart(2, '0');
  return (cents < 0 ? '-' : '') + String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction;
}

function formatDate(value) {
  var date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '待同步';
  function two(part) {
    return String(part).padStart(2, '0');
  }
  return date.getFullYear() + '-' + two(date.getMonth() + 1) + '-' + two(date.getDate()) + ' ' + two(date.getHours()) + ':' + two(date.getMinutes()) + ':' + two(date.getSeconds());
}

function statusMeta(status, paymentStatus) {
  if (paymentStatus === 'paid' && status === 'pending_payment') return { label: '支付已确认', tone: 'success', copy: '微信支付已由服务端确认，订单状态正在更新。' };
  var map = {
    pending_payment: { label: '待付款', tone: 'warning', copy: '完成支付后，订单才会进入履约。' },
    paid: { label: '待发货', tone: 'brand', copy: '支付已确认，等待履约方处理。' },
    processing: { label: '待发货', tone: 'brand', copy: '履约方正在处理订单。' },
    pending_shipment: { label: '待发货', tone: 'brand', copy: '等待履约方发货。' },
    shipped: { label: '待收货', tone: 'brand', copy: '商品已发出，请关注后续物流。' },
    pending_receipt: { label: '待收货', tone: 'brand', copy: '商品已发出，请关注后续物流。' },
    completed: { label: '已完成', tone: 'success', copy: '订单已经完成。' },
    cancelled: { label: '已取消', tone: 'muted', copy: '订单已取消，不会继续履约。' },
    refund_pending: { label: '退款中', tone: 'warning', copy: '退款正在处理，以后端结果为准。' },
    refunded: { label: '已退款', tone: 'muted', copy: '退款已经完成。' },
  };
  return map[status] || { label: '状态同步中', tone: 'muted', copy: '订单状态以后端返回为准。' };
}

function paymentStatusLabel(status) {
  return { pending: '待支付', paid: '支付成功', closed: '支付已关闭', failed: '支付失败', refunded: '已退款' }[status] || '待同步';
}

function decorateItem(item, index) {
  var source = item || {};
  var specs = source.spec !== undefined ? source.spec : source.specs;
  var spec =
    typeof specs === 'string'
      ? specs
      : specs && typeof specs === 'object'
        ? Object.keys(specs)
            .map(function (key) {
              return key + '：' + specs[key];
            })
            .join(' · ')
        : '';
  var quantityValue = Number(source.quantity);
  var quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : null;
  var unitPriceCents = centsValue(source.unitPriceCents !== undefined ? source.unitPriceCents : source.priceCents);
  var totalCents = centsValue(source.totalCents !== undefined ? source.totalCents : source.lineAmountCents);
  if (!Number.isFinite(totalCents) && Number.isFinite(unitPriceCents) && quantity) totalCents = unitPriceCents * quantity;
  return {
    key: source.id || source.productId || 'item-' + index,
    name: source.name || source.productTitle || '订单商品',
    spec: spec,
    quantity: quantity,
    unitPrice: formatCents(unitPriceCents),
    total: formatCents(totalCents),
    image: source.image || source.productImage || '',
  };
}

function decorateOrder(source) {
  var raw = source || {};
  var status = typeof raw.status === 'string' ? raw.status : 'unknown';
  var paymentStatus = typeof raw.paymentStatus === 'string' ? raw.paymentStatus.toLowerCase() : 'unknown';
  var meta = statusMeta(status, paymentStatus);
  var totalCents = Number.isFinite(centsValue(raw.totalCents)) ? raw.totalCents : Number.isFinite(centsValue(raw.payableCents)) ? raw.payableCents : raw.goodsAmountCents;
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    orderNo: typeof raw.orderNo === 'string' ? raw.orderNo : '',
    status: status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    statusCopy: meta.copy,
    paymentStatus: paymentStatus || 'unknown',
    paymentStatusLabel: paymentStatusLabel(paymentStatus),
    currency: raw.currency || '',
    total: formatCents(totalCents),
    createdAt: formatDate(raw.createdAt),
    paidAt: raw.paidAt ? formatDate(raw.paidAt) : '',
    items: (Array.isArray(raw.items) ? raw.items : []).map(decorateItem),
    canPay: status === 'pending_payment' && paymentStatus !== 'paid' && centsValue(totalCents) > 0,
  };
}

function loadErrorView(error) {
  var code = error && error.code;
  if (code === 'INVALID_ORDER_NO') return { kind: 'invalid', title: '订单链接无效', message: error.message, retryable: false };
  if (code === 'WECHAT_BINDING_REQUIRED') return { kind: 'binding', title: '需要绑定智慧翼会员', message: '请先在“订单”页用现有账号完成一次绑定，再返回查看这笔订单。', retryable: false };
  if (code === 'ORDER_NOT_FOUND' || code === 'HTTP_404') return { kind: 'missing', title: '没有找到这笔订单', message: '请确认订单属于当前会员，或从订单列表重新进入。', retryable: false };
  if (code === 'FORBIDDEN') return { kind: 'forbidden', title: '无法查看这笔订单', message: '订单只对所属会员开放，请切换到正确的会员身份。', retryable: false };
  if (code === 'REQUEST_TIMEOUT') return { kind: 'timeout', title: '订单加载超时', message: error.message, retryable: true };
  if (code === 'NETWORK_ERROR') return { kind: 'offline', title: '网络连接失败', message: error.message, retryable: true };
  return { kind: 'error', title: '订单加载失败', message: (error && error.message) || '服务暂时不可用，请稍后重试', retryable: true };
}

function paymentErrorCopy(error) {
  var code = error && error.code;
  if (code === 'PHONE_VERIFICATION_REQUIRED') return '完成手机认证后才能使用个人微信支付。';
  if (code === 'WECHAT_PAYMENT_NOT_CONFIGURED' || code === 'WECHAT_PAY_NOT_CONFIGURED') return '微信支付商户配置尚未完成，系统已阻止发起支付。';
  if (code === 'PAYMENT_AMOUNT_INVALID') return '订单待支付金额异常，系统已阻止支付。';
  if (code === 'PAYMENT_NOT_ALLOWED') return '当前订单状态不能发起支付，请刷新订单。';
  return (error && error.message) || '支付未能发起，请稍后重试。';
}

module.exports = { decorateOrder: decorateOrder, loadErrorView: loadErrorView, paymentErrorCopy: paymentErrorCopy, paymentStatusLabel: paymentStatusLabel };
