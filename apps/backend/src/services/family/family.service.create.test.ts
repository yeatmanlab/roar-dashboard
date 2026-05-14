/**
 * Unit tests for FamilyService.create.
 *
 * Covers the full saga: pre-flight → Firebase Auth → DB transaction → FGA,
 * and every compensation branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';

// Mock FirebaseAuthClient directly — the service imports it at module level.
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
import { createMockRosterProviderIdRepository } from '../../test-support/repositories/roster-provider-id.repository';
import { createMockAuthorizationService } from '../../test-support/services/authorization.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';
import { FAMILIES_CREATED_BY_UNIQ_IDX } from '../../repositories/family.repository';
import { logger } from '../../logger';
import type { CoreTransaction } from '../../db/clients';

const mockAuth = FirebaseAuthClient as unknown as {
  createUser: ReturnType<typeof vi.fn>;
  getUserByEmail: ReturnType<typeof vi.fn>;
  deleteUser: ReturnType<typeof vi.fn>;
};

function makeFirebaseError(code: string): { code: string; message: string } {
  return { code, message: `Firebase error: ${code}` };
}

function makeUniqueViolationOn(constraint: string) {
  return Object.assign(new Error('unique violation'), { code: '23505', constraint });
}

function makeGenericUniqueViolation() {
  return Object.assign(new Error('unique violation'), { code: '23505', constraint: 'users_email_lower_uniqIdx' });
}

const validInput = {
  email: 'parent@example.com',
  password: 'password123',
  name: { first: 'Pat', last: 'Parent' },
};

const FIREBASE_UID = 'fb-uid-abc';
const CARETAKER_ID = 'caretaker-uuid-1';
const FAMILY_ID = 'family-uuid-1';

describe('FamilyService.create', () => {
  let mockFamilyRepo: ReturnType<typeof createMockFamilyRepository>;
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;
  let mockRosterRepo: ReturnType<typeof createMockRosterProviderIdRepository>;
  let mockAuthorizationService: ReturnType<typeof createMockAuthorizationService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFamilyRepo = createMockFamilyRepository();
    mockUserRepo = createMockUserRepository();
    mockRosterRepo = createMockRosterProviderIdRepository();
    mockAuthorizationService = createMockAuthorizationService();

    // Default: the email is fresh on both sides.
    mockUserRepo.existsByUniqueFields.mockResolvedValue(false);
    mockAuth.getUserByEmail.mockRejectedValue(makeFirebaseError(FIREBASE_ERROR_CODES.AUTH.USER_NOT_FOUND));
    mockAuth.createUser.mockResolvedValue({ uid: FIREBASE_UID });

    // Default transaction: invoke the callback with a dummy tx and surface its result.
    mockFamilyRepo.runTransaction.mockImplementation(async ({ fn }) => fn({} as CoreTransaction));
    mockFamilyRepo.createWithCaretaker.mockResolvedValue({ caretakerId: CARETAKER_ID, familyId: FAMILY_ID });
    mockRosterRepo.create.mockResolvedValue({ id: CARETAKER_ID });
  });

  function makeService() {
    return FamilyService({
      familyRepository: mockFamilyRepo,
      userRepository: mockUserRepo,
      rosterProviderIdRepository: mockRosterRepo,
      authorizationService: mockAuthorizationService,
    });
  }

  describe('happy path', () => {
    it('returns the new family id and writes all four rows + FGA tuple', async () => {
      const result = await makeService().create(validInput);

      expect(result).toEqual({ id: FAMILY_ID });
      expect(mockAuth.createUser).toHaveBeenCalledWith({
        email: validInput.email,
        password: validInput.password,
        displayName: 'Pat Parent',
      });
      expect(mockFamilyRepo.createWithCaretaker).toHaveBeenCalledTimes(1);
      expect(mockRosterRepo.create).toHaveBeenCalledTimes(1);
      const rosterArgs = mockRosterRepo.create.mock.calls[0]![0];
      expect(rosterArgs.data).toMatchObject({
        providerType: 'dashboard',
        providerId: CARETAKER_ID,
        partnerId: FAMILY_ID,
        entityType: 'user',
        entityId: CARETAKER_ID,
      });
      expect(mockAuthorizationService.writeTuplesOrThrow).toHaveBeenCalledTimes(1);
      const tuples = mockAuthorizationService.writeTuplesOrThrow.mock.calls[0]![0];
      expect(tuples).toHaveLength(1);
      expect(tuples[0]).toMatchObject({
        user: `user:${CARETAKER_ID}`,
        relation: 'parent',
        object: `family:${FAMILY_ID}`,
      });
      // No Firebase compensation on the happy path
      expect(mockAuth.deleteUser).not.toHaveBeenCalled();
    });

    it('passes optional location fields through to the family insert', async () => {
      await makeService().create({
        ...validInput,
        location: { city: 'Stanford', stateProvince: 'CA', country: 'US' },
      });

      const [, familyData] = mockFamilyRepo.createWithCaretaker.mock.calls[0]!;
      expect(familyData).toMatchObject({
        locationCity: 'Stanford',
        locationStateProvince: 'CA',
        locationCountry: 'US',
      });
    });
  });

  describe('pre-flight email uniqueness', () => {
    it('throws 409 if the email is already in the users table', async () => {
      mockUserRepo.existsByUniqueFields.mockResolvedValue(true);

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
      expect(mockFamilyRepo.createWithCaretaker).not.toHaveBeenCalled();
    });

    it('throws 409 if the email exists in Firebase but not in the DB', async () => {
      mockAuth.getUserByEmail.mockResolvedValue({ uid: 'pre-existing-uid' });

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });

    it('throws 500 if the Firebase pre-flight check returns an unexpected error', async () => {
      mockAuth.getUserByEmail.mockRejectedValue(new Error('Network down'));

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
      expect(mockAuth.createUser).not.toHaveBeenCalled();
    });
  });

  describe('Firebase createUser failures', () => {
    it('maps `auth/email-already-exists` to 409 with no DB writes', async () => {
      mockAuth.createUser.mockRejectedValue(makeFirebaseError(FIREBASE_ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS));

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockFamilyRepo.createWithCaretaker).not.toHaveBeenCalled();
      expect(mockAuth.deleteUser).not.toHaveBeenCalled();
    });

    it('maps `auth/too-many-requests` to 429', async () => {
      mockAuth.createUser.mockRejectedValue(makeFirebaseError(FIREBASE_ERROR_CODES.AUTH.TOO_MANY_REQUESTS));

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.TOO_MANY_REQUESTS,
        code: ApiErrorCode.RATE_LIMITED,
        message: ApiErrorMessage.RATE_LIMITED,
      });
    });

    it('maps unexpected Firebase errors to 500', async () => {
      mockAuth.createUser.mockRejectedValue(new Error('Firebase down'));

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('DB transaction failures', () => {
    it('maps the families_created_by_uniq_idx violation to 422 and deletes the Firebase account', async () => {
      mockFamilyRepo.createWithCaretaker.mockRejectedValue(makeUniqueViolationOn(FAMILIES_CREATED_BY_UNIQ_IDX));

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        message: ApiErrorMessage.UNPROCESSABLE_ENTITY,
      });
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(FIREBASE_UID);
    });

    it('maps any other unique violation to 409 and deletes the Firebase account', async () => {
      mockFamilyRepo.createWithCaretaker.mockRejectedValue(makeGenericUniqueViolation());

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.CONFLICT,
      });
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(FIREBASE_UID);
    });

    it('maps an unexpected DB error to 500 and deletes the Firebase account', async () => {
      mockFamilyRepo.createWithCaretaker.mockRejectedValue(new Error('Connection reset'));

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(FIREBASE_UID);
    });

    it('swallows compensation delete failures (orphaned account is logged, original error propagates)', async () => {
      mockFamilyRepo.createWithCaretaker.mockRejectedValue(new Error('Connection reset'));
      mockAuth.deleteUser.mockRejectedValue(new Error('Firebase delete blew up'));

      await expect(makeService().create(validInput)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
      // Delete was still attempted
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(FIREBASE_UID);
      // The orphaned-account paper trail is logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          context: expect.objectContaining({ firebaseUid: FIREBASE_UID, reason: 'step 3 failure' }),
        }),
        'Firebase deleteUser compensation failed — orphaned auth account requires manual cleanup',
      );
    });
  });

  describe('FGA write failures', () => {
    beforeEach(() => {
      mockAuthorizationService.writeTuplesOrThrow.mockRejectedValue(new Error('OpenFGA down'));
      // Allow the DB rollback transaction to run
      mockFamilyRepo.runTransaction.mockImplementation(async ({ fn }) => fn({} as CoreTransaction));
    });

    it('attempts tuple delete, DB row delete, and Firebase delete before throwing 500', async () => {
      await expect(makeService().create(validInput)).rejects.toBeInstanceOf(ApiError);

      // Tuple delete attempted
      expect(mockAuthorizationService.deleteTuples).toHaveBeenCalledTimes(1);

      // DB delete transaction opened
      expect(mockFamilyRepo.runTransaction).toHaveBeenCalledTimes(2);
      expect(mockRosterRepo.deleteByEntityId).toHaveBeenCalledWith(CARETAKER_ID, expect.anything());

      // Firebase compensation
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(FIREBASE_UID);
    });

    it('logs orphaned-record warning when DB delete compensation itself fails', async () => {
      // The second runTransaction is the rollback transaction — let it throw.
      let txCalls = 0;
      mockFamilyRepo.runTransaction.mockImplementation(async ({ fn }) => {
        txCalls += 1;
        if (txCalls === 1) {
          // First call is the original DB write transaction — succeed.
          return fn({} as CoreTransaction);
        }
        // Second call is the FGA-failure rollback — fail.
        throw new Error('DB delete blew up');
      });

      await expect(makeService().create(validInput)).rejects.toBeInstanceOf(ApiError);

      // The orphaned-record paper trail is logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            caretakerId: CARETAKER_ID,
            familyId: FAMILY_ID,
            firebaseUid: FIREBASE_UID,
          }),
        }),
        'DB delete compensation failed after FGA write failure — manual cleanup required',
      );
      // Firebase compensation is still attempted
      expect(mockAuth.deleteUser).toHaveBeenCalledWith(FIREBASE_UID);
    });
  });
});
