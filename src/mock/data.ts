/**
 * 智慧翼企业福利商城 - Mock 数据集
 * 包含 30+ 条涵盖实物、电影票、虚拟卡券、商超、生活服务、附近门店核销的完整真实感商品数据
 * 技术服务方：雍彻科技
 */

import {
  Product,
  Category,
  EnterpriseMall,
  UserProfile,
  DeliveryAddress,
  Order,
  AccountLog,
  UserCoupon,
  AfterSaleRecord,
  Supplier
} from '../types';

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: 'sup_01', name: '京东供应链', type: 'third_party', code: 'JD-API' },
  { id: 'sup_02', name: '平台自营仓', type: 'self_operated', code: 'YONGCHE-SELF' },
  { id: 'sup_03', name: '集团特选供应', type: 'group_owned', code: 'GROUP-SPECIAL' },
];

export const MOCK_ENTERPRISE_MALLS: EnterpriseMall[] = [
  {
    id: 'mall_gw',
    enterpriseId: 'ent_gw',
    enterpriseName: '国家电网有限公司',
    mallName: '国网员工企业福利专享商城',
    logoText: '国网福利',
    badge: '央企专属福利',
    welcomeBanner: '国网员工专项福利补贴已发放，支持福利卡与餐卡通兑！',
    distributorId: 'DIST-001-GW'
  },
  {
    id: 'mall_zh',
    enterpriseId: 'ent_zh',
    enterpriseName: '中国航空工业集团',
    mallName: '中航工业职工特惠商城',
    logoText: '中航特惠',
    badge: '军工企业尊享',
    welcomeBanner: '中航工业2026年二季度劳保与健康关怀福利专场已开启',
    distributorId: 'DIST-002-ZH'
  }
];

export const MOCK_USER: UserProfile = {
  id: 'usr_88902',
  employeeId: 'FW-88902',
  name: '张建国',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  phone: '138****9281',
  jobTitle: '高级工程师',
  department: '数字化推进部',
  enterpriseId: 'ent_gw',
  enterpriseName: '国家电网有限公司',
  currentMallId: 'mall_gw',
  welfareBalance: 3280.00,
  mealBalance: 850.50,
  couponCount: 6,
  distributorId: 'DIST-001-GW'
};

export const MOCK_ADDRESSES: DeliveryAddress[] = [
  {
    id: 'addr_01',
    name: '张建国',
    phone: '13812349281',
    province: '北京市',
    city: '北京市',
    district: '西城区',
    detail: '金融大街1号 国家电网大厦 1208室',
    isDefault: true,
    tag: '公司'
  },
  {
    id: 'addr_02',
    name: '张建国',
    phone: '13812349281',
    province: '北京市',
    city: '北京市',
    district: '海淀区',
    detail: '中关村南大街18号 紫竹花园 3号楼2单元601',
    isDefault: false,
    tag: '家庭'
  }
];

export const MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat_food',
    name: '食品饮料',
    iconName: 'UtensilsCrossed',
    hotKeywords: ['坚果礼盒', '五常大米', '有机压榨油', '精品茶叶', '特仑苏牛奶'],
    children: [
      { id: 'sub_food_1', name: '米面粮油', items: ['有机大米', '橄榄油', '面粉', '杂粮礼盒'] },
      { id: 'sub_food_2', name: '休闲零食', items: ['坚果炒货', '进口巧克力', '肉干肉脯', '糕点饼干'] },
      { id: 'sub_food_3', name: '冲调茶饮', items: ['西湖龙井', '云南普洱', '挂耳咖啡', '乳品饮料'] },
    ]
  },
  {
    id: 'cat_appliance',
    name: '家用电器',
    iconName: 'Tv',
    hotKeywords: ['戴森吸尘器', '空气炸锅', '破壁机', '咖啡机', '扫地机器人'],
    children: [
      { id: 'sub_app_1', name: '厨房小电', items: ['空气炸锅', '破壁机', '电饭煲', '养生壶'] },
      { id: 'sub_app_2', name: '生活电器', items: ['吸尘器', '空气净化器', '除螨仪', '电风扇'] },
      { id: 'sub_app_3', name: '个护健康', items: ['电动牙刷', '按摩仪', '吹风机', '剃须刀'] },
    ]
  },
  {
    id: 'cat_digital',
    name: '数码办公',
    iconName: 'Laptop',
    hotKeywords: ['降噪耳机', '机械键盘', '显示器', '移动硬盘', '智能手表'],
    children: [
      { id: 'sub_dig_1', name: '电脑外设', items: ['机械键盘', '无线鼠标', '高刷新率显示器', '扩展坞'] },
      { id: 'sub_dig_2', name: '影音数码', items: ['蓝牙耳机', '头戴降噪耳机', '户外音箱', '录音笔'] },
      { id: 'sub_dig_3', name: '办公用品', items: ['打印纸', '高端钢笔', '文件柜', '碎纸机'] },
    ]
  },
  {
    id: 'cat_home',
    name: '家居日用',
    iconName: 'Home',
    hotKeywords: ['桑蚕丝被', '乳胶枕', '膳魔师保温杯', '纯棉毛巾礼盒', '香氛礼盒'],
    children: [
      { id: 'sub_home_1', name: '家纺用品', items: ['蚕丝被', '乳胶枕', '四件套', '纯棉毛巾'] },
      { id: 'sub_home_2', name: '餐具水具', items: ['保温杯', '骨瓷餐具礼盒', '茶具套组', '红酒杯'] },
      { id: 'sub_home_3', name: '收纳清洁', items: ['垃圾桶', '收纳箱', '衣架套组', '香氛点缀'] },
    ]
  },
  {
    id: 'cat_personal',
    name: '个护清洁',
    iconName: 'Sparkles',
    hotKeywords: ['飞利浦剃须刀', 'SK-II礼盒', '洗护套装', '电动牙刷头', '洗发水'],
    children: [
      { id: 'sub_per_1', name: '面部护理', items: ['男士护肤礼盒', '保湿面霜', '防晒霜', '面膜套组'] },
      { id: 'sub_per_2', name: '洗发护发', items: ['防脱洗发水', '发膜', '沐浴露礼盒', '洗手液'] },
    ]
  },
  {
    id: 'cat_movie',
    name: '电影娱乐',
    iconName: 'Film',
    hotKeywords: ['全国影院通兑', 'IMAX 3D观影券', '万达影城双人票', '博纳影城电子券'],
    children: [
      { id: 'sub_mov_1', name: '电影通兑', items: ['全国2D/3D通用卷', 'VIP厅兑换券', '双人观影套餐'] },
      { id: 'sub_mov_2', name: '演出剧场', items: ['话剧门票', '音乐会门票', '儿童剧'] }
    ]
  },
  {
    id: 'cat_virtual',
    name: '虚拟卡券',
    iconName: 'CreditCard',
    hotKeywords: ['星巴克100元卡', '京东E卡', '爱奇艺年卡', '腾讯视频VIP', '猫眼电影卡'],
    children: [
      { id: 'sub_vir_1', name: '商超/饮品卡', items: ['星巴克电子卡', '瑞幸咖啡券', '沃尔玛礼品卡'] },
      { id: 'sub_vir_2', name: '音视频会员', items: ['爱奇艺年卡', '腾讯视频年卡', '网易云音乐VIP', '哔哩哔哩大会员'] }
    ]
  },
  {
    id: 'cat_supermarket',
    name: '商超商品',
    iconName: 'ShoppingBag',
    hotKeywords: ['永辉超市直提', '盒马鲜生礼品券', '大润发商品特惠', '沃尔玛购物卡'],
    children: [
      { id: 'sub_sup_1', name: '连锁商超', items: ['盒马专区', '永辉超市', '山姆代购特惠'] }
    ]
  },
  {
    id: 'cat_nearby',
    name: '附近门店',
    iconName: 'Store',
    hotKeywords: ['洗车美容', '家政清洁', '附近品质餐饮', '健身房周卡', '连锁烘焙券'],
    children: [
      { id: 'sub_near_1', name: '汽车服务', items: ['精细洗车', '汽车保养', '轮胎检测'] },
      { id: 'sub_near_2', name: '本地美食', items: ['烘焙套餐', '双人自助餐', '商务套餐'] },
      { id: 'sub_near_3', name: '生活保养', items: ['3小时深度保洁', '健身房周卡', '洗衣护理'] }
    ]
  },
  {
    id: 'cat_welfare_zone',
    name: '企业福利专区',
    iconName: 'Gift',
    hotKeywords: ['端午粽子礼盒', '中秋月饼礼盒', '年货大礼包', '员工防暑降温套装'],
    children: [
      { id: 'sub_wel_1', name: '节日礼盒', items: ['中秋月饼', '端午礼粽', '年货礼包'] },
      { id: 'sub_wel_2', name: '劳保关怀', items: ['防暑降温包', '健康体检套餐', '清凉饮料箱'] }
    ]
  }
];

