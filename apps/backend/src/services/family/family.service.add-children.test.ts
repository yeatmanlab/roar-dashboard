/**
 * Unit tests for FamilyService.addChildren.
 *
 * Covers the saga: family/auth checks → activation-code resolution → size cap → pre-flight →
 * Firebase Auth (cumulative rollback) → DB transaction → FGA, plus every compensation branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { FAMILY_SIZE_LIMIT } from '@roar-dashboard/api-contract';

vi.mock('../../clients/firebase-auth.clients', () => ({
  FirebaseAuthClient: {
    createUser: vi.fn(),
    getUserByEmail: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

import { FamilyService } from './family.service';
import { FirebaseAuthClient } from '../../clients/firebase-auth.clients';
import { createMockFamilyRepository } from '../../test-support/repositories/family.repository';
import { createMockUserRepository } from '../../test-support/repositories/user.repository';
import { createMockGroupRepository } from '../../test-support/repositories/group.repository';
import { createMockInvitationCodeRepository } from '../../test-support/repositories/invitation-code.repository';
import { createMockRosterProviderIdRepository } from '../../test-support/repositories/roster-provider-id.repository';
import { createMockAuthorizationService } from '../../test-support/services/authorization.service';
import { FamilyFactory } from '../../test-support/factories/family.factory';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';
import { logger } from '../../logger';
import type { AddChildServiceInput } from './family.service';
import type { CoreTransaction } from '../../db/clients';

const mockAuth = FirebaseAuthClient as unknown as {
  createUser: ReturnType<typeof vi.fn>;
  getUserByEmail: ReturnType<typeof vi.fn>;
  deleteUser: ReturnType<typeof vi.fn>;
};

function makeFirebaseError(code: string): { code: string; message: string } {
  return { code, message: `Firebase error: ${code}` };
}

const FAMILY_ID = 'family-uuid-1';
const PARENT_ID = 'parent-uuid-1';
const GROUP_ID = 'group-uuid-1';
const CHILD_ID_1 = 'child-uuid-1';
const CHILD_ID_2 = 'child-uuid-2';

const parentAuth = { userId: PARENT_ID, isSuperAdmin: false };
const superAdminAuth = { userId: 'super-uuid-1', isSuperAdmin: true };
const strangerAuth = { userId: 'stranger-uuid-1', isSuperAdmin: false };

function makeChild(suffix: string, overrides: Partial<AddChildServiceInput> = {}): AddChildServiceInput {
  return {
    email: `child-${suffix}@example.com`,
    password: 'Password123!',
    name: { first: `Kid${suffix}`, last: 'Doe' },
    dob: '2015-01-01',
    grade: '3',
    activationCode: 'CODE123',
    ...overrides,
  };
}

describe('FamilyService.addChildren', () => {
  let mockFamilyRepo: ReturnType<typeof createMockFamilyRepository>;
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;
  let mockGroupRepo: ReturnType<typeof createMockGroupRepository>;
  let mockCodeRepo: ReturnType<typeof createMockInvitationCodeRepository>;
  let mockRosterRepo: ReturnType<typeof createMockRosterProviderIdRepository>;
  let mockAuthorizationService: ReturnType<typeof createMockAuthorizationService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFamilyRepo = createMockFamilyRepository();
    mockUserRepo = createMockUserRepository();
    mockGroupRepo = createMockGroupRepository();
    mockCodeRepo = createMockInvitationCodeRepository();
    mockRosterRepo = createMockRosterProviderIdRepository();
    mockAuthorizationService = createMockAuthorizationService();

    // Default: family is active, caller is a parent, code resolves, group is active, no email conflicts.
    mockFamilyRepo.getById.mockResolvedValue(FamilyFactory.build({ id: FAMILY_ID, rosteringEnded: null }));
    mockFamilyRepo.getUserRolesInFamily.mockResolvedValue(['parent']);
    mockFamilyRepo.countActiveMembers.mockResolvedValue(1);
    mockCodeRepo.findValidByCode.mockResolvedValue({
      id: 'code-uuid-1',
      groupId: GROUP_ID,
      code: 'CODE123',
      validFrom: new Date('2020-01-01'),
      validTo: null,
      createdAt: new Date('2020-01-01'),
      updatedAt: null,
    });
    mockGroupRepo.getById.mockResolvedValue(GroupFactory.build({ id: GROUP_ID, rosteringEnded: null }));
    mockUserRepo.existsByUniqueFields.mockResolvedValue(false);
    mockAuth.getUserByEmail.mockRejectedValue(makeFirebaseError(FIREBASE_ERROR_CODES.AUTH.USER_NOT_FOUND));
    let uidSeq = 0;
    mockAuth.createUser.mockImplementation(async () => ({ uid: `fb-uid-${++uidSeq}` }));

    mockFamilyRepo.runTransaction.mockImplementation(async ({ fn }) => fn({} as CoreTransaction));
    mockFamilyRepo.addChildren.mockResolvedValue({ ids: [CHILD_ID_1] });
    mockRosterRepo.create.mockResolvedValue({ id: CHILD_ID_1 });
  });

  function makeService() {
    return FamilyService({
      familyRepository: mockFamilyRepo,
      userRepository: mockUserRepo,
      groupRepository: mockGroupRepo,
      invitationCodeRepository: mockCodeRepo,
      rosterProviderIdRepository: mockRosterRepo,
      authorizationService: mockAuthorizationService,
    });
  }

  describe('family + authorization', () => {
    it('returns 404 if the family does not exist', async () => {
      mockFamilyRepo.getById.mockResolvedValue(null);
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
      });
    });

    it('returns 422 if the family has been rostered out', async () => {
      mockFamilyRepo.getById.mockResolvedValue(
        FamilyFactory.build({ id: FAMILY_ID, rosteringEnded: new Date('2020-01-01') }),
      );
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
    });

    it('returns 403 if the caller is not a parent of the family', async () => {
      mockFamilyRepo.getUserRolesInFamily.mockResolvedValue(['child']);
      await expect(
        makeService().addChildren(strangerAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('allows super admin to add children to any family', async () => {
      mockFamilyRepo.getUserRolesInFamily.mockResolvedValue([]); // would be 403 for non-super-admin
      const result = await makeService().addChildren(superAdminAuth, FAMILY_ID, { children: [makeChild('1')] });
      expect(result.ids).toEqual([CHILD_ID_1]);
      // The role check is skipped for super admin
      expect(mockFamilyRepo.getUserRolesInFamily).not.toHaveBeenCalled();
    });
  });

  describe('activation codes', () => {
    it('returns 422 when an activation code is invalid or expired', async () => {
      mockCodeRepo.findValidByCode.mockResolvedValue(null);
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
    });

    it('returns 422 when an activation code resolves to a rostered-out group', async () => {
      mockGroupRepo.getById.mockResolvedValue(
        GroupFactory.build({ id: GROUP_ID, rosteringEnded: new Date('2020-01-01') }),
      );
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
    });

    it('deduplicates activation codes — two children sharing a code resolve to one lookup', async () => {
      mockFamilyRepo.addChildren.mockResolvedValue({ ids: [CHILD_ID_1, CHILD_ID_2] });

      await makeService().addChildren(parentAuth, FAMILY_ID, {
        children: [makeChild('1'), makeChild('2')],
      });

      // Code lookup happens once even though there are two children with the same code
      expect(mockCodeRepo.findValidByCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('family-size cap', () => {
    it('returns 422 when existing members + new children exceeds the cap', async () => {
      mockFamilyRepo.countActiveMembers.mockResolvedValue(FAMILY_SIZE_LIMIT - 1);
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1'), makeChild('2')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      });
    });

    it('allows the request that exactly fills the cap', async () => {
      mockFamilyRepo.countActiveMembers.mockResolvedValue(FAMILY_SIZE_LIMIT - 1);
      mockFamilyRepo.addChildren.mockResolvedValue({ ids: [CHILD_ID_1] });

      await expect(makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] })).resolves.toEqual({
        ids: [CHILD_ID_1],
      });
    });
  });

  describe('email uniqueness', () => {
    it('returns 400 if two children in the same request share an email (case-insensitive)', async () => {
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, {
          children: [makeChild('a', { email: 'dup@example.com' }), makeChild('b', { email: 'DUP@example.com' })],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });

    it('returns 409 if a child email already exists in the users table', async () => {
      mockUserRepo.existsByUniqueFields.mockResolvedValue(true);
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });

    it('returns 409 if a child email already exists in Firebase Auth', async () => {
      mockAuth.getUserByEmail.mockResolvedValue({ uid: 'pre-existing-uid' });
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });
  });

  describe('Firebase createUser failures (cumulative rollback)', () => {
    it('deletes already-created Firebase accounts when a later createUser returns email-already-exists', async () => {
      mockAuth.createUser
        .mockResolvedValueOnce({ uid: 'fb-uid-1' })
        .mockRejectedValueOnce(makeFirebaseError(FIREBASE_ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS));

      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1'), makeChild('2')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });

      // The first UID was rolled back
      expect(mockAuth.deleteUser).toHaveBeenCalledWith('fb-uid-1');
      // No DB write happened
      expect(mockFamilyRepo.addChildren).not.toHaveBeenCalled();
    });

    it('maps auth/too-many-requests to 429', async () => {
      mockAuth.createUser.mockRejectedValue(makeFirebaseError(FIREBASE_ERROR_CODES.AUTH.TOO_MANY_REQUESTS));
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.TOO_MANY_REQUESTS,
      });
    });

    it('logs orphaned-account warning when cumulative Firebase rollback delete itself fails', async () => {
      // Child 1 succeeds, child 2 fails creation, and the rollback of child 1 also fails.
      mockAuth.createUser
        .mockResolvedValueOnce({ uid: 'fb-uid-1' })
        .mockRejectedValueOnce(makeFirebaseError(FIREBASE_ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS));
      mockAuth.deleteUser.mockRejectedValueOnce(new Error('Firebase delete blew up'));

      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1'), makeChild('2')] }),
      ).rejects.toMatchObject({ statusCode: StatusCodes.CONFLICT });

      // The original error still propagates; the orphaned-account paper trail is logged
      expect(mockAuth.deleteUser).toHaveBeenCalledWith('fb-uid-1');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          context: expect.objectContaining({ firebaseUid: 'fb-uid-1', reason: 'step 6 failure' }),
        }),
        'Firebase deleteUser compensation failed — orphaned auth account requires manual cleanup',
      );
    });
  });

  describe('DB transaction failures', () => {
    it('rolls back every Firebase account when the DB transaction fails', async () => {
      mockAuth.createUser.mockResolvedValueOnce({ uid: 'fb-uid-1' }).mockResolvedValueOnce({ uid: 'fb-uid-2' });
      mockFamilyRepo.addChildren.mockRejectedValue(new Error('Connection reset'));

      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1'), makeChild('2')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });

      expect(mockAuth.deleteUser).toHaveBeenCalledWith('fb-uid-1');
      expect(mockAuth.deleteUser).toHaveBeenCalledWith('fb-uid-2');
    });

    it('maps a unique-violation during DB write (lost race on email) to 409', async () => {
      mockFamilyRepo.addChildren.mockRejectedValue(Object.assign(new Error('unique violation'), { code: '23505' }));
      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockAuth.deleteUser).toHaveBeenCalled();
    });
  });

  describe('FGA write failures', () => {
    beforeEach(() => {
      mockAuthorizationService.writeTuplesOrThrow.mockRejectedValue(new Error('OpenFGA down'));
    });

    it('deletes tuples, DB rows, and Firebase accounts before throwing 500', async () => {
      mockFamilyRepo.addChildren.mockResolvedValue({ ids: [CHILD_ID_1] });

      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toBeInstanceOf(ApiError);

      // Tuple delete
      expect(mockAuthorizationService.deleteTuples).toHaveBeenCalledTimes(1);
      // DB rollback transaction opened
      expect(mockFamilyRepo.runTransaction).toHaveBeenCalledTimes(2);
      // Firebase compensation
      expect(mockAuth.deleteUser).toHaveBeenCalled();
    });

    it('logs orphaned-record warning when DB delete compensation itself fails', async () => {
      mockFamilyRepo.addChildren.mockResolvedValue({ ids: [CHILD_ID_1] });
      let txCalls = 0;
      mockFamilyRepo.runTransaction.mockImplementation(async ({ fn }) => {
        txCalls += 1;
        if (txCalls === 1) {
          return fn({} as CoreTransaction);
        }
        throw new Error('DB rollback failed');
      });

      await expect(
        makeService().addChildren(parentAuth, FAMILY_ID, { children: [makeChild('1')] }),
      ).rejects.toBeInstanceOf(ApiError);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ familyId: FAMILY_ID, childIds: [CHILD_ID_1] }),
        }),
        'DB delete compensation failed after FGA write failure — manual cleanup required',
      );
    });
  });

  describe('happy path', () => {
    it('returns the new child ids and writes everything', async () => {
      mockFamilyRepo.addChildren.mockResolvedValue({ ids: [CHILD_ID_1, CHILD_ID_2] });

      const result = await makeService().addChildren(parentAuth, FAMILY_ID, {
        children: [makeChild('1'), makeChild('2')],
      });

      expect(result.ids).toEqual([CHILD_ID_1, CHILD_ID_2]);
      expect(mockAuth.createUser).toHaveBeenCalledTimes(2);
      expect(mockFamilyRepo.addChildren).toHaveBeenCalledTimes(1);
      expect(mockRosterRepo.create).toHaveBeenCalledTimes(2);
      // Two children × 2 tuples each (family + group) = 4 tuples
      const writeArgs = mockAuthorizationService.writeTuplesOrThrow.mock.calls[0]![0];
      expect(writeArgs).toHaveLength(4);
      // No compensation
      expect(mockAuth.deleteUser).not.toHaveBeenCalled();
    });
  });
});
