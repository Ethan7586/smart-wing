import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadQualificationCenter, loadQualificationGovernance } from './qualification';

const validCenter = {
  catalogPools: [{ id: 'pool-1', code: 'pool', name: '演示商品池', kind: 'selected', status: 'active', version: 1, skuIds: [], itemCount: 0 }],
  cityZones: [],
  policies: [],
  limitTemplates: [],
  commercialResources: { agreements: [], brands: [], stores: [] },
  selectors: { enterprises: [], suppliers: [], products: [], skus: [], departments: [], users: [], memberships: [] },
  commercialSummary: { brands: 0, stores: 0, supplierAgreements: 0, brandAuthorizations: 0 },
  capabilities: {
    readCommercialResources: true,
    manageCommercialResources: false,
    readEntitlements: true,
    manageEntitlements: false,
    readPurchaseLimits: true,
    managePurchaseLimits: false,
    readEmployees: true,
    manageEmployees: false,
    approveChanges: false,
    simulate: false,
  },
};

const validGovernance = {
  changeRequests: [],
  employees: [
    {
      userId: 'user-1',
      membershipId: 'membership-1',
      name: 'Ethan',
      employeeNo: 'EMP-001',
      departmentId: null,
      departmentName: null,
      cityCode: null,
      cityName: null,
      status: 'active',
      version: 1,
      tags: [],
    },
  ],
  currentMembershipId: 'membership-1',
  capabilities: { readEmployees: true, manageEmployees: false, approveChanges: false, simulate: false },
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

describe('qualification read models', () => {
  it('accepts complete qualification center data', async () => {
    respond(validCenter);
    await expect(loadQualificationCenter()).resolves.toEqual(validCenter);
  });

  it('rejects a missing nested collection before the qualification view can use its length', async () => {
    respond({ ...validCenter, catalogPools: [{ ...validCenter.catalogPools[0], skuIds: undefined }] });
    await expect(loadQualificationCenter()).rejects.toThrow('资格服务返回了不完整的数据');
  });

  it('rejects an employee record with no tags collection', async () => {
    respond({ ...validGovernance, employees: [{ ...validGovernance.employees[0], tags: undefined }] });
    await expect(loadQualificationGovernance()).rejects.toThrow('资格服务返回了不完整的数据');
  });
});
