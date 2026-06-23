import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserImportService, type ImportUserRowInput } from './user-import.service';
import { createMockUserRepository } from '../../test-support/repositories/user.repository';
import { createMockUserService } from '../../test-support/services/user.service';
import { createMockAuthorizationService } from '../../test-support/services/authorization.service';
import { UserFactory, AuthContextFactory } from '../../test-support/factories/user.factory';
import { FirebaseAuthClient } from '../../clients/firebase-auth.clients';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';
import { UserRole } from '../../enums/user-role.enum';
import { UserType } from '../../enums/user-type.enum';
import { EntityType } from '../../types/entity-type';
import type { FirebaseScryptParams } from './utils/firebase-password-hash';

// Public Firebase scrypt test-vector params — fine for tests (no real secrets needed).
const SCRYPT_PARAMS: FirebaseScryptParams = {
  signerKey: Buffer.from(
    'jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA==',
    'base64',
  ),
  saltSeparator: Buffer.from('Bw==', 'base64'),
  rounds: 8,
  memoryCost: 14,
};

const firebaseUserNotFound = Object.assign(new Error('no user'), { code: FIREBASE_ERROR_CODES.AUTH.USER_NOT_FOUND });

const makeRow = (overrides: Partial<ImportUserRowInput> = {}): ImportUserRowInput => ({
  email: 'student@example.org',
  password: 'password123',
  name: { first: 'Ada', last: 'Lovelace' },
  userType: UserType.STUDENT,
  memberships: [{ entityType: EntityType.SCHOOL, entityId: 'school-1', role: UserRole.STUDENT }],
  ...overrides,
});

const forbidden = () => new ApiError(ApiErrorMessage.FORBIDDEN, { statusCode: 403, code: ApiErrorCode.AUTH_FORBIDDEN });

