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

  it('keeps an authenticated platform owner identity instead of substituting a legacy demo owner', () => {
    expect(resolveAdminAccount('ethan', ['platform_owner'])).toMatchObject({
      username: 'ethan',
      displayName: 'ethan',
      role: '平台 Owner',
    });
    expect(resolveAdminAccount('ethan', ['platform_owner'])).not.toMatchObject({
      username: 'onewr',
      displayName: '李厚亿',
    });
  });

  it('keeps an authenticated mall administrator identity instead of substituting a legacy demo profile', () => {
    expect(resolveAdminAccount('mall-admin-001', ['role-mall-admin'])).toMatchObject({
      username: 'mall-admin-001',
      displayName: 'mall-admin-001',
      role: '商城管理员',
    });
  });

  it('rejects an unknown profile', () => {
    expect(resolveAdminAccount('unknown', ['role-unknown'])).toBeNull();
  });

  it('shows the membership command center only with both read permissions', () => {
    expect(allowedWorkstationsFor(['member.read', 'role.read'])).toContain('membership');
    expect(allowedWorkstationsFor(['member.read'])).not.toContain('membership');
  });

  it('shows the voucher workstation to merchants and operator roles while retaining the normal access boundary', () => {
    expect(allowedWorkstationsFor(['catalog.read'])).toContain('voucher');
    expect(allowedWorkstationsFor(['order.read'])).toContain('voucher');
    expect(allowedWorkstationsFor(['voucher.read'])).toContain('voucher');
    expect(allowedWorkstationsFor([], ['platform_owner'])).toContain('voucher');
    expect(allowedWorkstationsFor([], ['role-mall-admin'])).toContain('voucher');
    expect(allowedWorkstationsFor(['member.read'])).not.toContain('voucher');
    expect(allowedWorkstationsFor([], ['member'])).not.toContain('voucher');
  });
});
