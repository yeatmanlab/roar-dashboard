import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRoles } from '@bdelab/roar-firekit';
import { queryClient } from '@/queryClient';
import { fetchMe } from '@/composables/queries/useMeQuery';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
import { deriveClaimsFromMe, resolveUserClaims } from './resolveUserClaims';

vi.mock('@/queryClient', () => ({
  queryClient: {
    fetchQuery: vi.fn(),
  },
}));

vi.mock('@/composables/queries/useMeQuery', () => ({
  default: vi.fn(),
  fetchMe: vi.fn(),
}));

const MOCK_ROAR_UID = '00000000-0000-0000-0000-000000000001';

describe('deriveClaimsFromMe', () => {
  it('maps a super admin to super_admin (with admin claims included)', () => {
    expect(deriveClaimsFromMe({ id: MOCK_ROAR_UID, isSuperAdmin: true, userType: 'admin' })).toEqual({
      super_admin: true,
      roarUid: MOCK_ROAR_UID,
      admin: true,
      role: UserRoles.ADMIN,
    });
  });

  it('maps an admin-type user to admin claims without super_admin', () => {
    expect(deriveClaimsFromMe({ id: MOCK_ROAR_UID, isSuperAdmin: false, userType: 'admin' })).toEqual({
      super_admin: false,
      roarUid: MOCK_ROAR_UID,
      admin: true,
      role: UserRoles.ADMIN,
    });
  });

  it('maps an educator (teacher) to admin claims so they reach the admin dashboard', () => {
    expect(deriveClaimsFromMe({ id: MOCK_ROAR_UID, isSuperAdmin: false, userType: 'educator' })).toEqual({
      super_admin: false,
      roarUid: MOCK_ROAR_UID,
      admin: true,
      role: UserRoles.ADMIN,
    });
  });

  it('maps a student to participant claims (no admin/role)', () => {
    expect(deriveClaimsFromMe({ id: MOCK_ROAR_UID, isSuperAdmin: false, userType: 'student' })).toEqual({
      super_admin: false,
      roarUid: MOCK_ROAR_UID,
    });
  });

  it('maps a caregiver to participant claims (no admin/role)', () => {
    expect(deriveClaimsFromMe({ id: MOCK_ROAR_UID, isSuperAdmin: false, userType: 'caregiver' })).toEqual({
      super_admin: false,
      roarUid: MOCK_ROAR_UID,
    });
  });

  it('keeps super_admin for a super admin whose userType is not an admin-dashboard type', () => {
    // super_admin is checked first in useUserType, so SUPER_ADMIN routing wins even
    // without the admin/role claims.
    expect(deriveClaimsFromMe({ id: MOCK_ROAR_UID, isSuperAdmin: true, userType: 'student' })).toEqual({
      super_admin: true,
      roarUid: MOCK_ROAR_UID,
    });
  });

  it('always maps roarUid from the /me id', () => {
    for (const userType of ['admin', 'educator', 'student', 'caregiver']) {
      expect(deriveClaimsFromMe({ id: MOCK_ROAR_UID, isSuperAdmin: false, userType }).roarUid).toBe(MOCK_ROAR_UID);
    }
  });
});

describe('resolveUserClaims', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches /me via the singleton queryClient under ME_QUERY_KEY', async () => {
    queryClient.fetchQuery.mockResolvedValueOnce({ id: MOCK_ROAR_UID, isSuperAdmin: false, userType: 'student' });

    await resolveUserClaims();

    expect(queryClient.fetchQuery).toHaveBeenCalledTimes(1);
    expect(queryClient.fetchQuery).toHaveBeenCalledWith({
      queryKey: [ME_QUERY_KEY],
      queryFn: fetchMe,
    });
    // No per-call staleTime: freshness is governed by the queryClient's
    // defaultOptions (fetchQuery applies them via defaultQueryOptions).
    expect(queryClient.fetchQuery.mock.calls[0][0]).not.toHaveProperty('staleTime');
  });

  it('wraps the derived claims in a { claims } envelope', async () => {
    queryClient.fetchQuery.mockResolvedValueOnce({ id: MOCK_ROAR_UID, isSuperAdmin: true, userType: 'admin' });

    await expect(resolveUserClaims()).resolves.toEqual({
      claims: {
        super_admin: true,
        roarUid: MOCK_ROAR_UID,
        admin: true,
        role: UserRoles.ADMIN,
      },
    });
  });

  it('propagates /me fetch failures to the caller (no fail-closed claims, no local logging)', async () => {
    // Callers own error handling AND logging — a local console.error here
    // would double-log every /me failure alongside the call-site log.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchError = new Error('/me request failed with status 500');
    fetchError.status = 500;
    queryClient.fetchQuery.mockRejectedValueOnce(fetchError);

    await expect(resolveUserClaims()).rejects.toBe(fetchError);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
