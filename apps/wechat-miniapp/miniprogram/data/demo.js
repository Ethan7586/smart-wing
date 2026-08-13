/**
 * Local demo data — visual acceptance only.
 *
 * Values mirror the approved design board
 * docs/mobile/design-previews/smart-wing-unified-mall-01-browse-v2-cart-restored.png
 * so a screenshot can be compared region by region against the master.
 *
 * This is NOT a fallback. If a real API is wired and fails, pages must show an
 * explicit error state — never quietly render these numbers as if they were the
 * member's own. Every consumer reads IS_DEMO and says so on screen.
 */

var IS_DEMO = true;

module.exports = {
  IS_DEMO: IS_DEMO,

  scope: {
    brandTitle: '智慧翼福利商城',
    enterpriseName: '国网福利',
    departmentName: '数字化推进部',
    city: '武汉市',
  },

  assets: {
    // Server returns cents; the page formats. Never do money maths in WXML.
    monthlyQuotaLabel: '本月福利额度',
    monthlyQuotaCents: 280000,
    phoneVerified: false,
    phoneNotice: '手机未认证 · 部分功能受限',
  },

  cartCount: 3,

  // Four entries. Icon names resolve to generated classes in styles/icons.wxss.
  entries: [
    { key: 'enterprise', label: '企业专区', icon: 'building-2' },
    { key: 'city', label: '城市专区', icon: 'map-pin' },
    { key: 'voucher', label: '电子卡券', icon: 'ticket' },
    { key: 'partner', label: '合作商', icon: 'store' },
  ],

  hero: {
    title: '员工专享福利季',
    subtitle: '精选好物 · 专属惠上',
    slideCount: 4,
    // No illustration file exists. The slot renders as a labelled placeholder
    // rather than an invented graphic. See 02-VI与产品冻结规则 "禁止想象与临时手绘".
    illustration: null,
  },

  /**
   * Partner retailers. Smart Wing stays the primary brand; until a logo file is
   * dropped into assets/partners/, each renders as a neutral text label.
   * DESIGN.md lists 全部 / 麦德龙 / 沃尔玛 / 山姆 / 大润发 / 永辉.
   */
  partners: [
    { key: 'all', label: '全部', logo: null },
    { key: 'metro', label: '麦德龙', logo: null },
    { key: 'walmart', label: '沃尔玛', logo: null },
    { key: 'sams', label: '山姆', logo: null },
    { key: 'rt-mart', label: '大润发', logo: null },
    { key: 'yonghui', label: '永辉', logo: null },
  ],

  segments: [
    { key: 'grocery', title: '商超到家', desc: '生鲜百货 极速达送', icon: 'shopping-basket', image: null },
    { key: 'life', title: '生活服务', desc: '乐享生活 便捷到家', icon: 'house-plus', image: null },
    { key: 'digital', title: '数码办公', desc: '精选设备 高效办公', icon: 'laptop', image: null },
    { key: 'dining', title: '餐饮福利', desc: '美味折扣 员工专享', icon: 'utensils', image: null },
  ],

  memberCodeCta: {
    title: '到店出示会员码',
    desc: '合作门店身份与权益核验 · 不是支付码',
  },

  // No product photography exists yet. image: null renders the branded slot.
  recommendations: [
    { skuId: 'demo-1', title: '蒙牛 纯牛奶 250mL ×16 盒', priceCents: 6990, marketPriceCents: 7800, tag: '企业专享', source: '国贸店 · 合作商', image: null },
    { skuId: 'demo-2', title: '三只松鼠 坚果礼盒 500g', priceCents: 12900, marketPriceCents: 15600, tag: '福利加购', source: '亦庄自提点 · 合作商', image: null },
  ],
};
