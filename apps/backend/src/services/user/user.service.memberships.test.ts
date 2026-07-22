import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { UserService } from './user.service';
import { UserFactory, AuthContextFactory } from '../../test-support/factories/user.factory';
import { createMockUserRepository } from '../../test-support/repositories/user.repository';
import { createMockAuthorizationService } from '../../test-support/services/authorization.service';
import type { UserMembershipDetail } from '../../types/user';
import { FgaType, FgaRelation } from '../authorization/fga-constants';

/**
 * Unit tests for the requester-scoped row filtering on `listUserMemberships`.
 *
 * These mock FGA, so they assert the *wiring* (which relation is asked, on which
 * objects, and which rows survive) — not the policy itself. The policy guarantee
 * (that a school-A admin truly cannot resolve `can_list_users` on school B) needs
 * integration tests against the real OpenFGA model.
 */
describe('UserService.listUserMemberships', () => {
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;
  let mockAuthorizationService: ReturnType<typeof createMockAuthorizationService>;

  // Target: a student enrolled in a class in school A and a class in school B,
  // and a member of one family (a ROAR@Home child).
  const classA: UserMembershipDetail = {
    entityType: 'class',
    entityId: 'class-A',
    role: 'student',
    schoolId: 'school-A',
    districtId: 'district-1',
  };
  const classB: UserMembershipDetail = {
    entityType: 'class',
    entityId: 'class-B',
    role: 'student',
    schoolId: 'school-B',
    districtId: 'district-1',
  };
  const family: UserMembershipDetail = { entityType: 'family', entityId: 'fam-1', role: 'child' };
  const detailedMemberships: UserMembershipDetail[] = [classA, classB, family];

  beforeEach(() => {
    vi.resetAllMocks();
    mockUserRepository = createMockUserRepository();
    mockAuthorizationService = createMockAuthorizationService();
  });

  function service() {
    return UserService({
      userRepository: mockUserRepository,
      authorizationService: mockAuthorizationService,
    });
  }

  it('returns the full set for self, with no FGA filtering', async () => {
    const authContext = AuthContextFactory.build({ userId: 'student-1', isSuperAdmin: false });
    mockUserRepository.getById.mockResolvedValue(UserFactory.build({ id: 'student-1' }));
    mockUserRepository.getUserMembershipsDetailed.mockResolvedValue(detailedMemberships);

    const result = await service().listUserMemberships(authContext, 'student-1');

    expect(result).toEqual(detailedMemberships);
    expect(mockAuthorizationService.hasPermission).not.toHaveBeenCalled();
    expect(mockAuthorizationService.hasAnyPermission).not.toHaveBeenCalled();
  });

  it('returns the full set for a super admin', async () => {
    const authContext = AuthContextFactory.build({ userId: 'admin-1', isSuperAdmin: true });
    mockUserRepository.getById.mockResolvedValue(UserFactory.build({ id: 'student-1' }));
    mockUserRepository.getUserMembershipsDetailed.mockResolvedValue(detailedMemberships);

    const result = await service().listUserMemberships(authContext, 'student-1');

    expect(result).toEqual(detailedMemberships);
    expect(mockAuthorizationService.hasPermission).not.toHaveBeenCalled();
  });

  it('returns the full set (including family rows) for a guardian of the user', async () => {
    const authContext = AuthContextFactory.build({ userId: 'parent-1', isSuperAdmin: false });
    mockUserRepository.getById.mockResolvedValue(UserFactory.build({ id: 'student-1' }));
    // Gate: the target's entities include the family; the parent passes via can_list_users on it.
    mockUserRepository.getUserEntityMemberships.mockResolvedValue([{ entityType: 'family', entityId: 'fam-1' }]);
    mockUserRepository.getUserMembershipsDetailed.mockResolvedValue(detailedMemberships);
    // Both the gate check and the guardian check resolve true for a parent.
    mockAuthorizationService.hasAnyPermission.mockResolvedValue(true);

    const result = await service().listUserMemberships(authContext, 'student-1');

    expect(result).toEqual(detailedMemberships);
    // The guardian check asks can_list_users on the child's family object.
    expect(mockAuthorizationService.hasAnyPermission).toHaveBeenCalledWith('parent-1', FgaRelation.CAN_LIST_USERS, [
      `${FgaType.FAMILY}:fam-1`,
    ]);
    // A guardian gets the full set without per-entity filtering.
    expect(mockAuthorizationService.hasPermission).not.toHaveBeenCalled();
  });

  it("scopes an administrator to their reach — never another school's enrolment, never family rows", async () => {
    const authContext = AuthContextFactory.build({ userId: 'principal-A', isSuperAdmin: false });
    mockUserRepository.getById.mockResolvedValue(UserFactory.build({ id: 'student-1' }));
    mockUserRepository.getUserEntityMemberships.mockResolvedValue([
      { entityType: 'class', entityId: 'class-A' },
      { entityType: 'class', entityId: 'class-B' },
      { entityType: 'family', entityId: 'fam-1' },
    ]);
    mockUserRepository.getUserMembershipsDetailed.mockResolvedValue(detailedMemberships);
    // Gate passes (first call) but the guardian check fails (the principal is not the parent).
    mockAuthorizationService.hasAnyPermission.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    // Per-entity: the principal can list users only in school A's class.
    mockAuthorizationService.hasPermission.mockImplementation(
      async (_userId, _relation, object) => object === `${FgaType.CLASS}:class-A`,
    );

    const result = await service().listUserMemberships(authContext, 'student-1');

    // The school-A class survives, but its parent school/district IDs are stripped on the
    // supervisory path (the principal can list the class's users but not read the school).
    expect(result).toEqual([{ entityType: 'class', entityId: 'class-A', role: 'student' }]);
    expect(result[0]).not.toHaveProperty('schoolId');
    expect(result[0]).not.toHaveProperty('districtId');
    // The school-B enrolment and the family row are filtered out entirely.
    expect(result).not.toContainEqual(classB);
    expect(result).not.toContainEqual(family);
  });

  it('propagates 403 from the access gate without fetching memberships', async () => {
    const authContext = AuthContextFactory.build({ userId: 'stranger-1', isSuperAdmin: false });
    mockUserRepository.getById.mockResolvedValue(UserFactory.build({ id: 'student-1' }));
    mockUserRepository.getUserEntityMemberships.mockResolvedValue([{ entityType: 'class', entityId: 'class-A' }]);
    mockAuthorizationService.hasAnyPermission.mockResolvedValue(false); // gate denies

    await expect(service().listUserMemberships(authContext, 'student-1')).rejects.toMatchObject({
      statusCode: StatusCodes.FORBIDDEN,
    });
    expect(mockUserRepository.getUserMembershipsDetailed).not.toHaveBeenCalled();
  });

  it('propagates 404 when the target user does not exist', async () => {
    const authContext = AuthContextFactory.build({ userId: 'admin-1', isSuperAdmin: true });
    mockUserRepository.getById.mockResolvedValue(null);

    await expect(service().listUserMemberships(authContext, 'missing')).rejects.toMatchObject({
      statusCode: StatusCodes.NOT_FOUND,
    });
  });
});
