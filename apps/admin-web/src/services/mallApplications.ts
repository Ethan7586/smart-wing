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
  return requestJson('/api/v1/admin/mall-applications');
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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ?? `商城应用服务请求失败 (${response.status})`);
  return payload as T;
}