describe('UserImportService.bulkImport', () => {
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;
  let mockUserService: ReturnType<typeof createMockUserService>;
  let mockAuthz: ReturnType<typeof createMockAuthorizationService>;
  const getUserByEmail = vi.fn();
  const importUsers = vi.fn();
  const mockFirebaseAuth = { getUserByEmail, importUsers } as unknown as typeof FirebaseAuthClient;

  const superAdmin = AuthContextFactory.build({ isSuperAdmin: true });
  const partnerAdmin = AuthContextFactory.build({ isSuperAdmin: false });

  const buildService = () =>
    UserImportService({
      userService: mockUserService,
      userRepository: mockUserRepository,
      authorizationService: mockAuthz,
      firebaseAuth: mockFirebaseAuth,
      scryptParams: SCRYPT_PARAMS,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRepository = createMockUserRepository();
    mockUserService = createMockUserService();
    mockAuthz = createMockAuthorizationService();

    // Happy-path defaults: nobody exists yet, nothing collides, persistence succeeds.
    mockUserRepository.findByEmails.mockResolvedValue([]);
    mockUserRepository.existsByUniqueFields.mockResolvedValue(false);
    mockUserRepository.findClassParentSchool.mockResolvedValue('school-parent');
    mockAuthz.requirePermission.mockResolvedValue(undefined);
    getUserByEmail.mockRejectedValue(firebaseUserNotFound);
    importUsers.mockResolvedValue({ successCount: 0, failureCount: 0, errors: [] });
    let counter = 0;
    mockUserService.createWithImportedAuth.mockImplementation(async () => ({ id: `new-user-${counter++}` }));
  });

  describe('create bin', () => {
    it('creates every row in a single importUsers call and persists each one', async () => {
      const rows = [makeRow({ email: 'a@example.org' }), makeRow({ email: 'b@example.org' })];

      const results = await buildService().bulkImport(superAdmin, rows);

      expect(importUsers).toHaveBeenCalledTimes(1);
      expect(importUsers.mock.calls[0]![0]).toHaveLength(2);
      expect(mockUserService.createWithImportedAuth).toHaveBeenCalledTimes(2);
      expect(results.every((r) => r.status === 'ok' && r.classification === 'created')).toBe(true);
    });

    it('passes the SCRYPT hash options to importUsers', async () => {
      await buildService().bulkImport(superAdmin, [makeRow()]);

      const options = importUsers.mock.calls[0]![1];
      expect(options.hash.algorithm).toBe('SCRYPT');
      expect(options.hash.rounds).toBe(8);
      expect(options.hash.memoryCost).toBe(14);
    });

    it('marks a within-batch duplicate email as a conflict, processing the first occurrence', async () => {
      const rows = [makeRow({ email: 'dup@example.org' }), makeRow({ email: 'DUP@example.org' })];

      const results = await buildService().bulkImport(superAdmin, rows);

      expect(results[0]!.status).toBe('ok');
      expect(results[1]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_CONFLICT } });
      expect(importUsers.mock.calls[0]![0]).toHaveLength(1);
    });

    it('fails a create row that is missing a password and excludes it from importUsers', async () => {
      const results = await buildService().bulkImport(superAdmin, [makeRow({ password: undefined })]);

      expect(results[0]!).toMatchObject({
        status: 'failed',
        classification: 'created',
        error: { code: ApiErrorCode.REQUEST_VALIDATION_FAILED },
      });
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('fails a create row that already exists in Postgres', async () => {
      mockUserRepository.existsByUniqueFields.mockResolvedValue(true);

      const results = await buildService().bulkImport(superAdmin, [makeRow()]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_CONFLICT } });
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('fails a create row whose email already exists in Firebase Auth', async () => {
      getUserByEmail.mockResolvedValue({ uid: 'existing' });

      const results = await buildService().bulkImport(superAdmin, [makeRow()]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_CONFLICT } });
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('fails only the row Firebase rejected in importUsers and persists the rest', async () => {
      importUsers.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        errors: [{ index: 0, error: { code: FIREBASE_ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS, message: 'exists' } }],
      });

      const rows = [makeRow({ email: 'a@example.org' }), makeRow({ email: 'b@example.org' })];
      const results = await buildService().bulkImport(superAdmin, rows);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_CONFLICT } });
      expect(results[1]!.status).toBe('ok');
      // Only the surviving row is persisted.
      expect(mockUserService.createWithImportedAuth).toHaveBeenCalledTimes(1);
    });

    it('fails only the row whose persistence throws, leaving the others successful', async () => {
      mockUserService.createWithImportedAuth
        .mockRejectedValueOnce(
          new ApiError(ApiErrorMessage.CONFLICT, { statusCode: 409, code: ApiErrorCode.RESOURCE_CONFLICT }),
        )
        .mockResolvedValueOnce({ id: 'new-user-ok' });

      const rows = [makeRow({ email: 'a@example.org' }), makeRow({ email: 'b@example.org' })];
      const results = await buildService().bulkImport(superAdmin, rows);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_CONFLICT } });
      expect(results[1]!).toMatchObject({ status: 'ok', id: 'new-user-ok' });
    });

    it('fails every prepared row when the whole importUsers call throws', async () => {
      importUsers.mockRejectedValue(new Error('admin sdk unavailable'));

      const results = await buildService().bulkImport(superAdmin, [makeRow()]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.EXTERNAL_SERVICE_FAILED } });
      expect(mockUserService.createWithImportedAuth).not.toHaveBeenCalled();
    });
  });

  describe('classification', () => {
    it('routes an existing user with no unenroll flag to the update bin', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([UserFactory.build({ email: 'exists@example.org' })]);

      const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'exists@example.org' })]);

      expect(results[0]!.classification).toBe('updated');
      expect(results[0]!.status).toBe('failed'); // update bin not yet implemented
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('routes an existing user with unenroll=true to the unenroll bin', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([UserFactory.build({ email: 'exists@example.org' })]);

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'exists@example.org', unenroll: true }),
      ]);

      expect(results[0]!.classification).toBe('unenrolled');
      expect(results[0]!.status).toBe('failed'); // unenroll bin not yet implemented
    });

    it('fails an unenroll request for a non-existent user', async () => {
      const results = await buildService().bulkImport(superAdmin, [makeRow({ unenroll: true })]);

      expect(results[0]!).toMatchObject({
        status: 'failed',
        classification: 'unenrolled',
        error: { code: ApiErrorCode.RESOURCE_NOT_FOUND },
      });
    });

    it('is case-insensitive when matching against existing users', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([UserFactory.build({ email: 'mixed@example.org' })]);

      const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'MIXED@example.org' })]);

      // Matched the existing user (routed to update), rather than treated as a new create.
      expect(results[0]!.classification).toBe('updated');
    });
  });

  describe('authorization', () => {
    it('fails a row the partner admin cannot create, but continues the batch', async () => {
      mockAuthz.requirePermission.mockRejectedValueOnce(forbidden()).mockResolvedValue(undefined);

      const rows = [makeRow({ email: 'denied@example.org' }), makeRow({ email: 'allowed@example.org' })];
      const results = await buildService().bulkImport(partnerAdmin, rows);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.AUTH_FORBIDDEN } });
      expect(results[1]!.status).toBe('ok');
    });

    it('bypasses FGA for super admins', async () => {
      await buildService().bulkImport(superAdmin, [makeRow()]);

      expect(mockAuthz.requirePermission).not.toHaveBeenCalled();
    });

    it('skips classification and import entirely when every row fails authorization', async () => {
      mockAuthz.requirePermission.mockRejectedValue(forbidden());

      const results = await buildService().bulkImport(partnerAdmin, [makeRow(), makeRow({ email: 'b@example.org' })]);

      expect(results.every((r) => r.status === 'failed' && r.error.code === ApiErrorCode.AUTH_FORBIDDEN)).toBe(true);
      expect(mockUserRepository.findByEmails).not.toHaveBeenCalled();
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('checks can_create_users against the parent school for class memberships', async () => {
      const rows = [
        makeRow({ memberships: [{ entityType: EntityType.CLASS, entityId: 'class-9', role: UserRole.STUDENT }] }),
      ];

      await buildService().bulkImport(partnerAdmin, rows);

      expect(mockUserRepository.findClassParentSchool).toHaveBeenCalledWith('class-9');
      expect(mockAuthz.requirePermission).toHaveBeenCalledWith(
        partnerAdmin.userId,
        expect.any(String),
        'school:school-parent',
      );
    });
  });
});
