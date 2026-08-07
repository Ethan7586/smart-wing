export type TaxonomyNode = {
  code: string;
  nameZh: string;
  nameEn: string;
  children?: TaxonomyNode[];
};

/** 智慧翼商城标准三级类目：供应商原始类目不直接作为前台导航。 */
export const SMART_WING_TAXONOMY: TaxonomyNode[] = [
  {
    code: 'food',
    nameZh: '食品饮料',
    nameEn: 'Food & Beverage',
    children: [
      { code: 'food_grain', nameZh: '米面粮油', nameEn: 'Grain & Oil' },
      { code: 'food_snack', nameZh: '休闲零食', nameEn: 'Snacks' },
      { code: 'food_drink', nameZh: '茶饮乳品', nameEn: 'Drinks & Dairy' },
    ],
  },
  {
    code: 'appliance',
    nameZh: '家用电器',
    nameEn: 'Home Appliances',
    children: [
      { code: 'appliance_kitchen', nameZh: '厨房电器', nameEn: 'Kitchen Appliances' },
      { code: 'appliance_living', nameZh: '生活电器', nameEn: 'Living Appliances' },
    ],
  },
  {
    code: 'digital',
    nameZh: '数码办公',
    nameEn: 'Digital & Office',
    children: [
      { code: 'digital_computer', nameZh: '电脑及外设', nameEn: 'Computers & Peripherals' },
      { code: 'digital_audio', nameZh: '影音数码', nameEn: 'Audio & Digital' },
      { code: 'digital_office', nameZh: '办公设备', nameEn: 'Office Equipment' },
    ],
  },
  {
    code: 'home',
    nameZh: '家居日用',
    nameEn: 'Home & Living',
    children: [
      { code: 'home_furniture', nameZh: '家具家纺', nameEn: 'Furniture & Bedding' },
      { code: 'home_kitchen', nameZh: '厨具水具', nameEn: 'Kitchenware' },
      { code: 'home_storage', nameZh: '收纳清洁', nameEn: 'Storage & Cleaning' },
    ],
  },
  {
    code: 'personal',
    nameZh: '个护清洁',
    nameEn: 'Personal Care',
    children: [
      { code: 'personal_beauty', nameZh: '美妆护肤', nameEn: 'Beauty & Skincare' },
      { code: 'personal_wash', nameZh: '洗护清洁', nameEn: 'Personal Hygiene' },
    ],
  },
  {
    code: 'supermarket',
    nameZh: '商超商品',
    nameEn: 'General Merchandise',
    children: [
      { code: 'supermarket_office', nameZh: '文具办公', nameEn: 'Stationery' },
      { code: 'supermarket_family', nameZh: '母婴玩具宠物', nameEn: 'Family, Toys & Pets' },
      { code: 'supermarket_outdoor', nameZh: '运动户外汽配', nameEn: 'Outdoor & Automotive' },
    ],
  },
  {
    code: 'apparel',
    nameZh: '服饰鞋包',
    nameEn: 'Fashion & Accessories',
    children: [
      { code: 'apparel_footwear', nameZh: '鞋靴服饰', nameEn: 'Footwear & Apparel' },
      { code: 'apparel_bags', nameZh: '箱包配饰', nameEn: 'Bags & Accessories' },
      { code: 'apparel_jewelry', nameZh: '珠宝饰品', nameEn: 'Jewelry' },
    ],
  },
  {
    code: 'welfare',
    nameZh: '企业福利专区',
    nameEn: 'Enterprise Welfare',
    children: [
      { code: 'welfare_gift', nameZh: '节日礼赠', nameEn: 'Festival Gifts' },
      { code: 'welfare_care', nameZh: '员工关怀', nameEn: 'Employee Care' },
      { code: 'welfare_review', nameZh: '待人工归类', nameEn: 'Manual Review Required' },
    ],
  },
  {
    code: 'service',
    nameZh: '权益与本地生活',
    nameEn: 'Services & Benefits',
    children: [
      { code: 'service_virtual', nameZh: '虚拟卡券', nameEn: 'Digital Vouchers' },
      { code: 'service_movie', nameZh: '电影演出', nameEn: 'Entertainment' },
      { code: 'service_local', nameZh: '附近门店核销', nameEn: 'Local Redemption' },
    ],
  },
];

