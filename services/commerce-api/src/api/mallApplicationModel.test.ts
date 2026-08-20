import { describe, expect, it } from 'vitest';
import { defaultMallApplicationConfig, parseMallApplicationConfig, parseMallMutation } from './mallApplicationModel';

describe('mall application model', () => {
  it('accepts the approved default configuration', () => {
    const config = defaultMallApplicationConfig('示范企业福利商城');
    expect(parseMallApplicationConfig(config)).toEqual(config);
  });

  it('rejects unknown root fields and changes to frozen entry keys', () => {
    const config = defaultMallApplicationConfig();
    expect(parseMallApplicationConfig({ ...config, hiddenScript: 'unsafe' })).toBeNull();
    expect(
      parseMallApplicationConfig({
        ...config,
        entries: config.entries.map((entry, index) => (index === 0 ? { ...entry, key: 'payment' } : entry)),
      })
    ).toBeNull();
    expect(parseMallApplicationConfig({ ...config, memberCodeCta: { title: '付款码', description: '扫码支付' } })).toBeNull();
  });

  it('rejects duplicate entry order, segment order, and partner names', () => {
    const config = defaultMallApplicationConfig();
    expect(parseMallApplicationConfig({ ...config, entries: config.entries.map((entry) => ({ ...entry, sortOrder: 1 })) })).toBeNull();
    expect(parseMallApplicationConfig({ ...config, segments: config.segments.map((segment) => ({ ...segment, sortOrder: 2 })) })).toBeNull();
    expect(parseMallApplicationConfig({ ...config, partners: ['全部', '全部'] })).toBeNull();
  });

  it('normalizes a create request without accepting transactional data', () => {
    const config = defaultMallApplicationConfig('城市福利商城');
    expect(
      parseMallMutation(
        {
          code: ' city_mall ',
          publicSlug: ' City-Mall ',
          name: '城市福利商城',
          reason: '复制页面配置建立城市商城',
          config,
        },
        'create'
      )
    ).toMatchObject({
      action: 'create',
      payload: { code: 'CITY_MALL', publicSlug: 'city-mall', name: '城市福利商城', config },
    });
    const withIgnoredTransactionalFields = parseMallMutation(
      {
        code: 'city_mall',
        publicSlug: 'city-mall',
        name: '城市福利商城',
        reason: '只复制页面配置建立商城',
        config,
        members: [{ id: 'member-secret' }],
        balances: [{ amount: 100 }],
      },
      'create'
    );
    expect(withIgnoredTransactionalFields).not.toHaveProperty('members');
    expect(withIgnoredTransactionalFields).not.toHaveProperty('balances');
    expect(withIgnoredTransactionalFields).not.toHaveProperty('payload.members');
  });

  it('requires an optimistic version and a valid restore source', () => {
    expect(parseMallMutation({ expectedRowVersion: 0, reason: '保存新的页面配置', config: defaultMallApplicationConfig() }, 'save', 'mall-a')).toBeNull();
    expect(parseMallMutation({ expectedRowVersion: 3, reason: '恢复历史页面版本', sourceVersionId: 'version-a' }, 'restore', 'mall-a')).toEqual({
      action: 'restore',
      reason: '恢复历史页面版本',
      payload: {},
      targetMallId: 'mall-a',
      expectedRowVersion: 3,
      sourceVersionId: 'version-a',
    });
  });
});