export const MOCK_PRODUCTS: Product[] = [
  // 1. 五常大米
  {
    id: 'p_101',
    title: '【集团专享】柴火大院 核心产区五常有机大米 10kg/袋 附有机认证',
    subtitle: '原产地直供，颗粒饱满，饭香浓郁，企业劳保福利必选',
    images: [
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 158.00,
    priceMall: 128.00,
    priceWelfare: 98.00,
    categoryId: 'cat_food',
    categoryName: '米面粮油',
    subCategoryId: 'sub_food_1',
    brand: '柴火大院',
    tags: ['央企礼采', '有机认证', '包邮到家'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'meal', 'wechat', 'cash'],
    stock: 2450,
    salesCount: 18900,
    rating: 4.9,
    reviewCount: 3200,
    deliverySla: '次日达',
    isEnterpriseExclusive: true,
    isDailySpecial: false,
    isHotRedeem: true,
    isNewArrival: false,
    specs: [
      { name: '规格重量', options: ['10kg/袋', '5kg/袋*2', '2.5kg*4真空装'] }
    ],
    params: [
      { key: '产地', value: '黑龙江省哈尔滨市五常市' },
      { key: '保质期', value: '12个月' },
      { key: '产品标准号', value: 'GB/T 19266' },
      { key: '贮藏方法', value: '置于阴凉干燥处通风保存' }
    ],
    descriptionDetailText: [
      '选自黑龙江五常核心产区，黑土地肥沃，日照充分，灌溉采用拉林河纯净水系。',
      '精选优质稻花香2号品种，经过18道严苛工序脱壳精磨，附带国家有机认证二维码。',
      '煮熟后饭粒晶莹剔透，油亮粘香，冷却后不回生，是广大企业员工生活福利的首选佳品。'
    ],
    distributorId: 'DIST-001-GW'
  },

  // 2. 特级初榨橄榄油礼盒
  {
    id: 'p_102',
    title: '欧丽薇兰 特级初榨橄榄油礼盒 750ml*2瓶 双瓶双礼袋装',
    subtitle: '西班牙原瓶进口，冷榨纯正，健康油脂首选',
    images: [
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1541256942802-7b29531f0df8?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 268.00,
    priceMall: 218.00,
    priceWelfare: 168.00,
    categoryId: 'cat_food',
    categoryName: '米面粮油',
    subCategoryId: 'sub_food_1',
    brand: '欧丽薇兰',
    tags: ['原瓶进口', '冷压初榨', '节日送礼'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 890,
    salesCount: 6540,
    rating: 4.8,
    reviewCount: 1120,
    deliverySla: '京东物流当日发',
    isEnterpriseExclusive: false,
    isDailySpecial: true,
    isHotRedeem: true,
    specs: [
      { name: '包装类型', options: ['750ml*2礼盒装', '1L*2经典装'] }
    ],
    params: [
      { key: '原产国', value: '西班牙' },
      { key: '酸度', value: '≤0.8%' },
      { key: '加工工艺', value: '物理冷榨' }
    ],
    descriptionDetailText: [
      '选用西班牙橄榄庄园优质鲜果，24小时内物理冷榨，完整保留单不饱合脂肪酸。',
      '适合凉拌、煎炒及西餐烹饪，高档烫金精致礼盒包装，附赠专属礼品袋。'
    ],
    distributorId: 'DIST-001-GW'
  },

  // 3. 坚果礼盒
  {
    id: 'p_103',
    title: '三只松鼠 坚果礼盒 坚果大礼包 1580g/袋 内含9袋纯坚果',
    subtitle: '开心果/腰果/核桃仁/巴旦木，每日健康能量补充',
    images: [
      'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 198.00,
    priceMall: 148.00,
    priceWelfare: 108.00,
    categoryId: 'cat_food',
    categoryName: '休闲零食',
    subCategoryId: 'sub_food_2',
    brand: '三只松鼠',
    tags: ['爆款推荐', '零罐装纯坚果', '员工关怀'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 3100,
    salesCount: 24000,
    rating: 4.9,
    reviewCount: 5600,
    deliverySla: '次日达',
    isEnterpriseExclusive: true,
    isDailySpecial: true,
    isHotRedeem: true,
    specs: [
      { name: '礼盒规格', options: ['1580g纯坚果款', '2100g全家福款'] }
    ],
    descriptionDetailText: [
      '严选全球九大产区鲜果，轻烘焙无添加，保留坚果原生自然香气与营养成分。'
    ],
    distributorId: 'DIST-001-GW'
  },

  // 4. 西湖龙井茶叶
  {
    id: 'p_104',
    title: '【明前特级】西湖龙井茶 2026新茶 瓷罐手工礼盒 250g',
    subtitle: '核心产区狮峰山脉，手工炒制，豆香浓郁，叶底细嫩',
    images: [
      'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 680.00,
    priceMall: 480.00,
    priceWelfare: 360.00,
    categoryId: 'cat_food',
    categoryName: '冲调茶饮',
    subCategoryId: 'sub_food_3',
    brand: '贡牌',
    tags: ['明前采摘', '非遗大师炒制', '高端商务礼'],
    supplierId: 'sup_03',
    supplierName: '集团特选供应',
    supplierType: 'group_owned',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 450,
    salesCount: 1280,
    rating: 4.95,
    reviewCount: 420,
    deliverySla: '顺丰包邮3日内到达',
    isEnterpriseExclusive: true,
    isNewArrival: true,
    descriptionDetailText: [
      '采自清明前第一批嫩芽，一芽一叶，经老茶农传统平锅炒制，汤色杏绿明亮。'
    ],
    distributorId: 'DIST-001-GW'
  },

  // 5. 戴森吸尘器
  {
    id: 'p_201',
    title: '戴森 (Dyson) V12 Detect Slim Total Clean 无线手持吸尘器',
    subtitle: '激光探测微尘，智能防缠绕，140AW强劲吸力，轻量化设计',
    images: [
      'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 4499.00,
    priceMall: 3999.00,
    priceWelfare: 3299.00,
    categoryId: 'cat_appliance',
    categoryName: '家用电器',
    brand: 'Dyson 戴森',
    tags: ['科技大牌', '正品联保', '拆封不退'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 120,
    salesCount: 890,
    rating: 4.9,
    reviewCount: 230,
    deliverySla: '京东配送24H到达',
    isEnterpriseExclusive: true,
    specs: [
      { name: '颜色分类', options: ['金色款', '镍银色旗舰款'] }
    ],
    descriptionDetailText: ['戴森光学探测技术，让肉眼看不见的微尘无所遁形。配备液晶显示屏实时显示清洁效果。'],
    distributorId: 'DIST-001-GW'
  },

  // 6. 九阳多功能空气炸锅
  {
    id: 'p_202',
    title: '九阳 (Joyoung) 5.5L大容量可视空气炸锅 无需翻面 智能触摸屏',
    subtitle: '全景环透大视窗，热风循环免翻面，脱脂减油健康美味',
    images: [
      'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 399.00,
    priceMall: 299.00,
    priceWelfare: 219.00,
    categoryId: 'cat_appliance',
    categoryName: '家用电器',
    brand: '九阳',
    tags: ['热销爆款', '餐卡/福利卡可用', '家用首选'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 1500,
    salesCount: 8900,
    rating: 4.85,
    reviewCount: 1800,
    deliverySla: '次日达',
    isDailySpecial: true,
    isHotRedeem: true,
    specs: [
      { name: '容量大小', options: ['5.5L可视款', '4.5L标准款'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 7. 飞利浦电动牙刷
  {
    id: 'p_203',
    title: '飞利浦 (Philips) 声波震动电动牙刷 HX6809 优雅粉/皓白色 双刷头套组',
    subtitle: '31000次/分高频震动，智能压力感应护龈，杜邦护龈刷毛',
    images: [
      'https://images.unsplash.com/photo-1559656914-a30970c1affd?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 499.00,
    priceMall: 369.00,
    priceWelfare: 289.00,
    categoryId: 'cat_appliance',
    categoryName: '家用电器',
    brand: 'Philips 飞利浦',
    tags: ['个人健康', '两年联保', '送替换刷头'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 640,
    salesCount: 3400,
    rating: 4.9,
    reviewCount: 750,
    deliverySla: '京东快递24H到达',
    specs: [
      { name: '颜色款式', options: ['皓白色 HX6809/01', '优雅粉 HX6809/02'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 8. 罗技机械键盘
  {
    id: 'p_301',
    title: '罗技G (Logitech G) G610 红轴机械键盘 黑色全尺寸 办公游戏双宜',
    subtitle: '原厂Cherry MX轴体，白色背光，人体工学高低键帽',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 599.00,
    priceMall: 449.00,
    priceWelfare: 359.00,
    categoryId: 'cat_digital',
    categoryName: '数码办公',
    brand: 'Logitech 罗技',
    tags: ['办公利器', '静音红轴', '官方正品'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 420,
    salesCount: 2100,
    rating: 4.88,
    reviewCount: 610,
    deliverySla: '次日达',
    specs: [
      { name: '轴体选择', options: ['Cherry红轴(静音推荐)', 'Cherry茶轴(段落感)'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 9. 索尼主动降噪耳机
  {
    id: 'p_302',
    title: '索尼 (SONY) WH-1000XM5 无线头戴式主动降噪耳机 银黑色',
    subtitle: '双芯片驱动，8麦克风降噪系统，30小时超长续航，高清通话',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 2999.00,
    priceMall: 2499.00,
    priceWelfare: 2099.00,
    categoryId: 'cat_digital',
    categoryName: '数码办公',
    brand: 'SONY 索尼',
    tags: ['商务差旅', '极致降噪', '国行正品'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 180,
    salesCount: 1560,
    rating: 4.94,
    reviewCount: 430,
    deliverySla: '京东快递24H到达',
    specs: [
      { name: '配色方案', options: ['铂金银', '黑色经典', '深邃蓝限量版'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 10. 桑蚕丝被
  {
    id: 'p_401',
    title: '水星家纺 100%双宫蚕丝被 200*230cm 净重2斤 春秋被礼盒装',
    subtitle: '双宫特级桑蚕丝，全棉高密面料，亲肤透气吸湿',
    images: [
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 1299.00,
    priceMall: 899.00,
    priceWelfare: 620.00,
    categoryId: 'cat_home',
    categoryName: '家居日用',
    brand: '水星家纺',
    tags: ['100%纯蚕丝', '品质寝具', '送礼臻选'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 530,
    salesCount: 3100,
    rating: 4.9,
    reviewCount: 890,
    deliverySla: '次日达',
    isHotRedeem: true,
    specs: [
      { name: '尺寸与充填量', options: ['200*230cm (2斤春秋被)', '220*240cm (3斤加厚被)'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 11. 膳魔师保温杯套组
  {
    id: 'p_402',
    title: '膳魔师 (THERMOS) 316L不锈钢保温杯 500ml 弹盖双饮触控温显礼盒',
    subtitle: '24小时保温保冷，长效锁温，轻量杯身，企业定制烫印首选',
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 299.00,
    priceMall: 199.00,
    priceWelfare: 139.00,
    categoryId: 'cat_home',
    categoryName: '家居日用',
    brand: 'THERMOS 膳魔师',
    tags: ['办公常备', '保温神器', '福利硬通货'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 2200,
    salesCount: 14200,
    rating: 4.92,
    reviewCount: 3100,
    deliverySla: '次日达',
    isDailySpecial: true,
    specs: [
      { name: '颜色外观', options: ['哑光黑', '珍珠白', '海军蓝'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 12. 飞利浦男士剃须刀
  {
    id: 'p_501',
    title: '飞利浦 (Philips) 全自动电动剃须刀 S5000系列 乾湿双剃 赠鼻毛修剪器',
    subtitle: '微珠舒适圈，感应自适应切剃，全身水洗，1小时快充',
    images: [
      'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 699.00,
    priceMall: 499.00,
    priceWelfare: 369.00,
    categoryId: 'cat_personal',
    categoryName: '个护清洁',
    brand: 'Philips 飞利浦',
    tags: ['男士专享', '全身水洗', '送充电底座'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 780,
    salesCount: 4200,
    rating: 4.88,
    reviewCount: 930,
    deliverySla: '京东快递24H到达',
    distributorId: 'DIST-001-GW'
  },

  // ---------------- Virtual Vouchers & Movie Tickets ----------------

  // 13. 全国影院2D/3D电影通用兑换券 (Movie Ticket)
  {
    id: 'p_601',
    title: '【全国通用】猫眼/淘票票 电影票通兑券 (含IMAX/杜比厅补差兑换)',
    subtitle: '即时发码，全国99%影院通用，支持在线选座，有效期12个月',
    images: [
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 70.00,
    priceMall: 50.00,
    priceWelfare: 35.00,
    categoryId: 'cat_movie',
    categoryName: '电影娱乐',
    subCategoryId: 'sub_mov_1',
    brand: '猫眼娱乐',
    tags: ['电子发码', '即时生效', '餐卡/福利卡可用'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'movie_ticket',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 9999,
    salesCount: 58000,
    rating: 4.96,
    reviewCount: 12400,
    deliverySla: '系统即时自动发码',
    isEnterpriseExclusive: true,
    isHotRedeem: true,
    specs: [
      { name: '面值套组', options: ['单人通兑券1张', '双人通兑套餐(含爆米花可乐)'] }
    ],
    descriptionDetailText: [
      '购买后凭兑换码在【我的卡券】中直接查看，复制核销码可在猫眼/淘票票APP选座下单时作为立减优惠码抵扣。',
      '支持万达影城、博纳国际影城、CGV、金逸等全国绝大部分院线。'
    ],
    distributorId: 'DIST-001-GW'
  },

  // 14. 万达影城双人观影爆米花套餐 (Movie Ticket)
  {
    id: 'p_602',
    title: '万达影城 2D/3D电影双人票 + 爆米花双杯饮品套餐兑换券',
    subtitle: '线下万达影院出示二维码直接核销，超值企业员工情侣观影首选',
    images: [
      'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 160.00,
    priceMall: 110.00,
    priceWelfare: 88.00,
    categoryId: 'cat_movie',
    categoryName: '电影娱乐',
    brand: '万达影城',
    tags: ['万达专享', '含小食套餐', '扫码即核销'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'movie_ticket',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 5000,
    salesCount: 18200,
    rating: 4.91,
    reviewCount: 3200,
    deliverySla: '即时发码',
    distributorId: 'DIST-001-GW'
  },

  // 15. 星巴克100元电子星礼卡 (Virtual Voucher)
  {
    id: 'p_701',
    title: '【官方充值】星巴克 (Starbucks) 100元电子星礼卡 自动绑定',
    subtitle: '微信/星巴克APP直接扫码支付，可分次消费，全国门店通用',
    images: [
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 100.00,
    priceMall: 98.00,
    priceWelfare: 88.00,
    categoryId: 'cat_virtual',
    categoryName: '虚拟卡券',
    subCategoryId: 'sub_vir_1',
    brand: '星巴克',
    tags: ['官方电子卡', '餐卡可用', '永不过期'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'virtual_coupon',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 8000,
    salesCount: 41000,
    rating: 4.98,
    reviewCount: 8900,
    deliverySla: '即时发码',
    isDailySpecial: true,
    isHotRedeem: true,
    specs: [
      { name: '卡面金额', options: ['100元电子卡', '200元电子卡', '500元电子卡'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 16. 京东E卡200元 (Virtual Voucher)
  {
    id: 'p_702',
    title: '【官方直发】京东E卡 200元面值 经典电子卡 账号自动卡密',
    subtitle: '适用于京东自营商品，绑定即用，有效期3年，可多张叠加',
    images: [
      'https://images.unsplash.com/photo-1556742049-0a670f4a4591?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 200.00,
    priceMall: 198.00,
    priceWelfare: 188.00,
    categoryId: 'cat_virtual',
    categoryName: '虚拟卡券',
    brand: '京东',
    tags: ['硬通货', '卡密自动直发', '福利卡可用'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'virtual_coupon',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 12000,
    salesCount: 95000,
    rating: 4.99,
    reviewCount: 23000,
    deliverySla: '即时发码',
    isEnterpriseExclusive: true,
    specs: [
      { name: '面值规格', options: ['200元卡密', '500元卡密', '1000元卡密'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 17. 爱奇艺黄金VIP年卡 (Virtual Voucher)
  {
    id: 'p_703',
    title: '【直充填号】爱奇艺黄金VIP会员12个月年卡 手机/电脑/平板通用',
    subtitle: '输入手机号直接秒充到账，海量热播大剧免广告高清观看',
    images: [
      'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 248.00,
    priceMall: 178.00,
    priceWelfare: 128.00,
    categoryId: 'cat_virtual',
    categoryName: '虚拟卡券',
    subCategoryId: 'sub_vir_2',
    brand: '爱奇艺',
    tags: ['官方秒充', '视听娱乐', '特惠打折'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'virtual_coupon',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 3500,
    salesCount: 16700,
    rating: 4.9,
    reviewCount: 2900,
    deliverySla: '系统即时充值',
    distributorId: 'DIST-001-GW'
  },

  // 18. 盒马鲜生500元储值卡 (Supermarket)
  {
    id: 'p_801',
    title: '【商超通兑】盒马鲜生 500元电子礼品卡/储值卡 盒马APP绑定使用',
    subtitle: '线上App及线下盒马门店通用，支持买生鲜、烘焙、零食',
    images: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 500.00,
    priceMall: 490.00,
    priceWelfare: 450.00,
    categoryId: 'cat_supermarket',
    categoryName: '商超商品',
    brand: '盒马鲜生',
    tags: ['餐卡必选', '生鲜商超', '线上线下通用'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'supermarket',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 2000,
    salesCount: 12900,
    rating: 4.95,
    reviewCount: 3800,
    deliverySla: '即时发码',
    isEnterpriseExclusive: true,
    isHotRedeem: true,
    specs: [
      { name: '面额选择', options: ['200元电子卡', '500元电子卡', '1000元电子卡'] }
    ],
    distributorId: 'DIST-001-GW'
  },

  // 19. 永辉超市电子礼品卡300元 (Supermarket)
  {
    id: 'p_802',
    title: '永辉超市 300元电子购物卡 全国永辉门店及永辉生活APP通用',
    subtitle: '不限品类，餐卡余额直接兑换，线下扫码直接抵扣现金',
    images: [
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 300.00,
    priceMall: 295.00,
    priceWelfare: 270.00,
    categoryId: 'cat_supermarket',
    categoryName: '商超商品',
    brand: '永辉超市',
    tags: ['生活采买', '餐卡专享', '全国门店'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'supermarket',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 4500,
    salesCount: 22000,
    rating: 4.9,
    reviewCount: 4500,
    deliverySla: '即时发码',
    distributorId: 'DIST-001-GW'
  },

  // 20. 途虎养车 精细洗车+全车检查 (Nearby Store)
  {
    id: 'p_901',
    title: '【附近门店】途虎养车 标准精致洗车服务 + 18项全车整车安全检测券',
    subtitle: '全国3000+途虎工场店通用，凭二维码到店即洗，含轮胎与刹车检测',
    images: [
      'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 65.00,
    priceMall: 45.00,
    priceWelfare: 29.00,
    categoryId: 'cat_nearby',
    categoryName: '附近门店',
    brand: '途虎养车',
    tags: ['到店核销', '汽车服务', '无隐形消费'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'nearby_store',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 6000,
    salesCount: 15400,
    rating: 4.88,
    reviewCount: 2300,
    deliverySla: '即时到账凭码核销',
    nearbyStoreInfo: {
      storeName: '途虎养车工场店 (金融街店)',
      address: '北京市西城区太平桥大街105号',
      distance: '0.8km',
      businessHours: '08:30 - 19:30',
      phone: '010-88392011'
    },
    distributorId: 'DIST-001-GW'
  },

  // 21. 58到家 3小时家庭深度保洁 (Life Service)
  {
    id: 'p_902',
    title: '【生活服务】58到家 3小时全屋家庭深度保洁兑换券 预约上门',
    subtitle: '专业保洁师自带专业清洁工具套组，全屋除尘抹擦，不满意免费重打扫',
    images: [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 180.00,
    priceMall: 140.00,
    priceWelfare: 105.00,
    categoryId: 'cat_nearby',
    categoryName: '生活服务',
    brand: '58到家',
    tags: ['上门服务', '免手洗', '家政首选'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'life_service',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 1200,
    salesCount: 4300,
    rating: 4.86,
    reviewCount: 920,
    deliverySla: '兑换码在线预约',
    distributorId: 'DIST-001-GW'
  },

  // 22. 好利来/味多美100元蛋糕烘焙券 (Nearby Store)
  {
    id: 'p_903',
    title: '【附近门店】好利来 (Holiland) 100元全场烘焙蛋糕通兑券',
    subtitle: '适用于面包、半熟芝士、生日蛋糕，线下门店扫码即可核销抵扣',
    images: [
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 100.00,
    priceMall: 95.00,
    priceWelfare: 82.00,
    categoryId: 'cat_nearby',
    categoryName: '附近门店',
    brand: '好利来',
    tags: ['餐卡可用', '甜蜜烘焙', '门店核销'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'nearby_store',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 3200,
    salesCount: 18900,
    rating: 4.93,
    reviewCount: 2800,
    deliverySla: '即时发码到店扫码',
    nearbyStoreInfo: {
      storeName: '好利来 Holiland (金融街购物中心店)',
      address: '北京市西城区金城坊街2号B1楼',
      distance: '0.3km',
      businessHours: '09:00 - 21:30',
      phone: '010-66221188'
    },
    distributorId: 'DIST-001-GW'
  },

  // 23. 企业端午粽礼盒 (Enterprise Welfare Zone)
  {
    id: 'p_w01',
    title: '【企业福利专享】五芳斋 臻品情系端午粽子礼盒 1.8kg (12粽4鸭蛋)',
    subtitle: '大肉粽/蛋黄细沙/高汤粽，国企团购大客户专属定制礼盒包装',
    images: [
      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 228.00,
    priceMall: 168.00,
    priceWelfare: 128.00,
    categoryId: 'cat_welfare_zone',
    categoryName: '企业福利专区',
    brand: '五芳斋',
    tags: ['集团采购', '端午礼盒', '企业配发'],
    supplierId: 'sup_03',
    supplierName: '集团特选供应',
    supplierType: 'group_owned',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 5000,
    salesCount: 42000,
    rating: 4.95,
    reviewCount: 8900,
    deliverySla: '批量地址与单件派送均可',
    isEnterpriseExclusive: true,
    isHotRedeem: true,
    distributorId: 'DIST-001-GW'
  },

  // 24. 中秋月饼尊享礼盒 (Enterprise Welfare Zone)
  {
    id: 'p_w02',
    title: '【企业福利专享】美心 (MX) 双黄白莲蓉月饼礼盒 740g 港式经典',
    subtitle: '100%香港制造，莲蓉细腻，咸蛋黄流油，央企中秋关怀优选',
    images: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 338.00,
    priceMall: 288.00,
    priceWelfare: 228.00,
    categoryId: 'cat_welfare_zone',
    categoryName: '企业福利专区',
    brand: '美心 MX',
    tags: ['港式经典', '中秋臻选', '高端送礼'],
    supplierId: 'sup_03',
    supplierName: '集团特选供应',
    supplierType: 'group_owned',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 2400,
    salesCount: 19800,
    rating: 4.97,
    reviewCount: 3400,
    deliverySla: '专人冷链派送',
    isEnterpriseExclusive: true,
    distributorId: 'DIST-001-GW'
  },

  // 25. 瑞幸咖啡10张饮品通兑券 (Virtual Voucher)
  {
    id: 'p_704',
    title: '【办公提神】瑞幸咖啡 (luckin coffee) 29元饮品券*10张 套券',
    subtitle: '生椰拿铁/生酪拿铁/厚乳拿铁通用，支持App及小程序点单自由核销',
    images: [
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 290.00,
    priceMall: 180.00,
    priceWelfare: 135.00,
    categoryId: 'cat_virtual',
    categoryName: '虚拟卡券',
    brand: '瑞幸咖啡',
    tags: ['餐卡可用', '提神咖啡', '卡包分次用'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'virtual_coupon',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 9000,
    salesCount: 52000,
    rating: 4.94,
    reviewCount: 11000,
    deliverySla: '即时发码',
    isDailySpecial: true,
    distributorId: 'DIST-001-GW'
  },

  // 26. 飞利浦空气净化器
  {
    id: 'p_204',
    title: '飞利浦 (Philips) 除甲醛空气净化器 AC3030 适用面积50平米 降噪除菌',
    subtitle: '微米级过滤，实时数值显示PM2.5/甲醛浓度，企业办公及家庭两用',
    images: [
      'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 2499.00,
    priceMall: 1899.00,
    priceWelfare: 1450.00,
    categoryId: 'cat_appliance',
    categoryName: '家用电器',
    brand: 'Philips 飞利浦',
    tags: ['健康防护', '强效除甲醛', '品质保修'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 210,
    salesCount: 1100,
    rating: 4.89,
    reviewCount: 290,
    deliverySla: '次日达',
    distributorId: 'DIST-001-GW'
  },

  // 27. 德亚全脂纯牛奶
  {
    id: 'p_105',
    title: '德亚 (Weidendorf) 德国进口全脂纯牛奶 200ml*24盒 整箱装',
    subtitle: '原生高蛋白3.3g/100ml，优质乳源，家庭与员工每日营养首选',
    images: [
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 89.00,
    priceMall: 69.00,
    priceWelfare: 49.00,
    categoryId: 'cat_food',
    categoryName: '食品饮料',
    brand: '德亚',
    tags: ['德国进口', '餐卡扣减', '高钙高蛋白'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'meal', 'wechat'],
    stock: 4200,
    salesCount: 28000,
    rating: 4.9,
    reviewCount: 6200,
    deliverySla: '次日达',
    isDailySpecial: true,
    isHotRedeem: true,
    distributorId: 'DIST-001-GW'
  },

  // 28. 小米体脂秤S400 Pro
  {
    id: 'p_303',
    title: '小米体脂秤 S400 Pro 双频心率体脂检测 25项身体数据 蓝牙连接',
    subtitle: '精准测脂，高精度BIA芯片，米家App数据同步管理全家健康',
    images: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 149.00,
    priceMall: 119.00,
    priceWelfare: 89.00,
    categoryId: 'cat_digital',
    categoryName: '数码办公',
    brand: '小米',
    tags: ['健康管理', '智能互联', '性价比高'],
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    itemType: 'physical',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 1900,
    salesCount: 14200,
    rating: 4.87,
    reviewCount: 2100,
    deliverySla: '次日达',
    distributorId: 'DIST-001-GW'
  },

  // 29. 威尔仕健身房全国通用周卡 (Nearby Store)
  {
    id: 'p_904',
    title: '【附近门店】威尔仕健身 (Will\'s) 7天体验周卡 含泳池及团操课',
    subtitle: '包含器械区、有氧区、恒温游泳池及瑜伽操课，凭码直接入场体验',
    images: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 280.00,
    priceMall: 150.00,
    priceWelfare: 99.00,
    categoryId: 'cat_nearby',
    categoryName: '附近门店',
    brand: 'Will\'s 威尔仕',
    tags: ['健康运动', '恒温泳池', '到店核销'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'nearby_store',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 800,
    salesCount: 2300,
    rating: 4.82,
    reviewCount: 410,
    deliverySla: '即时到账',
    nearbyStoreInfo: {
      storeName: '威尔仕健身 Will\'s (金融街央企会所店)',
      address: '北京市西城区成方街33号B2层',
      distance: '0.5km',
      businessHours: '07:00 - 22:30',
      phone: '010-83210988'
    },
    distributorId: 'DIST-001-GW'
  },

  // 30. 腾讯视频超级影视VIP年卡 (Virtual Voucher)
  {
    id: 'p_705',
    title: '【直充填号】腾讯视频超级影视VIP 12个月年卡 支持电视/手机/电脑',
    subtitle: '云视听极光电视端通用，4K杜比视界，账号秒充到账',
    images: [
      'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=600&auto=format&fit=crop&q=80'
    ],
    priceMarket: 488.00,
    priceMall: 328.00,
    priceWelfare: 248.00,
    categoryId: 'cat_virtual',
    categoryName: '虚拟卡券',
    brand: '腾讯视频',
    tags: ['全端通用', '电视看大片', '官方直充'],
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    itemType: 'virtual_coupon',
    allowedAccounts: ['welfare', 'wechat'],
    stock: 2900,
    salesCount: 14000,
    rating: 4.91,
    reviewCount: 2200,
    deliverySla: '即时充值',
    distributorId: 'DIST-001-GW'
  }
];

export const MOCK_ORDERS: Order[] = [
  // 1. 待付款订单
  {
    id: 'ord_1001',
    orderNo: 'ORD202607230001',
    enterpriseId: 'ent_gw',
    enterpriseName: '国家电网有限公司',
    mallId: 'mall_gw',
    mallName: '国网员工企业福利专享商城',
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    status: 'pending_payment',
    createTime: '2026-07-23 15:40:12',
    items: [
      {
        productId: 'p_201',
        productTitle: '戴森 (Dyson) V12 Detect Slim Total Clean 无线手持吸尘器',
        productImage: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80',
        price: 3299.00,
        quantity: 1,
        specText: '金色款',
        itemType: 'physical'
      }
    ],
    address: MOCK_ADDRESSES[0],
    payment: {
      totalGoodsAmount: 3299.00,
      shippingFee: 0,
      welfareDeducted: 3000.00,
      mealDeducted: 0,
      wechatPaid: 299.00,
      finalPaidAmount: 3299.00,
      payMethodText: '福利卡余额 (¥3000) + 微信补差 (¥299)'
    },
    userRemark: '请发京东快递，送达前电话联系',
    distributorId: 'DIST-001-GW'
  },

  // 2. 待发货订单
  {
    id: 'ord_1002',
    orderNo: 'ORD202607228812',
    enterpriseId: 'ent_gw',
    enterpriseName: '国家电网有限公司',
    mallId: 'mall_gw',
    mallName: '国网员工企业福利专享商城',
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    status: 'pending_shipment',
    createTime: '2026-07-22 18:20:00',
    items: [
      {
        productId: 'p_101',
        productTitle: '【集团专享】柴火大院 核心产区五常有机大米 10kg/袋 附有机认证',
        productImage: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
        price: 98.00,
        quantity: 2,
        specText: '10kg/袋',
        itemType: 'physical'
      },
      {
        productId: 'p_103',
        productTitle: '三只松鼠 坚果礼盒 坚果大礼包 1580g/袋',
        productImage: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&auto=format&fit=crop&q=80',
        price: 108.00,
        quantity: 1,
        specText: '1580g纯坚果款',
        itemType: 'physical'
      }
    ],
    address: MOCK_ADDRESSES[0],
    payment: {
      totalGoodsAmount: 304.00,
      shippingFee: 0,
      welfareDeducted: 200.00,
      mealDeducted: 104.00,
      wechatPaid: 0,
      finalPaidAmount: 304.00,
      payMethodText: '福利卡 (¥200) + 餐卡 (¥104)',
      paidAt: '2026-07-22 18:21:05'
    },
    distributorId: 'DIST-001-GW'
  },

  // 3. 待收货订单
  {
    id: 'ord_1003',
    orderNo: 'ORD202607210928',
    enterpriseId: 'ent_gw',
    enterpriseName: '国家电网有限公司',
    mallId: 'mall_gw',
    mallName: '国网员工企业福利专享商城',
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    status: 'pending_receipt',
    createTime: '2026-07-21 10:15:30',
    items: [
      {
        productId: 'p_402',
        productTitle: '膳魔师 (THERMOS) 316L不锈钢保温杯 500ml 哑光黑',
        productImage: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80',
        price: 139.00,
        quantity: 1,
        specText: '哑光黑',
        itemType: 'physical'
      }
    ],
    address: MOCK_ADDRESSES[1],
    payment: {
      totalGoodsAmount: 139.00,
      shippingFee: 0,
      welfareDeducted: 139.00,
      mealDeducted: 0,
      wechatPaid: 0,
      finalPaidAmount: 139.00,
      payMethodText: '福利卡余额全额抵扣',
      paidAt: '2026-07-21 10:16:00'
    },
    expressCompany: '顺丰速运',
    trackingNo: 'SF1409281029388',
    distributorId: 'DIST-001-GW'
  },

  // 4. 已完成订单 (虚拟卡券/电影票已发码)
  {
    id: 'ord_1004',
    orderNo: 'ORD202607204481',
    enterpriseId: 'ent_gw',
    enterpriseName: '国家电网有限公司',
    mallId: 'mall_gw',
    mallName: '国网员工企业福利专享商城',
    supplierId: 'sup_02',
    supplierName: '平台自营仓',
    supplierType: 'self_operated',
    status: 'completed',
    createTime: '2026-07-20 14:02:10',
    items: [
      {
        productId: 'p_601',
        productTitle: '【全国通用】猫眼/淘票票 电影票通兑券',
        productImage: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80',
        price: 35.00,
        quantity: 2,
        specText: '单人通兑券2张',
        itemType: 'movie_ticket',
        verificationCode: 'MOVIE-8891-9021-3312'
      }
    ],
    payment: {
      totalGoodsAmount: 70.00,
      shippingFee: 0,
      welfareDeducted: 70.00,
      mealDeducted: 0,
      wechatPaid: 0,
      finalPaidAmount: 70.00,
      payMethodText: '福利卡余额抵扣',
      paidAt: '2026-07-20 14:02:11'
    },
    verificationCode: 'MOVIE-8891-9021-3312',
    distributorId: 'DIST-001-GW'
  },

  // 5. 售后中订单
  {
    id: 'ord_1005',
    orderNo: 'ORD202607182210',
    enterpriseId: 'ent_gw',
    enterpriseName: '国家电网有限公司',
    mallId: 'mall_gw',
    mallName: '国网员工企业福利专享商城',
    supplierId: 'sup_01',
    supplierName: '京东供应链',
    supplierType: 'third_party',
    status: 'after_sale',
    createTime: '2026-07-18 09:12:00',
    items: [
      {
        productId: 'p_202',
        productTitle: '九阳 (Joyoung) 5.5L大容量可视空气炸锅',
        productImage: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
        price: 219.00,
        quantity: 1,
        specText: '5.5L可视款',
        itemType: 'physical'
      }
    ],
    address: MOCK_ADDRESSES[0],
    payment: {
      totalGoodsAmount: 219.00,
      shippingFee: 0,
      welfareDeducted: 219.00,
      mealDeducted: 0,
      wechatPaid: 0,
      finalPaidAmount: 219.00,
      payMethodText: '福利卡余额全额抵扣',
      paidAt: '2026-07-18 09:12:45'
    },
    distributorId: 'DIST-001-GW'
  }
];

export const MOCK_ACCOUNT_LOGS: AccountLog[] = [
  {
    id: 'log_01',
    accountType: 'welfare',
    title: '2026二季度企业关怀福利补贴发放',
    amount: 3500.00,
    direction: 'in',
    time: '2026-07-01 09:00:00',
    balanceAfter: 6380.00,
    remark: '公司人力资源部统一发放'
  },
  {
    id: 'log_02',
    accountType: 'welfare',
    title: '购买：戴森V12吸尘器订单预扣',
    amount: -3000.00,
    direction: 'out',
    orderNo: 'ORD202607230001',
    time: '2026-07-23 15:40:12',
    balanceAfter: 3380.00,
    remark: '福利卡抵扣支出'
  },
  {
    id: 'log_03',
    accountType: 'welfare',
    title: '购买：膳魔师保温杯全额抵扣',
    amount: -139.00,
    direction: 'out',
    orderNo: 'ORD202607210928',
    time: '2026-07-21 10:16:00',
    balanceAfter: 3241.00,
    remark: '福利卡抵扣支出'
  },
  {
    id: 'log_04',
    accountType: 'meal',
    title: '月度餐补定额打款',
    amount: 800.00,
    direction: 'in',
    time: '2026-07-01 09:00:00',
    balanceAfter: 954.50,
    remark: '集团餐卡统筹发放'
  },
  {
    id: 'log_05',
    accountType: 'meal',
    title: '购买：五常大米&坚果礼盒部分抵扣',
    amount: -104.00,
    direction: 'out',
    orderNo: 'ORD202607228812',
    time: '2026-07-22 18:21:05',
    balanceAfter: 850.50,
    remark: '餐卡抵扣支出'
  }
];

export const MOCK_USER_COUPONS: UserCoupon[] = [
  {
    id: 'cpn_01',
    type: 'movie_ticket',
    title: '全国影院2D/3D电影通兑券',
    faceValue: 35.00,
    code: 'MY-2026-8819-2091',
    expiryDate: '2027-07-20',
    status: 'unused',
    usageRules: [
      '凭此码在猫眼/淘票票下单选座输入兑换码可抵扣35元',
      '全国万达、博纳、CGV等主流影城通用',
      '不可兑换现金，逾期自动作废'
    ],
    sourceOrderNo: 'ORD202607204481',
    distributorId: 'DIST-001-GW'
  },
  {
    id: 'cpn_02',
    type: 'virtual_coupon',
    title: '星巴克100元电子星礼卡',
    faceValue: 100.00,
    code: 'SBUX-9981-2210-4491',
    expiryDate: '2029-12-31',
    status: 'unused',
    usageRules: [
      '全国星巴克线下门店扫码扣款，支持分次消费',
      '可在星巴克App中绑定到个人账户'
    ],
    distributorId: 'DIST-001-GW'
  },
  {
    id: 'cpn_03',
    type: 'nearby_store',
    title: '好利来100元烘焙全场通用抵扣券',
    faceValue: 100.00,
    code: 'HL-2026-5541-1182',
    expiryDate: '2026-10-31',
    status: 'unused',
    storeName: '好利来 Holiland (金融街购物中心店)',
    storeAddress: '北京市西城区金城坊街2号B1楼',
    usageRules: [
      '限好利来指定门店出示二维码核销',
      '不找零、不兑现，可叠加餐卡使用'
    ],
    distributorId: 'DIST-001-GW'
  },
  {
    id: 'cpn_04',
    type: 'nearby_store',
    title: '途虎养车 精致洗车+18项检测券',
    faceValue: 45.00,
    code: 'TUHU-7721-0091',
    expiryDate: '2026-09-30',
    status: 'unused',
    storeName: '途虎养车工场店 (金融街店)',
    storeAddress: '北京市西城区太平桥大街105号',
    usageRules: ['凭券到店直接扫码核销', '包含外观清洗及车胎测压检测'],
    distributorId: 'DIST-001-GW'
  },
  {
    id: 'cpn_05',
    type: 'supermarket',
    title: '盒马鲜生 200元电子储值卡',
    faceValue: 200.00,
    code: 'HEMA-3312-9901',
    expiryDate: '2027-01-15',
    status: 'used',
    usageRules: ['盒马App在线支付或线下门店结账出示'],
    distributorId: 'DIST-001-GW'
  },
  {
    id: 'cpn_06',
    type: 'virtual_coupon',
    title: '爱奇艺黄金VIP年卡兑换码',
    faceValue: 178.00,
    code: 'IQIYI-8800-1122-3344',
    expiryDate: '2026-06-01',
    status: 'expired',
    usageRules: ['在爱奇艺兑换中心输入充值代码'],
    distributorId: 'DIST-001-GW'
  }
];

export const MOCK_AFTER_SALES: AfterSaleRecord[] = [
  {
    id: 'as_01',
    afterSaleNo: 'AS20260719001',
    orderId: 'ord_1005',
    orderNo: 'ORD202607182210',
    supplierName: '京东供应链',
    applyTime: '2026-07-19 11:30:00',
    reason: '商品外包装轻微挤压，申请更换新机器',
    type: 'exchange',
    status: 'processing',
    refundAmount: 219.00,
    description: '收到快递时包装盒有磕碰痕迹，机器暂未拆封，希望更换一件完好无损的礼盒包装发货。',
    items: [
      {
        productId: 'p_202',
        productTitle: '九阳 (Joyoung) 5.5L大容量可视空气炸锅',
        productImage: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
        price: 219.00,
        quantity: 1,
        specText: '5.5L可视款',
        itemType: 'physical'
      }
    ],
    distributorId: 'DIST-001-GW'
  }
];
