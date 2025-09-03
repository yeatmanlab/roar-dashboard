import { describe, it, expect } from 'vitest';
import { computed } from 'vue';
import { AUTH_USER_TYPE } from '@/constants/auth';
import useUserType from './useUserType';

describe('useUserType', () => {
  it('should return super admin user type when user is a super admin', () => {
    const userClaims = computed(() => ({ claims: { super_admin: true } }));
    const { userType, isAdmin, isParticipant, isSuperAdmin, isEducator } = useUserType(userClaims);

    expect(userType.value).toBe(AUTH_USER_TYPE.SUPER_ADMIN);
    expect(isAdmin.value).toBe(false);
    expect(isParticipant.value).toBe(false);
    expect(isSuperAdmin.value).toBe(true);
    expect(isEducator.value).toBe(false);
  });

  it('should return admin user type when user has minimal admin orgs', () => {
    const userClaims = computed(() => ({
      claims: {
        minimalAdminOrgs: {
          org1: [{ id: 1 }],
          org2: [{ id: 2 }],
        },
      },
    }));
    const { userType, isAdmin, isParticipant, isSuperAdmin, isEducator } = useUserType(userClaims);

    expect(userType.value).toBe(AUTH_USER_TYPE.ADMIN);
    expect(isAdmin.value).toBe(true);
    expect(isParticipant.value).toBe(false);
    expect(isSuperAdmin.value).toBe(false);
    expect(isEducator.value).toBe(false);
  });

  it('should return admin user type when user is an educator', () => {
    const userClaims = computed(() => ({
      claims: {
        role: 'EDUCATOR',
      },
    }));
    const { userType, isAdmin, isParticipant, isSuperAdmin, isEducator } = useUserType(userClaims);

    expect(userType.value).toBe(AUTH_USER_TYPE.ADMIN);
    expect(isAdmin.value).toBe(true);
    expect(isParticipant.value).toBe(false);
    expect(isSuperAdmin.value).toBe(false);
    expect(isEducator.value).toBe(true);
  });

  it('should return admin user type when user is an admin', () => {
    const userClaims = computed(() => ({
      claims: {
        role: 'ADMIN',
      },
    }));
    const { userType, isAdmin, isParticipant, isSuperAdmin, isEducator } = useUserType(userClaims);

    expect(userType.value).toBe(AUTH_USER_TYPE.ADMIN);
    expect(isAdmin.value).toBe(true);
    expect(isParticipant.value).toBe(false);
    expect(isSuperAdmin.value).toBe(false);
    expect(isEducator.value).toBe(false);
  });

  it('should return participant user type when user is not a super admin and has no minimal admin orgs', () => {
    const userClaims = computed(() => ({
      claims: {
        super_admin: false,
        minimalAdminOrgs: {},
      },
    }));
    const { userType, isAdmin, isParticipant, isSuperAdmin, isEducator } = useUserType(userClaims);

    expect(userType.value).toBe(AUTH_USER_TYPE.PARTICIPANT);
    expect(isAdmin.value).toBe(false);
    expect(isParticipant.value).toBe(true);
    expect(isSuperAdmin.value).toBe(false);
    expect(isEducator.value).toBe(false);
  });

  it('should return undefined user type when no claims are provided', () => {
    const userClaims = computed(() => null);
    const { userType, isAdmin, isParticipant, isSuperAdmin, isEducator } = useUserType(userClaims);

    expect(userType.value).toBe(undefined);
    expect(isAdmin.value).toBe(false);
    expect(isParticipant.value).toBe(false);
    expect(isSuperAdmin.value).toBe(false);
    expect(isEducator.value).toBe(false);
  });
});
