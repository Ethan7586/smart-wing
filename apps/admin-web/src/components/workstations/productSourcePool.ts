import type { Product } from '../../types';
import { type WhyouyePoolSource } from '../../services/whyouyeProductPool';

export type SourceKey = 'all' | 'jd' | 'jdFresh' | 'tmall' | 'gift' | 'platform' | 'virtualCard' | 'virtualTopup' | 'giftPack' | 'cake' | 'books';
export type CampaignKey = '精选商品池' | '折扣仓' | '中秋礼包专区' | '送清凉专区' | '七夕专区' | '京东京造+猫超甄选';

export type PartnerSource = { key: SourceKey; name: string; source?: WhyouyePoolSource; shortName: string; description: string };

export const PARTNER_SOURCES: PartnerSource[] = [
  { key: 'all', name: '优选商品', shortName: '全部', description: '已授权目录总览' },
  { key: 'jd', name: '京东', source: 1, shortName: '京', description: '京东实物商品' },
  { key: 'jdFresh', name: '京东生鲜', source: 11, shortName: '鲜', description: '京东生鲜商品' },
  { key: 'tmall', name: '新天猫超市', source: 63, shortName: '猫', description: '新天猫超市商品' },
  { key: 'gift', name: '礼贸通', source: 18, shortName: '礼', description: '礼品供应目录' },
  { key: 'platform', name: '平台商品2.0', source: 104, shortName: '台', description: '平台通用商品' },
  { key: 'virtualCard', name: '平台虚拟卡券', source: 7, shortName: '券', description: '虚拟卡券商品' },
  { key: 'virtualTopup', name: '平台虚拟直充', source: 26, shortName: '充', description: '虚拟直充商品' },
  { key: 'giftPack', name: '驿选虚拟礼包', source: 108, shortName: '包', description: '礼包商品' },
  { key: 'cake', name: '蛋糕/鲜花/零食', source: 52, shortName: '蛋', description: '即时零售商品' },
  { key: 'books', name: '驿图书', source: 54, shortName: '书', description: '图书商品' },
];

export const CAMPAIGNS: { key: CampaignKey; subline: string }[] = [
  { key: '精选商品池', subline: '品质优选，尽享无限' },
  { key: '折扣仓', subline: '渠道低价，数量有限' },
  { key: '中秋礼包专区', subline: '好物组合，省心便捷' },
  { key: '送清凉专区', subline: '酷暑有好物，清凉常相伴' },
  { key: '七夕专区', subline: '以礼寄情，共度七夕' },
  { key: '京东京造+猫超甄选', subline: '电商自营，双严选' },
];

export const DEFAULT_SOURCE: PartnerSource = PARTNER_SOURCES.find((source) => source.key === 'platform')!;

export function productSource(product: Product): SourceKey {
  const text = `${product.supplierName} ${product.brand} ${product.title}`.toLowerCase();
  if (text.includes('京东生鲜')) return 'jdFresh';
  if (text.includes('京东')) return 'jd';
  if (text.includes('天猫') || text.includes('猫超')) return 'tmall';
  if (text.includes('蛋糕') || text.includes('鲜花') || text.includes('零食')) return 'cake';
  if (text.includes('图书') || text.includes('书')) return 'books';
  return 'platform';
}

export function money(value: number): string {
  return `¥${Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '--'}`;
}

export function margin(product: Product): string {
  if (!Number.isFinite(product.enterprisePrice) || product.enterprisePrice <= 0 || !Number.isFinite(product.costPrice)) return '--';
  return `${(((product.enterprisePrice - product.costPrice) / product.enterprisePrice) * 100).toFixed(2)}%`;
}

export function splitProductIds(value: string): string[] {
  return value
    .split(/[\s,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
