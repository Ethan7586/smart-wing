import { createHash } from 'node:crypto';

export const DEFAULT_VARIANT_WIDTHS = Object.freeze([160, 320, 640, 960]);
export const DEFAULT_COVER_WIDTH = 640;
export const PIPELINE_PROFILE = 'sw-cover-v2-webp-q78';

function normalizedWidth(value) {
  const width = Number.parseInt(String(value), 10);
  if (!Number.isFinite(width) || width < 120 || width > 1600) {
    throw new Error(`Invalid catalog image width: ${value}`);
  }
  return width;
}

export function parseVariantWidths(value) {
  const values = value ? String(value).split(',') : DEFAULT_VARIANT_WIDTHS;
  return [...new Set(values.map(normalizedWidth))].sort((left, right) => left - right);
}

export function resolveVariantPlan({ widths, legacyWidth, defaultWidth } = {}) {
  const variants = legacyWidth ? [normalizedWidth(legacyWidth)] : parseVariantWidths(widths);
  const preferred = normalizedWidth(defaultWidth ?? (legacyWidth || DEFAULT_COVER_WIDTH));
  if (!variants.includes(preferred)) variants.push(preferred);
  variants.sort((left, right) => left - right);
  return { widths: variants, defaultWidth: preferred };
}

export function sourceVersion(source) {
  return createHash('sha256').update(PIPELINE_PROFILE).update('\0').update(source).digest('hex').slice(0, 16);
}

export function catalogVariantKey(productId, version, width) {
  const safeId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId) throw new Error('Product id cannot produce an OSS object key');
  if (!/^[a-f0-9]{16}$/.test(version)) throw new Error('Catalog image version is invalid');
  return `catalog/products/${safeId}/${version}/cover-${normalizedWidth(width)}.webp`;
}

export function publicMediaUrl(publicBase, objectKey) {
  return `${String(publicBase).replace(/\/+$/, '')}/${objectKey}`;
}
