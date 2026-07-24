export type TaxonomyNode = {
  code: string;
  nameZh: string;
  nameEn: string;
  children?: TaxonomyNode[];
};

/** 智慧翼商城标准三级类目：供应商原始类目不直接作为前台导航。 */
export const SMART_WING_TAXONOMY: TaxonomyNode[] = [
  { code: 'food', nameZh: '食品饮料', nameEn: 'Food & Beverage', children: [
    { code: 'food_grain', nameZh: '米面粮油', nameEn: 'Grain & Oil' },
    { code: 'food_snack', nameZh: '休闲零食', nameEn: 'Snacks' },
    { code: 'food_drink', nameZh: '茶饮乳品', nameEn: 'Drinks & Dairy' },
  ] },
  { code: 'appliance', nameZh: '家用电器', nameEn: 'Home Appliances', children: [
    { code: 'appliance_kitchen', nameZh: '厨房电器', nameEn: 'Kitchen Appliances' },
    { code: 'appliance_living', nameZh: '生活电器', nameEn: 'Living Appliances' },
  ] },
  { code: 'digital', nameZh: '数码办公', nameEn: 'Digital & Office', children: [
    { code: 'digital_computer', nameZh: '电脑及外设', nameEn: 'Computers & Peripherals' },
    { code: 'digital_audio', nameZh: '影音数码', nameEn: 'Audio & Digital' },
    { code: 'digital_office', nameZh: '办公设备', nameEn: 'Office Equipment' },
  ] },
  { code: 'home', nameZh: '家居日用', nameEn: 'Home & Living', children: [
    { code: 'home_furniture', nameZh: '家具家纺', nameEn: 'Furniture & Bedding' },
    { code: 'home_kitchen', nameZh: '厨具水具', nameEn: 'Kitchenware' },
    { code: 'home_storage', nameZh: '收纳清洁', nameEn: 'Storage & Cleaning' },
  ] },
  { code: 'personal', nameZh: '个护清洁', nameEn: 'Personal Care', children: [
    { code: 'personal_beauty', nameZh: '美妆护肤', nameEn: 'Beauty & Skincare' },
    { code: 'personal_wash', nameZh: '洗护清洁', nameEn: 'Personal Hygiene' },
  ] },
  { code: 'supermarket', nameZh: '商超商品', nameEn: 'General Merchandise', children: [
    { code: 'supermarket_office', nameZh: '文具办公', nameEn: 'Stationery' },
    { code: 'supermarket_family', nameZh: '母婴玩具宠物', nameEn: 'Family, Toys & Pets' },
    { code: 'supermarket_outdoor', nameZh: '运动户外汽配', nameEn: 'Outdoor & Automotive' },
  ] },
  { code: 'welfare', nameZh: '企业福利专区', nameEn: 'Enterprise Welfare', children: [
    { code: 'welfare_gift', nameZh: '节日礼赠', nameEn: 'Festival Gifts' },
    { code: 'welfare_care', nameZh: '员工关怀', nameEn: 'Employee Care' },
    { code: 'welfare_review', nameZh: '待人工归类', nameEn: 'Manual Review Required' },
  ] },
  { code: 'service', nameZh: '权益与本地生活', nameEn: 'Services & Benefits', children: [
    { code: 'service_virtual', nameZh: '虚拟卡券', nameEn: 'Digital Vouchers' },
    { code: 'service_movie', nameZh: '电影演出', nameEn: 'Entertainment' },
    { code: 'service_local', nameZh: '附近门店核销', nameEn: 'Local Redemption' },
  ] },
];

export const CATEGORY_DISPLAY_NAMES = Object.fromEntries(
  SMART_WING_TAXONOMY.map(({ code, nameZh }) => [code, nameZh])
);
