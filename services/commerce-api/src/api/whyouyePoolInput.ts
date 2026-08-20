import { isRecord } from './inputPrimitives';

/** Input contracts and parsers for the whyouye product-pool endpoints. */
export const MAX_PRODUCT_IDS = 100;
export const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

export const GENERAL_POOL_SOURCES = new Set([1, 7, 11, 18, 26, 52, 54, 55, 63, 104, 108]);
export const PRICE_WAYS = new Set(['adjust', 'fixed']);
export const PRICE_TYPES = new Set(['markPrice', 'supplyPrice', 'priceSetting', 'jdSellPrice', 'eventPrice', 'packPrice', 'businessPrice']);
export const PRICE_ADJUSTMENTS = new Set(['incr', 'desc']);
export const PRICE_UNITS = new Set(['profit', 'rmb']);
export type WriteMode = 'preview' | 'commit';

export interface PoolPricing {
  priceWay: string;
  priceType: string;
  priceAdjust: string;
  priceVal: string;
  priceUnit: string;
  distribPriceWay: string;
  distribPriceType: string;
  distribPriceAdjust: string;
  distribPriceVal: string;
  distribPriceUnit: string;
  distribPriceSetting: string;
  salePriceSetting: string;
}

export interface GeneralPoolInput {
  mode: WriteMode;
  source: number;
  remoteProductIds: string[];
  pricing: PoolPricing;
  /** Optional explicit target sites. Omit to let the partner resolve the current site from the credential context. */
  targetSiteIds: string[];
  /** 3=上架、4=下架；only passed through when the operator has made a choice. */
  operStatus: 3 | 4 | null;
}

export interface JdVopPoolInput {
  mode: WriteMode;
  remoteProductIds: string[];
  targetPool: 'standard' | 'fresh';
}

export const DEFAULT_PRICING: PoolPricing = {
  priceWay: 'adjust',
  priceType: 'supplyPrice',
  priceAdjust: 'incr',
  priceVal: '0',
  priceUnit: 'profit',
  distribPriceWay: 'adjust',
  distribPriceType: 'supplyPrice',
  distribPriceAdjust: 'incr',
  distribPriceVal: '0',
  distribPriceUnit: 'profit',
  distribPriceSetting: '',
  salePriceSetting: '',
};

/**
 * Adds existing partner catalogue IDs to the partner's general product pool.
 * It never claims to create an arbitrary partner product: their UI uses a
 * distinct, guarded file-import flow for that capability.
 */
export function parseGeneralPoolInput(value: unknown): GeneralPoolInput | null {
  if (!isRecord(value)) return null;
  const mode = parseMode(value.mode);
  const source = typeof value.source === 'number' && Number.isInteger(value.source) && GENERAL_POOL_SOURCES.has(value.source) ? value.source : null;
  const remoteProductIds = parseProductIds(value.remoteProductIds);
  const pricing = parsePricing(value.pricing);
  const targetSiteIds = parseOptionalProductIds(value.targetSiteIds, 20);
  const operStatus = value.operStatus === undefined ? null : value.operStatus === 3 || value.operStatus === 4 ? value.operStatus : null;
  return mode && source !== null && remoteProductIds && pricing && targetSiteIds !== null && (value.operStatus === undefined || operStatus !== null) ? { mode, source, remoteProductIds, pricing, targetSiteIds, operStatus } : null;
}

export function parseJdVopPoolInput(value: unknown): JdVopPoolInput | null {
  if (!isRecord(value)) return null;
  const mode = parseMode(value.mode);
  const remoteProductIds = parseProductIds(value.remoteProductIds);
  const targetPool = value.targetPool === 'standard' || value.targetPool === 'fresh' ? value.targetPool : null;
  return mode && remoteProductIds && targetPool ? { mode, remoteProductIds, targetPool } : null;
}

export function parseMode(value: unknown): WriteMode | null {
  if (value === undefined || value === 'preview') return 'preview';
  return value === 'commit' ? 'commit' : null;
}

export function parseProductIds(value: unknown): string[] | null {
  return parseOptionalProductIds(value, MAX_PRODUCT_IDS, true);
}

export function parseOptionalProductIds(value: unknown, maxLength: number, required = false): string[] | null {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length === 0 || value.length > maxLength) return null;
  const productIds = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => PRODUCT_ID_PATTERN.test(item));
  if (productIds.length !== value.length) return null;
  const uniqueIds = [...new Set(productIds)];
  return uniqueIds.length === productIds.length ? uniqueIds : null;
}

export function parsePricing(value: unknown): PoolPricing | null {
  if (value === undefined) return { ...DEFAULT_PRICING };
  if (!isRecord(value)) return null;
  const result: PoolPricing = { ...DEFAULT_PRICING };
  for (const key of ['priceWay', 'priceType', 'priceAdjust', 'priceUnit', 'distribPriceWay', 'distribPriceType', 'distribPriceAdjust', 'distribPriceUnit'] as const) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (typeof candidate !== 'string') return null;
    result[key] = candidate;
  }
  for (const key of ['priceVal', 'distribPriceVal'] as const) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    const normalized = normalizeNonNegativeDecimal(candidate);
    if (!normalized) return null;
    result[key] = normalized;
  }
  for (const key of ['distribPriceSetting', 'salePriceSetting'] as const) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (typeof candidate !== 'string' || candidate.length > 200) return null;
    result[key] = candidate;
  }
  return PRICE_WAYS.has(result.priceWay) &&
    PRICE_TYPES.has(result.priceType) &&
    PRICE_ADJUSTMENTS.has(result.priceAdjust) &&
    PRICE_UNITS.has(result.priceUnit) &&
    PRICE_WAYS.has(result.distribPriceWay) &&
    PRICE_TYPES.has(result.distribPriceType) &&
    PRICE_ADJUSTMENTS.has(result.distribPriceAdjust) &&
    PRICE_UNITS.has(result.distribPriceUnit)
    ? result
    : null;
}

export function normalizeNonNegativeDecimal(value: unknown): string | null {
  const candidate = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d+(?:\.\d{1,4})?$/.test(candidate)) return null;
  return candidate;
}
