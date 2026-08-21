import { isJsonRecord, requestAdminJson } from './adminJson';

export type MallApplicationConfig = {
  schemaVersion: 1;
  mallDisplayName: string;
  themePreset: 'smart-blue' | 'city-blue' | 'festival-blue';
  announcement: string;
  hero: { title: string; subtitle: string };
  entries: Array<{ key: 'enterprise' | 'city' | 'voucher' | 'partner'; label: string; visible: boolean; sortOrder: number }>;
  partners: string[];
  segments: Array<{ key: 'grocery' | 'life' | 'digital' | 'dining'; title: string; description: string; visible: boolean; sortOrder: number }>;
  memberCodeCta: { title: string; description: string };
  recommendationLimit: 2 | 4 | 6;
};

export type MallVersion = { id: string; versionNo: number; config: MallApplicationConfig; reason: string; createdAt: string };
export type MallHistory = { id: string; versionNo: number; lifecycle: 'draft' | 'published'; reason: string; createdAt: string };
export type MallApplication = {
  id: string;
  code: string;
  publicSlug: string;
  name: string;
  status: 'active' | 'disabled';
  rowVersion: number;
  draftVersion: MallVersion;
  publishedVersion: MallVersion;
  history: MallHistory[];
};
export type MallApplicationCenter = {
  malls: MallApplication[];
  capabilities: { read: boolean; manage: boolean; decorate: boolean; publish: boolean };
  frozenRules: string[];
};
export type MallMutationResult = { mallId: string; rowVersion: number; versionId?: string; versionNo?: number; status: string };

export async function loadMallApplications(): Promise<MallApplicationCenter> {
  return requestAdminJson('/api/v1/admin/mall-applications', { label: '商城应用服务', validate: isMallApplicationCenter });
}

export async function createMallApplication(input: { code: string; publicSlug: string; name: string; config: MallApplicationConfig; reason: string }): Promise<MallMutationResult> {
  return write('/api/v1/admin/mall-applications', 'POST', input);
}

export async function saveMallApplicationDraft(mallId: string, expectedRowVersion: number, config: MallApplicationConfig, reason: string): Promise<void> {
  await write(`/api/v1/admin/mall-applications/${encodeURIComponent(mallId)}/draft`, 'PUT', { expectedRowVersion, config, reason });
}

export async function publishMallApplication(mallId: string, expectedRowVersion: number, reason: string): Promise<void> {
  await write(`/api/v1/admin/mall-applications/${encodeURIComponent(mallId)}/publish`, 'POST', { expectedRowVersion, reason });
}

export async function restoreMallApplication(mallId: string, expectedRowVersion: number, sourceVersionId: string, reason: string): Promise<void> {
  await write(`/api/v1/admin/mall-applications/${encodeURIComponent(mallId)}/restore`, 'POST', { expectedRowVersion, sourceVersionId, reason });
}

async function write(url: string, method: string, input: unknown): Promise<MallMutationResult> {
  return requestJson(url, {
    method,
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return requestAdminJson<T>(url, { label: '商城应用服务', ...init });
}

function isMallApplicationCenter(payload: unknown): payload is MallApplicationCenter {
  return isJsonRecord(payload) && Array.isArray(payload.malls) && payload.malls.every(isMallApplication) && isCapabilities(payload.capabilities) && isStringList(payload.frozenRules);
}

function isMallApplication(value: unknown): value is MallApplication {
  return (
    hasStringFields(value, ['id', 'code', 'publicSlug', 'name']) &&
    isOneOf(value.status, ['active', 'disabled']) &&
    isNonNegativeInteger(value.rowVersion) &&
    isMallVersion(value.draftVersion) &&
    isMallVersion(value.publishedVersion) &&
    Array.isArray(value.history) &&
    value.history.every(isMallHistory)
  );
}

function isMallVersion(value: unknown): value is MallVersion {
  return isJsonRecord(value) && hasStringFields(value, ['id', 'reason', 'createdAt']) && isPositiveInteger(value.versionNo) && isMallConfig(value.config);
}

function isMallHistory(value: unknown): value is MallHistory {
  return hasStringFields(value, ['id', 'reason', 'createdAt']) && isPositiveInteger(value.versionNo) && isOneOf(value.lifecycle, ['draft', 'published']);
}

function isMallConfig(value: unknown): value is MallApplicationConfig {
  return (
    isJsonRecord(value) &&
    value.schemaVersion === 1 &&
    hasStringFields(value, ['mallDisplayName', 'announcement']) &&
    isOneOf(value.themePreset, ['smart-blue', 'city-blue', 'festival-blue']) &&
    hasStringFields(value.hero, ['title', 'subtitle']) &&
    Array.isArray(value.entries) &&
    value.entries.every(isMallEntry) &&
    isStringList(value.partners) &&
    Array.isArray(value.segments) &&
    value.segments.every(isMallSegment) &&
    hasStringFields(value.memberCodeCta, ['title', 'description']) &&
    isOneOf(value.recommendationLimit, [2, 4, 6])
  );
}

function isMallEntry(value: unknown): boolean {
  return hasStringFields(value, ['label']) && isOneOf(value.key, ['enterprise', 'city', 'voucher', 'partner']) && typeof value.visible === 'boolean' && isNonNegativeInteger(value.sortOrder);
}

function isMallSegment(value: unknown): boolean {
  return hasStringFields(value, ['title', 'description']) && isOneOf(value.key, ['grocery', 'life', 'digital', 'dining']) && typeof value.visible === 'boolean' && isNonNegativeInteger(value.sortOrder);
}

function isCapabilities(value: unknown): value is MallApplicationCenter['capabilities'] {
  return isJsonRecord(value) && ['read', 'manage', 'decorate', 'publish'].every((key) => typeof value[key] === 'boolean');
}

function hasStringFields(value: unknown, fields: string[]): value is Record<string, string> {
  return isJsonRecord(value) && fields.every((field) => typeof value[field] === 'string');
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isOneOf<T extends string | number>(value: unknown, values: readonly T[]): value is T {
  return values.includes(value as T);
}
