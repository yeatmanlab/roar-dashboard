/**
 * Unit tests for UserService.create
 *
 * Covers the full saga: authorization → pre-flight → Firebase Auth → DB → FGA,
 * and every compensation branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';

// Mock FirebaseAuthClient directly — the service imports it at module level and
// the firebase-admin/auth mock creates a new object per getAuth() call, so
// referencing getAuth() in tests would give a different instance.
vi.mock('../../clients/firebase-auth.clients', () => ({
  FirebaseAuthClient: {
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

import { UserService } from './user.service';
import { FirebaseAuthClient } from '../../clients/firebase-auth.clients';
import { AuthContextFactory } from '../../test-support/factories/user.factory';
import { createMockUserRepository } from '../../test-support/repositories/user.repository';
import { createMockUserAgreementRepository } from '../../test-support/repositories/user-agreement.repository';
import { createMockAgreementVersionRepository } from '../../test-support/repositories/agreement-version.repository';
import { createMockAgreementRepository } from '../../test-support/repositories/agreement.repository';
import { createMockDistrictRepository } from '../../test-support/repositories/district.repository';
import { createMockSchoolRepository } from '../../test-support/repositories/school.repository';
import { createMockGroupRepository } from '../../test-support/repositories/group.repository';
import { createMockFamilyRepository } from '../../test-support/repositories/family.repository';
import { createMockClassRepository } from '../../test-support/repositories/class.repository';
import { createMockRosterProviderIdRepository } from '../../test-support/repositories/roster-provider-id.repository';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { FamilyFactory } from '../../test-support/factories/family.factory';
import { createMockAuthorizationService } from '../../test-support/services/authorization.service';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { EntityType } from '../../types/entity-type';
import { UserRole } from '../../enums/user-role.enum';
import { UserType } from '../../enums/user-type.enum';
import { FgaRelation } from '../authorization/fga-constants';
import { logger } from '../../logger';
import { UserFamilyRole } from '../../enums/user-family-role.enum';

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockAuth = FirebaseAuthClient as unknown as {
  createUser: ReturnType<typeof vi.fn>;
  getUserByEmail: ReturnType<typeof vi.fn>;
  deleteUser: ReturnType<typeof vi.fn>;
};

function makeFirebaseError(code: string): { code: string; message: string } {
  return { code, message: `Firebase error: ${code}` };
}

// These simulate a raw Postgres error after unwrapDrizzleError() extracts it.
// unwrapDrizzleError only strips DrizzleQueryError wrappers; for tests, a plain
// object with a top-level `code` property matches what isUniqueViolation /
// isForeignKeyViolation expect.
function makeDrizzleUniqueError() {
  return Object.assign(new Error('unique violation'), { code: '23505' });
}

function makeDrizzleFkError() {
  return Object.assign(new Error('foreign key violation'), { code: '23503' });
}

// ── Default test data ─────────────────────────────────────────────────────────

const districtId = 'district-uuid-1';
const schoolId = 'school-uuid-1';
const classId = 'class-uuid-1';
const groupId = 'group-uuid-1';

const validBody = {
  email: 'student@example.com',
  password: 'password123',
  name: { first: 'Test', last: 'Student' },
  userType: UserType.ADMIN,
  memberships: [{ entityType: EntityType.DISTRICT, entityId: districtId, role: UserRole.STUDENT }],
};

const platformAdminBody = {
  email: 'platform_admin@example.com',
  password: 'password123',
  name: { first: 'Test', last: 'Platform Admin' },
  userType: UserType.ADMIN,
  memberships: [{ entityType: EntityType.DISTRICT, entityId: districtId, role: UserRole.PLATFORM_ADMIN }],
};

const newUserId = 'new-user-uuid';
const firebaseUid = 'firebase-uid-abc';

// ── Test suite ────────────────────────────────────────────────────────────────

describe('UserService.create', () => {
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;
  let mockDistrictRepo: ReturnType<typeof createMockDistrictRepository>;
  let mockSchoolRepo: ReturnType<typeof createMockSchoolRepository>;
  let mockGroupRepo: ReturnType<typeof createMockGroupRepository>;
  let mockClassRepo: ReturnType<typeof createMockClassRepository>;
  let mockFamilyRepo: ReturnType<typeof createMockFamilyRepository>;
  let mockRosterProviderRepo: ReturnType<typeof createMockRosterProviderIdRepository>;
  let mockAuthzService: ReturnType<typeof createMockAuthorizationService>;
  let service: ReturnType<typeof UserService>;

  beforeEach(() => {
    mockUserRepo = createMockUserRepository();
    mockDistrictRepo = createMockDistrictRepository();
    mockSchoolRepo = createMockSchoolRepository();
    mockGroupRepo = createMockGroupRepository();
    mockClassRepo = createMockClassRepository();
    mockFamilyRepo = createMockFamilyRepository();
    mockRosterProviderRepo = createMockRosterProviderIdRepository();
    mockAuthzService = createMockAuthorizationService();

    service = UserService({
      userRepository: mockUserRepo,
      userAgreementRepository: createMockUserAgreementRepository(),
      agreementVersionRepository: createMockAgreementVersionRepository(),
      agreementRepository: createMockAgreementRepository(),
      districtRepository: mockDistrictRepo,
      schoolRepository: mockSchoolRepo,
      classRepository: mockClassRepo,
      groupRepository: mockGroupRepo,
      familyRepository: mockFamilyRepo,
      rosterProviderIdRepository: mockRosterProviderRepo,
      authorizationService: mockAuthzService,
    });

    // Happy-path defaults — individual tests override as needed
    mockUserRepo.findClassParentSchool.mockResolvedValue(schoolId);
    mockUserRepo.existsByUniqueFields.mockResolvedValue(false);
    mockDistrictRepo.getActiveById.mockResolvedValue(OrgFactory.build());
    mockSchoolRepo.getActiveById.mockResolvedValue(OrgFactory.build());
    mockClassRepo.getDistinctRootIds.mockResolvedValue([{ id: districtId }]);
    mockSchoolRepo.getDistinctRootIds.mockResolvedValue([{ id: districtId }]);
    mockGroupRepo.getActiveById.mockResolvedValue(GroupFactory.build());
    mockFamilyRepo.getActiveById.mockResolvedValue(FamilyFactory.build());
    mockUserRepo.createWithMemberships.mockResolvedValue({ id: newUserId });
    mockUserRepo.delete.mockResolvedValue(undefined);
    mockRosterProviderRepo.create.mockResolvedValue({ id: newUserId });

    mockAuth.getUserByEmail.mockRejectedValue(makeFirebaseError('auth/user-not-found'));
    mockAuth.createUser.mockResolvedValue({ uid: firebaseUid });
    mockAuth.deleteUser.mockResolvedValue(undefined);

    mockAuthzService.requirePermission.mockResolvedValue(undefined);
    mockAuthzService.writeTuplesOrThrow.mockResolvedValue(undefined);
    mockAuthzService.deleteTuples.mockResolvedValue(undefined);
  });

  // ── Authorization ─────────────────────────────────────────────────────────

  describe('authorization', () => {
    it('super admin bypasses all FGA checks and succeeds', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });

      const result = await service.create(authContext, validBody);

      expect(result).toEqual({ id: newUserId });
      expect(mockAuthzService.requirePermission).not.toHaveBeenCalled();
      expect(mockAuth.createUser).toHaveBeenCalledOnce();
    });

    it('super admin can create a new platform admin account → success', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });

      const result = await service.create(authContext, platformAdminBody);

      expect(result).toEqual({ id: newUserId });
      expect(mockAuthzService.requirePermission).not.toHaveBeenCalled();
      expect(mockAuth.createUser).toHaveBeenCalledOnce();
    });

    it('non-super-admin with can_create_users on district → success', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: false });
      mockAuthzService.requirePermission.mockResolvedValue(undefined);

      const result = await service.create(authContext, validBody);

      expect(result).toEqual({ id: newUserId });
      expect(mockAuthzService.requirePermission).toHaveBeenCalledWith(
        authContext.userId,
        FgaRelation.CAN_CREATE_USERS,
        `district:${districtId}`,
      );
    });

    it('non-super admin with can_create_users on district cannot create a platform admin account → 403', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: false });

      await expect(service.create(authContext, platformAdminBody)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
      expect(mockUserRepo.createWithMemberships).not.toHaveBeenCalled();
      expect(mockAuthzService.writeTuplesOrThrow).not.toHaveBeenCalled();
    });

    it('class membership: checks can_create_users on parent school, not the class', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: false });
      const body = {
        ...validBody,
        memberships: [{ entityType: EntityType.CLASS, entityId: classId, role: UserRole.STUDENT }],
      };
      mockUserRepo.findClassParentSchool.mockResolvedValue(schoolId);

      await service.create(authContext, body);

      expect(mockUserRepo.findClassParentSchool).toHaveBeenCalledWith(classId);
      expect(mockAuthzService.requirePermission).toHaveBeenCalledWith(
        authContext.userId,
        FgaRelation.CAN_CREATE_USERS,
        `school:${schoolId}`,
      );
    });

    it('class membership with non-existent class → 422 before any writes', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: false });
      const body = {
        ...validBody,
        memberships: [{ entityType: EntityType.CLASS, entityId: classId, role: UserRole.STUDENT }],
      };
      mockUserRepo.findClassParentSchool.mockResolvedValue(null);

      await expect(service.create(authContext, body)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
      expect(mockUserRepo.createWithMemberships).not.toHaveBeenCalled();
    });

    it('family membership skips FGA check entirely', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: false });
      const body = {
        ...validBody,
        memberships: [{ entityType: EntityType.FAMILY, entityId: 'family-uuid', role: UserFamilyRole.PARENT }],
      };

      await service.create(authContext, body);

      expect(mockAuthzService.requirePermission).not.toHaveBeenCalled();
    });

    it('super admin: class with non-existent classId → 422 before any writes', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const body = {
        ...validBody,
        memberships: [{ entityType: EntityType.CLASS, entityId: classId, role: UserRole.STUDENT }],
      };
      mockUserRepo.findClassParentSchool.mockResolvedValue(null);

      await expect(service.create(authContext, body)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });

    it('super admin: non-existent district entityId → 422 before Firebase call', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockDistrictRepo.getActiveById.mockResolvedValue(null);

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });

    it('super admin: non-existent group entityId → 422 before Firebase call', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const body = {
        ...validBody,
        memberships: [{ entityType: EntityType.GROUP, entityId: groupId, role: UserRole.STUDENT }],
      };
      mockGroupRepo.getActiveById.mockResolvedValue(null);

      await expect(service.create(authContext, body)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });

    it('super admin: non-existent school entityId → 422 before Firebase call', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const body = {
        ...validBody,
        memberships: [{ entityType: EntityType.SCHOOL, entityId: schoolId, role: UserRole.STUDENT }],
      };
      mockSchoolRepo.getActiveById.mockResolvedValue(null);

      await expect(service.create(authContext, body)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });

    it('super admin: non-existent family entityId → 422 before Firebase call', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const familyId = 'family-uuid-1';
      const body = {
        ...validBody,
        memberships: [{ entityType: EntityType.FAMILY, entityId: familyId, role: UserFamilyRole.CHILD }],
      };
      mockFamilyRepo.getActiveById.mockResolvedValue(null);

      await expect(service.create(authContext, body)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });
  });

  // ── Pre-flight uniqueness ──────────────────────────────────────────────────

  describe('pre-flight uniqueness check', () => {
    it('email already in DB → 409 without calling Firebase', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockUserRepo.existsByUniqueFields.mockResolvedValue(true);

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });

    it('Firebase getUserByEmail finds existing account → 409 without DB write', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockAuth.getUserByEmail.mockResolvedValue({ uid: 'existing-uid' });

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockUserRepo.createWithMemberships).not.toHaveBeenCalled();
    });

    it('Firebase getUserByEmail throws non-auth/user-not-found error → 500', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockAuth.getUserByEmail.mockRejectedValue(makeFirebaseError('auth/internal-error'));

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    });
  });

  // ── Firebase Auth createUser ───────────────────────────────────────────────

  describe('Firebase Auth createUser', () => {
    it('auth/email-already-exists → 409', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockAuth.createUser.mockRejectedValue(makeFirebaseError('auth/email-already-exists'));

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockUserRepo.createWithMemberships).not.toHaveBeenCalled();
    });

    it('auth/too-many-requests → 429', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockAuth.createUser.mockRejectedValue(makeFirebaseError('auth/too-many-requests'));

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.TOO_MANY_REQUESTS,
        code: ApiErrorCode.RATE_LIMITED,
      });
      expect(mockUserRepo.createWithMemberships).not.toHaveBeenCalled();
    });

    it('unknown Firebase error → 500', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockAuth.createUser.mockRejectedValue(makeFirebaseError('auth/unknown'));

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    });
  });

  // ── DB write + compensation ────────────────────────────────────────────────

  describe('DB write failure', () => {
    it('DB unique violation → calls deleteUser compensation → 409', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockUserRepo.createWithMemberships.mockRejectedValue(makeDrizzleUniqueError());

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(firebaseUid);
      // createWithMemberships threw, so newUserId was never set — DB row delete must not be attempted
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
      expect(mockAuthzService.writeTuplesOrThrow).not.toHaveBeenCalled();
    });

    it('DB FK violation → calls deleteUser compensation → 422', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockUserRepo.createWithMemberships.mockRejectedValue(makeDrizzleFkError());

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(firebaseUid);
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });

    it('DB generic error → calls deleteUser compensation → 500', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockUserRepo.createWithMemberships.mockRejectedValue(new Error('connection timeout'));

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(firebaseUid);
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });

    it('DB failure + deleteUser compensation failure → returns 500 and logs with full context', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockUserRepo.createWithMemberships.mockRejectedValue(new Error('db error'));
      mockAuth.deleteUser.mockRejectedValue(new Error('firebase delete failed'));

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ context: expect.objectContaining({ firebaseUid }) }),
        expect.stringContaining('compensation failed'),
      );
    });
  });

  // ── FGA write + full compensation ─────────────────────────────────────────

  describe('FGA write failure', () => {
    it('FGA writeTuplesOrThrow fails → deleteTuples + DB delete + deleteUser all called', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockAuthzService.writeTuplesOrThrow.mockRejectedValue(new Error('FGA unavailable'));

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });

      // FGA compensation
      expect(mockAuthzService.deleteTuples).toHaveBeenCalledOnce();
      // DB compensation
      expect(mockUserRepo.delete).toHaveBeenCalledWith({ id: newUserId });
      // Firebase compensation
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(firebaseUid);
    });

    it('FGA failure + DB delete compensation failure → still returns 500 and logs', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      mockAuthzService.writeTuplesOrThrow.mockRejectedValue(new Error('FGA down'));
      mockUserRepo.delete.mockRejectedValue(new Error('db delete failed'));

      await expect(service.create(authContext, validBody)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ context: expect.objectContaining({ newUserId }) }),
        expect.stringContaining('DB delete compensation failed'),
      );
    });
  });

  // ──  ─────────────────────────────────────────────────

  // ── Happy path end-to-end ─────────────────────────────────────────────────

  describe('happy path', () => {
    it('writes Auth → DB → FGA in order and returns new user id', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const callOrder: string[] = [];

      mockAuth.createUser.mockImplementation(async () => {
        callOrder.push('firebase');
        return { uid: firebaseUid };
      });
      mockUserRepo.createWithMemberships.mockImplementation(async () => {
        callOrder.push('db');
        return { id: newUserId };
      });
      mockAuthzService.writeTuplesOrThrow.mockImplementation(async () => {
        callOrder.push('fga');
      });

      const result = await service.create(authContext, validBody);

      expect(result).toEqual({ id: newUserId });
      expect(callOrder).toEqual(['firebase', 'db', 'fga']);
    });

    it('uses provided assessmentPid instead of generating one', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const body = { ...validBody, identifiers: { pid: 'custom-pid' } };

      await service.create(authContext, body);

      expect(mockUserRepo.createWithMemberships).toHaveBeenCalledWith(
        expect.objectContaining({ assessmentPid: 'custom-pid' }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('admin-tier class role is skipped in FGA tuples (FGA_CLASS_VALID_ROLES)', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const body = {
        ...validBody,
        memberships: [
          // administrator is excluded from FGA_CLASS_VALID_ROLES
          { entityType: EntityType.CLASS, entityId: classId, role: UserRole.ADMINISTRATOR as UserRole },
        ],
      };

      await service.create(authContext, body);

      // writeTuplesOrThrow should have been called with empty tuples (no class tuple for admin role)
      expect(mockAuthzService.writeTuplesOrThrow).toHaveBeenCalledWith([]);
    });

    it('multiple membership types write correct junction rows', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const body = {
        ...validBody,
        memberships: [
          { entityType: EntityType.DISTRICT, entityId: districtId, role: UserRole.PLATFORM_ADMIN as UserRole },
          { entityType: EntityType.SCHOOL, entityId: schoolId, role: UserRole.TEACHER as UserRole },
          { entityType: EntityType.GROUP, entityId: groupId, role: UserRole.STUDENT as UserRole },
        ],
      };

      await service.create(authContext, body);

      const [, orgMemberships, classMemberships, groupMemberships] = mockUserRepo.createWithMemberships.mock.calls[0]!;

      expect(orgMemberships).toHaveLength(2); // district + school
      expect(classMemberships).toHaveLength(0);
      expect(groupMemberships).toHaveLength(1);
    });
  });
});
