import type { QualificationConfigKind, QualificationSelector, QualificationStatus } from '../../services/qualification';

type Entity = Record<string, unknown> | null;
export const KIND_LABELS: Record<QualificationConfigKind, string> = {
  catalog_pool: '商品池',
  city_zone: '城市专区',
  entitlement_policy: '可见/可买策略',
  purchase_limit: '限售模板',
  supplier_agreement: '供应商协议',
  brand: '品牌关系',
  store: '门店关系',
};
export const text = (value: unknown) => (value == null ? '' : String(value));
export const number = (value: unknown) => (Number.isSafeInteger(value) ? Number(value) : 0);
export const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
export const selectors = (value: unknown): QualificationSelector[] =>
  Array.isArray(value)
    ? value.filter((item): item is QualificationSelector => typeof item === 'object' && item !== null && typeof (item as QualificationSelector).kind === 'string' && typeof (item as QualificationSelector).id === 'string')
    : [];

export function initialQualificationForm(kind: QualificationConfigKind, entity: Entity): Record<string, unknown> {
  const base = { status: 'draft' as QualificationStatus, ...(entity ?? {}) };
  if (kind === 'catalog_pool') return { ...base, code: text(entity?.code), name: text(entity?.name), poolKind: text(entity?.kind) || 'selected', skuIds: strings(entity?.skuIds) };
  if (kind === 'city_zone')
    return {
      ...base,
      code: text(entity?.code),
      name: text(entity?.name),
      appliesTo: text(entity?.appliesTo) || 'both',
      citiesText: Array.isArray(entity?.cities) ? entity.cities.map((city) => `${text((city as Record<string, unknown>).code)}|${text((city as Record<string, unknown>).name)}`).join('\n') : '',
      resources: selectors(entity?.resources),
    };
  if (kind === 'entitlement_policy')
    return {
      ...base,
      name: text(entity?.name),
      action: text(entity?.action) || 'visible',
      effect: text(entity?.effect) || 'allow',
      priority: text(entity?.priority) || '100',
      reasonCode: text(entity?.reasonCode) || 'POLICY_RULE',
      subjects: selectors(entity?.subjects),
      resources: selectors(entity?.resources),
    };
  if (kind === 'purchase_limit') return { ...base, code: text(entity?.code), name: text(entity?.name), countScope: text(entity?.countScope) || 'sku', subjects: selectors(entity?.subjects), resources: selectors(entity?.resources) };
  if (kind === 'supplier_agreement') return { ...base, supplierId: text(entity?.supplierId), agreementCode: text(entity?.agreementCode), settlementMode: text(entity?.settlementMode) || 'manual' };
  if (kind === 'brand') return { ...base, code: text(entity?.code), name: text(entity?.name), supplierIds: strings(entity?.supplierIds), productIds: strings(entity?.productIds), authorizedInMall: Boolean(entity?.authorizedInMall) };
  return {
    ...base,
    code: text(entity?.code),
    name: text(entity?.name),
    storeType: text(entity?.storeType) || 'offline',
    provinceCode: text(entity?.provinceCode),
    cityCode: text(entity?.cityCode),
    addressText: text(entity?.addressText),
    brandIds: strings(entity?.brandIds),
  };
}

export function qualificationPayload(kind: QualificationConfigKind, form: Record<string, unknown>) {
  const payload = { ...form };
  for (const key of ['id', 'version', 'itemCount', 'cityCount', 'subjectCount', 'resourceCount']) delete payload[key];
  if (kind === 'city_zone') {
    payload.cities = text(form.citiesText)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [code, ...name] = line.split('|');
        return { code: code.trim(), name: (name.join('|') || code).trim() };
      });
    delete payload.citiesText;
  }
  if (kind === 'purchase_limit') for (const key of LIMIT_KEYS) payload[key] = text(form[key]).trim() ? Number(form[key]) : null;
  if (kind === 'entitlement_policy') payload.priority = Number(form.priority);
  return payload;
}

export const LIMIT_KEYS = ['maxPerOrderQty', 'maxDailyQty', 'maxMonthlyQty', 'maxLifetimeQty', 'maxPerOrderAmountCents', 'maxDailyAmountCents', 'maxMonthlyAmountCents', 'maxLifetimeAmountCents'];
