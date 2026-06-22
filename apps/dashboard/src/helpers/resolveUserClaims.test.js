import { describe, it, expect } from 'vitest';
import { UserRoles } from '@bdelab/roar-firekit';
import { deriveEmulatorClaims } from './resolveUserClaims';

describe('deriveEmulatorClaims', () => {
  it('maps a super admin to super_admin (with admin claims included)', () => {
    expect(deriveEmulatorClaims({ isSuperAdmin: true, userType: 'admin' })).toEqual({
      super_admin: true,
      admin: true,
      role: UserRoles.ADMIN,
    });
  });

  it('maps an admin-type user to admin claims without super_admin', () => {
    expect(deriveEmulatorClaims({ isSuperAdmin: false, userType: 'admin' })).toEqual({
      super_admin: false,
      admin: true,
      role: UserRoles.ADMIN,
    });
  });

  it('maps an educator (teacher) to admin claims so they reach the admin dashboard', () => {
    expect(deriveEmulatorClaims({ isSuperAdmin: false, userType: 'educator' })).toEqual({
      super_admin: false,
      admin: true,
      role: UserRoles.ADMIN,
    });
  });

  it('maps a student to participant claims (no admin/role)', () => {
    expect(deriveEmulatorClaims({ isSuperAdmin: false, userType: 'student' })).toEqual({ super_admin: false });
  });

  it('maps a caregiver to participant claims (no admin/role)', () => {
    expect(deriveEmulatorClaims({ isSuperAdmin: false, userType: 'caregiver' })).toEqual({ super_admin: false });
  });

  it('keeps super_admin for a super admin whose userType is not an admin-dashboard type', () => {
    // super_admin is checked first in useUserType, so SUPER_ADMIN routing wins even
    // without the admin/role claims.
    expect(deriveEmulatorClaims({ isSuperAdmin: true, userType: 'student' })).toEqual({ super_admin: true });
  });

  it('fails closed when the /me payload is missing or empty', () => {
    expect(deriveEmulatorClaims(undefined)).toEqual({ super_admin: false });
    expect(deriveEmulatorClaims({})).toEqual({ super_admin: false });
  });
});
