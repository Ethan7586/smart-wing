export type MallEntryKey = 'enterprise' | 'city' | 'voucher' | 'partner';
export type MallSegmentKey = 'grocery' | 'life' | 'digital' | 'dining';
export type ThemePreset = 'smart-blue' | 'city-blue' | 'festival-blue';

export interface MallApplicationConfig {
  schemaVersion: 1;
  mallDisplayName: string;
  themePreset: ThemePreset;
  announcement: string;
  hero: { title: string; subtitle: string };
  entries: Array<{ key: MallEntryKey; label: string; visible: boolean; sortOrder: number }>;
  partners: string[];
  segments: Array<{ key: MallSegmentKey; title: string; description: string; visible: boolean; sortOrder: number }>;
  memberCodeCta: { title: string; description: string };
  recommendationLimit: 2 | 4 | 6;
}

const ENTRY_KEYS: MallEntryKey[] = ['enterprise', 'city', 'voucher', 'partner'];
const SEGMENT_KEYS: MallSegmentKey[] = ['grocery', 'life', 'digital', 'dining'];
const THEMES: ThemePreset[] = ['smart-blue', 'city-blue', 'festival-blue'];
const FROZEN_MEMBER_CODE_CTA = { title: '到店出示会员码', description: '合作门店身份与权益核验 · 不是支付码' } as const;

export function defaultMallApplicationConfig(name = '智慧翼福利商城'): MallApplicationConfig {
  return {
    schemaVersion: 1,
    mallDisplayName: clampText(name, 2, 40) ?? '智慧翼福利商城',
    themePreset: 'smart-blue',
    announcement: '登录后识别企业福利与可购资格',
    hero: { title: '员工专享福利季', subtitle: '精选好物 · 专属惠上' },
    entries: [
      { key: 'enterprise', label: '企业专区', visible: true, sortOrder: 1 },
      { key: 'city', label: '城市专区', visible: true, sortOrder: 2 },
      { key: 'voucher', label: '电子卡券', visible: true, sortOrder: 3 },
      { key: 'partner', label: '合作商', visible: true, sortOrder: 4 },
    ],
    partners: ['全部', '麦德龙', '沃尔玛', '山姆', '大润发', '永辉'],
    segments: [
      { key: 'grocery', title: '商超到家', description: '生鲜百货 极速达送', visible: true, sortOrder: 1 },
      { key: 'life', title: '生活服务', description: '乐享生活 便捷到家', visible: true, sortOrder: 2 },
      { key: 'digital', title: '数码办公', description: '精选设备 高效办公', visible: true, sortOrder: 3 },
      { key: 'dining', title: '餐饮福利', description: '美味折扣 员工专享', visible: true, sortOrder: 4 },
    ],
    memberCodeCta: { ...FROZEN_MEMBER_CODE_CTA },
    recommendationLimit: 2,
  };
}

export function parseMallApplicationConfig(value: unknown): MallApplicationConfig | null {
  if (!isRecord(value) || !hasExactKeys(value, ['schemaVersion', 'mallDisplayName', 'themePreset', 'announcement', 'hero', 'entries', 'partners', 'segments', 'memberCodeCta', 'recommendationLimit']) || value.schemaVersion !== 1)
    return null;
  const mallDisplayName = clampText(value.mallDisplayName, 2, 40);
  const announcement = clampText(value.announcement, 0, 80);
  const hero = parseTextPair(value.hero, 'subtitle', 2, 24, 0, 40);
  const memberCodePair = parseTextPair(value.memberCodeCta, 'description', 2, 24, 0, 60);
  const entries = parseEntries(value.entries);
  const segments = parseSegments(value.segments);
  const partners = parsePartners(value.partners);
  const themePreset = typeof value.themePreset === 'string' && THEMES.includes(value.themePreset as ThemePreset) ? (value.themePreset as ThemePreset) : null;
  const recommendationLimit = [2, 4, 6].includes(Number(value.recommendationLimit)) ? (Number(value.recommendationLimit) as 2 | 4 | 6) : null;
  if (
    !mallDisplayName ||
    announcement === null ||
    !hero ||
    !memberCodePair ||
    memberCodePair.title !== FROZEN_MEMBER_CODE_CTA.title ||
    memberCodePair.subtitle !== FROZEN_MEMBER_CODE_CTA.description ||
    !entries ||
    !segments ||
    !partners ||
    !themePreset ||
    !recommendationLimit
  )
    return null;
  const memberCodeCta = { ...FROZEN_MEMBER_CODE_CTA };
  return { schemaVersion: 1, mallDisplayName, themePreset, announcement, hero, entries, partners, segments, memberCodeCta, recommendationLimit };
}