export const CATEGORY_DISPLAY_NAMES = Object.fromEntries(SMART_WING_TAXONOMY.map(({ code, nameZh }) => [code, nameZh]));

export const TAXONOMY_LEAF_NAMES: Record<string, string> = {
  food_grain_rice: '大米杂粮',
  food_grain_oil: '食用油调味',
  food_snack_nuts: '坚果零食',
  food_drink_coffee_tea: '咖啡茶饮',
  food_drink_dairy: '乳品饮料',
  appliance_kitchen_cook: '烹饪电器',
  appliance_living_clean: '清洁电器',
  appliance_living_air: '空气与环境电器',
  digital_computer_pc: '电脑整机',
  digital_computer_peripheral: '电脑外设',
  digital_mobile_accessory: '手机配件',
  digital_audio_mobile: '手机数码',
  digital_audio_audio: '耳机音箱',
  digital_office_stationery: '办公文具',
  home_furniture_bedding: '床品家纺',
  home_furniture_furniture: '家具灯具',
  home_kitchen_tableware: '餐厨水具',
  home_storage_organize: '收纳整理',
  personal_beauty_skin: '护肤美妆',
  personal_wash_hair: '洗护用品',
  personal_wash_clean: '家庭清洁',
  supermarket_office_paper: '纸品文具',
  supermarket_family_toys: '玩具母婴宠物',
  supermarket_outdoor_sports: '运动户外',
  supermarket_outdoor_auto: '汽车工具',
  apparel_footwear_shoes: '鞋靴',
  apparel_bags_bag: '箱包',
  apparel_jewelry_fine: '珠宝首饰',
  welfare_gift_festival: '节日礼盒',
  welfare_care_employee: '员工关怀',
  welfare_review_unclassified: '待审核商品',
};

/** 仅此映射可进入商城公开目录；展示翻译不能改变分类路径。 */
export const STRICT_TAXONOMY_PATHS: Record<string, readonly [string, string]> = {
  food_grain_rice: ['food', 'food_grain'],
  food_grain_oil: ['food', 'food_grain'],
  food_snack_nuts: ['food', 'food_snack'],
  food_drink_coffee_tea: ['food', 'food_drink'],
  food_drink_dairy: ['food', 'food_drink'],
  appliance_kitchen_cook: ['appliance', 'appliance_kitchen'],
  appliance_living_clean: ['appliance', 'appliance_living'],
  appliance_living_air: ['appliance', 'appliance_living'],
  digital_computer_pc: ['digital', 'digital_computer'],
  digital_computer_peripheral: ['digital', 'digital_computer'],
  digital_mobile_accessory: ['digital', 'digital_mobile'],
  digital_audio_mobile: ['digital', 'digital_audio'],
  digital_audio_audio: ['digital', 'digital_audio'],
  digital_office_stationery: ['digital', 'digital_office'],
  home_furniture_bedding: ['home', 'home_furniture'],
  home_furniture_furniture: ['home', 'home_furniture'],
  home_kitchen_tableware: ['home', 'home_kitchen'],
  home_storage_organize: ['home', 'home_storage'],
  personal_beauty_skin: ['personal', 'personal_beauty'],
  personal_wash_hair: ['personal', 'personal_wash'],
  personal_wash_clean: ['personal', 'personal_wash'],
  supermarket_office_paper: ['supermarket', 'supermarket_office'],
  supermarket_family_toys: ['supermarket', 'supermarket_family'],
  supermarket_outdoor_sports: ['supermarket', 'supermarket_outdoor'],
  supermarket_outdoor_auto: ['supermarket', 'supermarket_outdoor'],
  apparel_footwear_shoes: ['apparel', 'apparel_footwear'],
  apparel_bags_bag: ['apparel', 'apparel_bags'],
  apparel_jewelry_fine: ['apparel', 'apparel_jewelry'],
  welfare_gift_festival: ['welfare', 'welfare_gift'],
  welfare_care_employee: ['welfare', 'welfare_care'],
  welfare_review_unclassified: ['welfare', 'welfare_review'],
};

export function isStrictTaxonomyPath(l1: string | null, l2: string | null, l3: string | null) {
  if (!l1 || !l2 || !l3) return false;
  const path = STRICT_TAXONOMY_PATHS[l3];
  return Boolean(path && path[0] === l1 && path[1] === l2);
}
