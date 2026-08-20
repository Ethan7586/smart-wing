import { describe, expect, it } from 'vitest';
import { classifyAuthFailure, resolveAdminAccount } from './App';

describe('admin session failure classification', () => {
  it('treats a missing or anonymous session as unauthenticated', () => {
    expect(classifyAuthFailure(null)).toEqual({ kind: 'unauthenticated' });
    expect(classifyAuthFailure({ authenticated: false })).toEqual({ kind: 'unauthenticated' });
  });

  it('names the entrance when an authenticated session belongs to the storefront', () => {
    expect(classifyAuthFailure({ authenticated: true, authorization: { target: 'storefront' } })).toEqual({ kind: 'wrong_entrance', target: 'storefront' });
  });

  it('reports the employee number and roles when no admin profile matches', () => {
    const failure = classifyAuthFailure({ authenticated: true, authorization: { target: 'admin', employeeNo: 'REG-TEST-0001', roles: ['role-unmapped'] } });
    expect(failure).toEqual({ kind: 'profile_unresolved', employeeNo: 'REG-TEST-0001', roles: ['role-unmapped'] });
  });

  it('never reports profile_unresolved for a role the console does accept', () => {
    const roles = ['role-platform-owner-v2'];
    expect(resolveAdminAccount('REG-B593D7C1B0F0', roles)).not.toBeNull();
  });

  it('keeps unusable role payloads out of the reported role list', () => {
    const failure = classifyAuthFailure({ authenticated: true, authorization: { target: 'admin', employeeNo: 'REG-TEST-0002', roles: [1, null, 'role-kept'] } });
    expect(failure).toEqual({ kind: 'profile_unresolved', employeeNo: 'REG-TEST-0002', roles: ['role-kept'] });
  });
});