export type MallMutationInput =
  | { action: 'create'; reason: string; payload: { code: string; publicSlug: string; name: string; config: MallApplicationConfig }; targetMallId: ''; expectedRowVersion: 0; sourceVersionId: '' }
  | { action: 'save'; reason: string; payload: MallApplicationConfig; targetMallId: string; expectedRowVersion: number; sourceVersionId: '' }
  | { action: 'publish'; reason: string; payload: Record<string, never>; targetMallId: string; expectedRowVersion: number; sourceVersionId: '' }
  | { action: 'restore'; reason: string; payload: Record<string, never>; targetMallId: string; expectedRowVersion: number; sourceVersionId: string };

export function parseMallMutation(value: unknown, action: string, targetMallId = ''): MallMutationInput | null {
  if (!isRecord(value) || !['create', 'save', 'publish', 'restore'].includes(action)) return null;
  const reason = clampText(value.reason, 4, 500);
  if (!reason) return null;
  if (action === 'create') {
    const code = normalizeCode(value.code);
    const publicSlug = normalizeSlug(value.publicSlug);
    const name = clampText(value.name, 2, 60);
    const config = parseMallApplicationConfig(value.config);
    return code && publicSlug && name && config ? { action, reason, payload: { code, publicSlug, name, config }, targetMallId: '', expectedRowVersion: 0, sourceVersionId: '' } : null;
  }
  const expectedRowVersion = Number(value.expectedRowVersion);
  if (!targetMallId || targetMallId.length > 180 || !Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1) return null;
  if (action === 'save') {
    const payload = parseMallApplicationConfig(value.config);
    return payload ? { action, reason, payload, targetMallId, expectedRowVersion, sourceVersionId: '' } : null;
  }
  if (action === 'restore') {
    const sourceVersionId = clampText(value.sourceVersionId, 1, 180);
    return sourceVersionId ? { action, reason, payload: {}, targetMallId, expectedRowVersion, sourceVersionId } : null;
  }
  return { action: 'publish', reason, payload: {}, targetMallId, expectedRowVersion, sourceVersionId: '' };
}

function parseEntries(value: unknown): MallApplicationConfig['entries'] | null {
  if (!Array.isArray(value) || value.length !== ENTRY_KEYS.length) return null;
  const rows = value.map((item) => {
    if (!isRecord(item) || !hasExactKeys(item, ['key', 'label', 'visible', 'sortOrder']) || typeof item.key !== 'string' || !ENTRY_KEYS.includes(item.key as MallEntryKey)) return null;
    const label = clampText(item.label, 2, 8);
    const sortOrder = Number(item.sortOrder);
    return label && typeof item.visible === 'boolean' && Number.isSafeInteger(sortOrder) && sortOrder >= 1 && sortOrder <= 4 ? { key: item.key as MallEntryKey, label, visible: item.visible, sortOrder } : null;
  });
  return rows.every(Boolean) && new Set(rows.map((row) => row?.key)).size === ENTRY_KEYS.length && new Set(rows.map((row) => row?.sortOrder)).size === ENTRY_KEYS.length ? (rows as MallApplicationConfig['entries']) : null;
}

function parseSegments(value: unknown): MallApplicationConfig['segments'] | null {
  if (!Array.isArray(value) || value.length !== SEGMENT_KEYS.length) return null;
  const rows = value.map((item) => {
    if (!isRecord(item) || !hasExactKeys(item, ['key', 'title', 'description', 'visible', 'sortOrder']) || typeof item.key !== 'string' || !SEGMENT_KEYS.includes(item.key as MallSegmentKey)) return null;
    const title = clampText(item.title, 2, 12);
    const description = clampText(item.description, 0, 24);
    const sortOrder = Number(item.sortOrder);
    return title && description !== null && typeof item.visible === 'boolean' && Number.isSafeInteger(sortOrder) && sortOrder >= 1 && sortOrder <= 4
      ? { key: item.key as MallSegmentKey, title, description, visible: item.visible, sortOrder }
      : null;
  });
  return rows.every(Boolean) && new Set(rows.map((row) => row?.key)).size === SEGMENT_KEYS.length && new Set(rows.map((row) => row?.sortOrder)).size === SEGMENT_KEYS.length ? (rows as MallApplicationConfig['segments']) : null;
}

function parsePartners(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;
  const partners = value.map((item) => clampText(item, 1, 12));
  return partners.every(Boolean) && new Set(partners).size === partners.length ? (partners as string[]) : null;
}

function parseTextPair(value: unknown, subtitleKey: 'subtitle' | 'description', titleMin: number, titleMax: number, subtitleMin: number, subtitleMax: number): { title: string; subtitle: string } | null {
  if (!isRecord(value) || !hasExactKeys(value, ['title', subtitleKey])) return null;
  const title = clampText(value.title, titleMin, titleMax);
  const subtitleSource = value[subtitleKey];
  const subtitle = clampText(subtitleSource, subtitleMin, subtitleMax);
  return title && subtitle !== null ? { title, subtitle } : null;
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9_-]{2,31}$/.test(code) ? code : null;
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{2,47}$/.test(slug) ? slug : null;
}

function clampText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= minimum && text.length <= maximum ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(value).length === expected.size && Object.keys(value).every((key) => expected.has(key));
}
