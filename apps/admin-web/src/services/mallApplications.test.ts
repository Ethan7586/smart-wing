import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMallApplications } from './mallApplications';

const config = {
  schemaVersion: 1,
  mallDisplayName: '智慧翼商城',
  themePreset: 'smart-blue',
  announcement: '员工专属福利',
  hero: { title: '福利季', subtitle: '精选好物' },
  entries: [{ key: 'enterprise', label: '企业福利', visible: true, sortOrder: 1 }],
  partners: [],
  segments: [{ key: 'grocery', title: '食品', description: '日常采购', visible: true, sortOrder: 1 }],
  memberCodeCta: { title: '到店出示会员码', description: '核验权益' },
  recommendationLimit: 2,
};

const validResponse = {
  malls: [
    {
      id: 'mall-1',
      code: 'SMART',
      publicSlug: 'smart',
      name: '智慧翼商城',
      status: 'active',
      rowVersion: 1,
      draftVersion: { id: 'version-1', versionNo: 1, config, reason: '初始化', createdAt: '2026-08-19T00:00:00.000Z' },
      publishedVersion: { id: 'version-2', versionNo: 1, config, reason: '初始化', createdAt: '2026-08-19T00:00:00.000Z' },
      history: [{ id: 'version-1', versionNo: 1, lifecycle: 'draft', reason: '初始化', createdAt: '2026-08-19T00:00:00.000Z' }],
    },
  ],
  capabilities: { read: true, manage: false, decorate: false, publish: false },
  frozenRules: ['智慧翼主品牌'],
};

function respond(payload: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mall application read model', () => {
  it('accepts a complete mall application response', async () => {
    respond(validResponse);
    await expect(loadMallApplications()).resolves.toEqual(validResponse);
  });

  it('rejects a nested page configuration missing entries before the editor can render it', async () => {
    respond({
      ...validResponse,
      malls: [
        {
          ...validResponse.malls[0],
          draftVersion: {
            ...validResponse.malls[0].draftVersion,
            config: { ...config, entries: undefined },
          },
        },
      ],
    });
    await expect(loadMallApplications()).rejects.toThrow('商城应用服务返回了不完整的数据');
  });
});
