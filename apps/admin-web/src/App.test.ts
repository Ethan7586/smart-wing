import { describe, expect, it } from 'vitest';
import { allowedWorkstationsFor, resolveAdminAccount } from './App';

describe('admin account profile resolution', () => {
  it.each([
    ['seller001', 'role-test-seller', '测试商家'],
    ['ops001', 'role-test-operations', '测试运营'],
    ['cs001', 'role-test-customer-service', '测试客服'],
    ['admin001', 'role-test-admin', '测试企业管理员'],
  ])('recognizes %s as %s', (employeeNo, roleId, roleLabel) => {
    expect(resolveAdminAccount(employeeNo, [roleId])).toMatchObject({ username: employeeNo, role: roleLabel });
  });

  it('keeps the existing named test administrators', () => {
    expect(resolveAdminAccount('SW_TEST_FUBAO', ['role-mall-admin'])).toMatchObject({ username: '福宝' });
  });

  it('rejects an unknown profile', () => {
    expect(resolveAdminAccount('unknown', ['role-unknown'])).toBeNull();
  });

  it('shows the membership command center only with both read permissions', () => {
    expect(allowedWorkstationsFor(['member.read', 'role.read'])).toContain('membership');
    expect(allowedWorkstationsFor(['member.read'])).not.toContain('membership');
  });
});
