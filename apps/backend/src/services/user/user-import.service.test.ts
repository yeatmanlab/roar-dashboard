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
import { UserFamilyRole } from '../../enums/user-family-role.enum';
import { UserType } from '../../enums/user-type.enum';
import { EntityType } from '../../types/entity-type';
import { FGA_CONDITION_ACTIVE_MEMBERSHIP, FgaRelation } from '../authorization/fga-constants';
import { getFirebaseScryptParamsFromEnv, hashPasswordForImport } from './utils/firebase-password-hash';
import type { FirebaseScryptParams } from './utils/firebase-password-hash';
import type { CoreTransaction } from '../../db/clients';

// Both wrap the real implementation by default (every create-bin test hashes for real), so a test
// can force either the "missing config" throw or a per-row hashing throw on demand.
vi.mock('./utils/firebase-password-hash', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/firebase-password-hash')>();
  return {
    ...actual,
    getFirebaseScryptParamsFromEnv: vi.fn(actual.getFirebaseScryptParamsFromEnv),
    hashPasswordForImport: vi.fn(actual.hashPasswordForImport),
  };
});

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

const makeRow = (overrides: Partial<ImportUserRowInput> = {}): ImportUserRowInput => ({
  email: 'student@example.org',
  password: 'password123',
  name: { first: 'Ada', last: 'Lovelace' },
  userType: UserType.STUDENT,
  memberships: [{ entityType: EntityType.SCHOOL, entityId: 'school-1', role: UserRole.STUDENT }],
  ...overrides,
});

const forbidden = () => new ApiError(ApiErrorMessage.FORBIDDEN, { statusCode: 403, code: ApiErrorCode.AUTH_FORBIDDEN });

const DEFAULT_DISTRICT_ID = 'district-1';

/** Build a `resolveDeclaredEntities` result, defaulting every entity type to "nothing resolved". */
const resolved = (overrides: {
  districts?: string[];
  schools?: [string, { districtId: string | null }][];
  classes?: [string, { schoolId: string; districtId: string }][];
  groups?: string[];
}) => ({
  districts: new Set(overrides.districts ?? []),
  schools: new Map(overrides.schools ?? []),
  classes: new Map(overrides.classes ?? []),
  groups: new Set(overrides.groups ?? []),
});

describe('UserImportService.bulkImport', () => {
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;
  let mockUserService: ReturnType<typeof createMockUserService>;
  let mockAuthz: ReturnType<typeof createMockAuthorizationService>;
  const getUsers = vi.fn();
  const importUsers = vi.fn();
  const updateUser = vi.fn();
  const mockFirebaseAuth = { getUsers, importUsers, updateUser } as unknown as typeof FirebaseAuthClient;

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

  // Omits scryptParams so the service falls through to getFirebaseScryptParamsFromEnv() — used
  // to exercise the "missing config" failure path without touching real env vars.
  const buildServiceWithoutScryptParams = () =>
    UserImportService({
      userService: mockUserService,
      userRepository: mockUserRepository,
      authorizationService: mockAuthz,
      firebaseAuth: mockFirebaseAuth,
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
    // Default to a consistent hierarchy: every requested entity resolves, and a requested class
    // hangs off the batch's first declared school so single-school rows validate. Tests that need an
    // inconsistent or unresolved entity override this.
    mockUserRepository.resolveDeclaredEntities.mockImplementation(async (ids) => ({
      districts: new Set(ids.districts),
      schools: new Map(ids.schools.map((id) => [id, { districtId: DEFAULT_DISTRICT_ID }])),
      classes: new Map(
        ids.classes.map((id) => [id, { schoolId: ids.schools[0] ?? 'school-parent', districtId: DEFAULT_DISTRICT_ID }]),
      ),
      groups: new Set(ids.groups),
    }));
    mockAuthz.requirePermission.mockResolvedValue(undefined);
    getUsers.mockResolvedValue({ users: [], notFound: [] });
    importUsers.mockResolvedValue({ successCount: 0, failureCount: 0, errors: [] });
    let counter = 0;
    mockUserService.createWithImportedAuth.mockImplementation(async () => ({ id: `new-user-${counter++}` }));
    mockUserRepository.runTransaction.mockImplementation(async ({ fn }) => fn({} as CoreTransaction));
    mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([]);
    mockUserRepository.getUserEntityMemberships.mockResolvedValue([
      { entityType: EntityType.SCHOOL, entityId: 'school-1' },
    ]);
    // Default the update-bin reconciliation to "no membership change".
    mockUserRepository.reconcileMemberships.mockResolvedValue({ added: [], removed: [] });
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
      getUsers.mockResolvedValue({ users: [{ email: 'student@example.org' }], notFound: [] });

      const results = await buildService().bulkImport(superAdmin, [makeRow()]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_CONFLICT } });
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('checks Firebase existence with a single batched getUsers call', async () => {
      const rows = [makeRow({ email: 'a@example.org' }), makeRow({ email: 'b@example.org' })];

      await buildService().bulkImport(superAdmin, rows);

      expect(getUsers).toHaveBeenCalledTimes(1);
      expect(getUsers).toHaveBeenCalledWith([{ email: 'a@example.org' }, { email: 'b@example.org' }]);
    });

    it('fails a within-batch duplicate assessmentPid', async () => {
      const rows = [
        makeRow({ email: 'a@example.org', identifiers: { pid: 'shared-pid' } }),
        makeRow({ email: 'b@example.org', identifiers: { pid: 'shared-pid' } }),
      ];

      const results = await buildService().bulkImport(superAdmin, rows);

      expect(results[0]!.status).toBe('ok');
      expect(results[1]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_CONFLICT } });
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
      expect(results[0]!.status).toBe('ok');
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('routes an existing user with unenroll=true to the unenroll bin', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([UserFactory.build({ email: 'exists@example.org' })]);

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'exists@example.org', unenroll: true }),
      ]);

      expect(results[0]!.classification).toBe('unenrolled');
      expect(results[0]!.status).toBe('ok');
      expect(importUsers).not.toHaveBeenCalled();
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

    it('fails every already-authorized row, without throwing, when the email lookup fails', async () => {
      mockUserRepository.findByEmails.mockRejectedValue(new Error('db down'));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'a@example.org' }),
        makeRow({ email: 'b@example.org', unenroll: true }),
      ]);

      expect(results).toMatchObject([
        { status: 'failed', classification: 'created', error: { code: ApiErrorCode.EXTERNAL_SERVICE_FAILED } },
        { status: 'failed', classification: 'unenrolled', error: { code: ApiErrorCode.EXTERNAL_SERVICE_FAILED } },
      ]);
      expect(importUsers).not.toHaveBeenCalled();
    });
  });

  describe('authorization', () => {
    it('fails a row the partner admin cannot create, but continues the batch', async () => {
      // Rows must name different orgs to get different verdicts — permission checks are memoized
      // per request, so two rows on the same org necessarily share one answer.
      mockAuthz.requirePermission.mockImplementation(async (_userId, _relation, object) => {
        if (object === 'school:school-denied') throw forbidden();
      });

      const rows = [
        makeRow({
          email: 'denied@example.org',
          memberships: [{ entityType: EntityType.SCHOOL, entityId: 'school-denied', role: UserRole.STUDENT }],
        }),
        makeRow({ email: 'allowed@example.org' }),
      ];
      const results = await buildService().bulkImport(partnerAdmin, rows);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.AUTH_FORBIDDEN } });
      expect(results[1]!.status).toBe('ok');
    });

    it('checks each distinct org once per request, however many rows name it', async () => {
      const rows = [
        makeRow({ email: 'a@example.org' }),
        makeRow({ email: 'b@example.org' }),
        makeRow({ email: 'c@example.org' }),
      ];

      await buildService().bulkImport(partnerAdmin, rows);

      // All three rows declare school-1 — one FGA check, not three.
      expect(mockAuthz.requirePermission).toHaveBeenCalledTimes(1);
      expect(mockAuthz.requirePermission).toHaveBeenCalledWith(
        partnerAdmin.userId,
        FgaRelation.CAN_CREATE_USERS,
        'school:school-1',
      );
    });

    it('resolves a class parent once per request, however many rows name it', async () => {
      const classRow = (email: string) =>
        makeRow({
          email,
          memberships: [{ entityType: EntityType.CLASS, entityId: 'class-9', role: UserRole.STUDENT }],
        });

      await buildService().bulkImport(partnerAdmin, [classRow('a@example.org'), classRow('b@example.org')]);

      expect(mockUserRepository.findClassParentSchool).toHaveBeenCalledTimes(1);
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

  describe('declared org validation', () => {
    const schoolMembership = (entityId: string) => ({
      entityType: EntityType.SCHOOL,
      entityId,
      role: UserRole.STUDENT,
    });
    const classMembership = (entityId: string) => ({
      entityType: EntityType.CLASS,
      entityId,
      role: UserRole.STUDENT,
    });
    const districtMembership = (entityId: string) => ({
      entityType: EntityType.DISTRICT,
      entityId,
      role: UserRole.STUDENT,
    });

    it('resolves the whole batch in one query, deduplicating repeated org IDs', async () => {
      const rows = [
        makeRow({ email: 'a@example.org', memberships: [schoolMembership('school-1'), classMembership('class-1')] }),
        makeRow({ email: 'b@example.org', memberships: [schoolMembership('school-1'), classMembership('class-1')] }),
      ];

      await buildService().bulkImport(superAdmin, rows);

      expect(mockUserRepository.resolveDeclaredEntities).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.resolveDeclaredEntities).toHaveBeenCalledWith({
        districts: [],
        schools: ['school-1'],
        classes: ['class-1'],
        groups: [],
      });
    });

    it('rejects a class whose parent school is not the declared school', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(
        resolved({
          schools: [['school-1', { districtId: DEFAULT_DISTRICT_ID }]],
          classes: [['class-9', { schoolId: 'school-other', districtId: DEFAULT_DISTRICT_ID }]],
        }),
      );

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ memberships: [schoolMembership('school-1'), classMembership('class-9')] }),
      ]);

      expect(results[0]!).toMatchObject({
        status: 'failed',
        error: { code: ApiErrorCode.RESOURCE_NOT_FOUND, message: ApiErrorMessage.UNPROCESSABLE_ENTITY },
      });
      // Hierarchy runs before authorization, so the FGA check is never reached.
      expect(mockAuthz.requirePermission).not.toHaveBeenCalled();
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('rejects a school whose parent district is not the declared district', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(
        resolved({
          districts: [DEFAULT_DISTRICT_ID],
          schools: [['school-1', { districtId: 'district-other' }]],
        }),
      );

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ memberships: [districtMembership(DEFAULT_DISTRICT_ID), schoolMembership('school-1')] }),
      ]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_NOT_FOUND } });
    });

    it('rejects a class whose parent district is not the declared district', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(
        resolved({
          districts: [DEFAULT_DISTRICT_ID],
          classes: [['class-9', { schoolId: 'school-1', districtId: 'district-other' }]],
        }),
      );

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ memberships: [districtMembership(DEFAULT_DISTRICT_ID), classMembership('class-9')] }),
      ]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_NOT_FOUND } });
    });

    it('rejects an unresolved school (missing, wrong org type, or rostered out)', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(resolved({}));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ memberships: [schoolMembership('school-gone')] }),
      ]);

      expect(results[0]!).toMatchObject({
        status: 'failed',
        error: { code: ApiErrorCode.RESOURCE_NOT_FOUND, message: ApiErrorMessage.UNPROCESSABLE_ENTITY },
      });
    });

    it('rejects an unresolved class (missing or rostered out)', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(resolved({}));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ memberships: [classMembership('class-gone')] }),
      ]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_NOT_FOUND } });
    });

    it('rejects an unresolved district', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(resolved({}));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ memberships: [districtMembership('district-gone')] }),
      ]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_NOT_FOUND } });
    });

    it('rejects an unresolved group', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(resolved({}));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({
          memberships: [{ entityType: EntityType.GROUP, entityId: 'group-gone', role: UserRole.STUDENT }],
        }),
      ]);

      expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.RESOURCE_NOT_FOUND } });
    });

    it('accepts a class belonging to either of several declared schools', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(
        resolved({
          schools: [
            ['school-1', { districtId: DEFAULT_DISTRICT_ID }],
            ['school-2', { districtId: DEFAULT_DISTRICT_ID }],
          ],
          classes: [['class-9', { schoolId: 'school-2', districtId: DEFAULT_DISTRICT_ID }]],
        }),
      );

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({
          memberships: [schoolMembership('school-1'), schoolMembership('school-2'), classMembership('class-9')],
        }),
      ]);

      expect(results[0]!.status).toBe('ok');
    });

    it('accepts a class-only row (nothing declared to compare the parent against)', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(
        resolved({ classes: [['class-9', { schoolId: 'school-unrelated', districtId: 'district-unrelated' }]] }),
      );

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ memberships: [classMembership('class-9')] }),
      ]);

      expect(results[0]!.status).toBe('ok');
    });

    it('does not validate declared orgs on unenroll rows', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([UserFactory.build({ email: 'leaver@example.org' })]);
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
      ]);

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'leaver@example.org', unenroll: true, memberships: [schoolMembership('school-nonexistent')] }),
      ]);

      expect(mockUserRepository.resolveDeclaredEntities).toHaveBeenCalledWith({
        districts: [],
        schools: [],
        classes: [],
        groups: [],
      });
      expect(results[0]!).toMatchObject({ classification: 'unenrolled', status: 'ok' });
    });

    it('fails the row with a 500-tier error when a resolved school has no parent district', async () => {
      mockUserRepository.resolveDeclaredEntities.mockResolvedValue(
        resolved({ schools: [['school-1', { districtId: null }]] }),
      );

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ memberships: [schoolMembership('school-1')] }),
      ]);

      // Corrupt data, not a bad row — reported as an internal failure so the operator isn't sent
      // hunting for a typo that doesn't exist.
      expect(results[0]!).toMatchObject({
        status: 'failed',
        error: { code: ApiErrorCode.DATABASE_QUERY_FAILED },
      });
    });

    it('fails every row when the entity lookup itself throws', async () => {
      mockUserRepository.resolveDeclaredEntities.mockRejectedValue(new Error('db down'));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'a@example.org' }),
        makeRow({ email: 'b@example.org' }),
      ]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'failed' && r.error.code === ApiErrorCode.EXTERNAL_SERVICE_FAILED)).toBe(
        true,
      );
      expect(mockUserRepository.findByEmails).not.toHaveBeenCalled();
      expect(importUsers).not.toHaveBeenCalled();
    });
  });

  describe('mixed batch', () => {
    it('routes create, update, and unenroll rows independently in one request', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([
        UserFactory.build({ email: 'update-me@example.org' }),
        UserFactory.build({ email: 'unenroll-me@example.org' }),
      ]);

      const rows = [
        makeRow({ email: 'new@example.org' }),
        makeRow({ email: 'update-me@example.org' }),
        makeRow({ email: 'unenroll-me@example.org', unenroll: true }),
      ];

      const results = await buildService().bulkImport(superAdmin, rows);

      expect(results[0]!).toMatchObject({ classification: 'created', status: 'ok' });
      // Each bin routes and processes independently in one request.
      expect(results[1]!).toMatchObject({ classification: 'updated', status: 'ok' });
      expect(results[2]!).toMatchObject({ classification: 'unenrolled', status: 'ok' });
    });

    it('scopes a create-bin config failure to create rows, leaving the unenroll bin unaffected', async () => {
      vi.mocked(getFirebaseScryptParamsFromEnv).mockImplementationOnce(() => {
        throw new Error('Missing Firebase scrypt configuration: FIREBASE_SCRYPT_SIGNER_KEY');
      });
      mockUserRepository.findByEmails.mockResolvedValue([UserFactory.build({ email: 'unenroll-me@example.org' })]);

      const results = await buildServiceWithoutScryptParams().bulkImport(superAdmin, [
        makeRow({ email: 'new@example.org' }),
        makeRow({ email: 'unenroll-me@example.org', unenroll: true }),
      ]);

      expect(results[0]!).toMatchObject({
        classification: 'created',
        status: 'failed',
        error: { code: ApiErrorCode.INTERNAL },
      });
      // The unenroll bin runs independently and is unaffected by the create bin's config failure.
      expect(results[1]!).toMatchObject({ classification: 'unenrolled', status: 'ok' });
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('fails only the row whose password hashing throws, letting the rest of the batch continue', async () => {
      // hashPasswordForImport has its own try/catch with `continue` (matching existsByUniqueFields
      // right above it) — one row's hash failing must not abort the loop for the other candidates,
      // nor affect a different bin in the same request.
      vi.mocked(hashPasswordForImport).mockRejectedValueOnce(new Error('unexpected hashing failure'));
      mockUserRepository.findByEmails.mockResolvedValue([UserFactory.build({ email: 'unenroll-me@example.org' })]);

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'bad-hash@example.org' }),
        makeRow({ email: 'good-hash@example.org' }),
        makeRow({ email: 'unenroll-me@example.org', unenroll: true }),
      ]);

      expect(results[0]!).toMatchObject({
        classification: 'created',
        status: 'failed',
        error: { code: ApiErrorCode.INTERNAL },
      });
      // A sibling row in the SAME bin still succeeds — the failure doesn't abort the rest of the loop.
      expect(results[1]!).toMatchObject({ classification: 'created', status: 'ok' });
      // A different bin in the same request is unaffected too.
      expect(results[2]!).toMatchObject({ classification: 'unenrolled', status: 'ok' });
      // Only the successfully-hashed row reaches the batched importUsers call.
      expect(importUsers).toHaveBeenCalledTimes(1);
      expect(importUsers.mock.calls[0]![0]).toHaveLength(1);
    });
  });

  describe('unenroll bin', () => {
    const existingUser = (email: string) => UserFactory.build({ email });

    beforeEach(() => {
      mockUserRepository.findByEmails.mockResolvedValue([existingUser('leaver@example.org')]);
    });

    it('revokes the FGA tuples before ending the enrollments', async () => {
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
      ]);

      await buildService().bulkImport(superAdmin, [makeRow({ email: 'leaver@example.org', unenroll: true })]);

      // Unenroll's DB write has no clean undo, so the revocation must land first — a failed DB write
      // then leaves the user under-granted rather than unenrolled-but-still-authorized.
      const deleteOrder = mockAuthz.deleteTuples.mock.invocationCallOrder[0]!;
      const txOrder = mockUserRepository.runTransaction.mock.invocationCallOrder[0]!;
      expect(deleteOrder).toBeLessThan(txOrder);
    });

    it('restores the revoked tuples when the DB write fails', async () => {
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
      ]);
      mockUserRepository.runTransaction.mockRejectedValueOnce(new Error('db down'));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'leaver@example.org', unenroll: true }),
      ]);

      expect(mockAuthz.writeTuplesOrThrow).toHaveBeenCalledWith([
        expect.objectContaining({ relation: UserRole.STUDENT, object: 'school:school-9' }),
      ]);
      expect(results[0]!).toMatchObject({ classification: 'unenrolled', status: 'failed' });
    });

    // An import row cannot declare a family membership (the contract's OrgMembershipSchema rejects
    // it), but the target's *current* memberships come from the DB and may include a family row.
    // Org admins cannot unenroll users from family memberships.
    it('leaves the family tuple in place while revoking and restoring the org ones', async () => {
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.TEACHER },
        { entityType: EntityType.FAMILY, entityId: 'fam-1', role: UserFamilyRole.PARENT },
      ]);
      mockUserRepository.runTransaction.mockRejectedValueOnce(new Error('db down'));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'leaver@example.org', unenroll: true }),
      ]);

      expect(mockAuthz.deleteTuples).toHaveBeenCalledWith([
        expect.objectContaining({ relation: UserRole.TEACHER, object: 'school:school-9' }),
      ]);
      expect(mockAuthz.deleteTuples).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ object: 'family:fam-1' })]),
      );

      // Family tuples must not affect the org ones. Compensation restores exactly what was revoked
      // — org only: FGA keys tuples by {user, relation, object}, so a family tuple that was never
      // deleted would fail the batch and take the org restore down with it.
      expect(mockAuthz.writeTuplesOrThrow).toHaveBeenCalledWith([
        expect.objectContaining({
          relation: UserRole.TEACHER,
          object: 'school:school-9',
          condition: expect.objectContaining({ name: FGA_CONDITION_ACTIVE_MEMBERSHIP }),
        }),
      ]);
      expect(results[0]!).toMatchObject({ classification: 'unenrolled', status: 'failed' });
    });

    it('still fails the row when restoring the tuples also fails', async () => {
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
      ]);
      mockUserRepository.runTransaction.mockRejectedValueOnce(new Error('db down'));
      mockAuthz.writeTuplesOrThrow.mockRejectedValueOnce(new Error('fga down'));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'leaver@example.org', unenroll: true }),
      ]);

      expect(results[0]!.status).toBe('failed');
    });

    it('ends enrollments, archives, and deletes the FGA membership tuples, returning ok', async () => {
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
      ]);

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'leaver@example.org', unenroll: true }),
      ]);

      expect(mockUserRepository.endAllOrgEnrollments).toHaveBeenCalled();
      expect(mockUserRepository.archiveUser).toHaveBeenCalled();
      expect(mockAuthz.deleteTuples).toHaveBeenCalledWith([
        { user: expect.stringMatching(/^user:/), relation: UserRole.STUDENT, object: 'school:school-9' },
      ]);
      expect(results[0]!).toMatchObject({ classification: 'unenrolled', status: 'ok' });
    });

    it('skips deleteTuples when the user has no active memberships', async () => {
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([]);

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'leaver@example.org', unenroll: true }),
      ]);

      expect(mockAuthz.deleteTuples).not.toHaveBeenCalled();
      expect(results[0]!.status).toBe('ok');
    });

    it('does not delete class tuples for FGA-invalid (admin-tier) roles', async () => {
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
        { entityType: EntityType.CLASS, entityId: 'class-9', role: UserRole.ADMINISTRATOR },
      ]);

      await buildService().bulkImport(superAdmin, [makeRow({ email: 'leaver@example.org', unenroll: true })]);

      // The admin-tier class tuple was never written (it cascades via the org hierarchy), so deletion
      // must skip it — only the school tuple is removed.
      const deleted = mockAuthz.deleteTuples.mock.calls[0]![0];
      expect(deleted).toHaveLength(1);
      expect(deleted[0]).toMatchObject({ object: 'school:school-9' });
    });

    it('fails the row and continues the batch when the unenroll transaction throws', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([
        existingUser('leaver@example.org'),
        existingUser('other@example.org'),
      ]);
      mockUserRepository.runTransaction.mockRejectedValueOnce(new Error('db down'));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'leaver@example.org', unenroll: true }),
        makeRow({ email: 'other@example.org', unenroll: true }),
      ]);

      expect(results[0]!.status).toBe('failed');
      expect(results[1]!.status).toBe('ok');
    });

    describe('authorization against actual memberships', () => {
      it('accepts a row with no declared memberships and authorizes against the DB-fetched ones', async () => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
          { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
        ]);

        const results = await buildService().bulkImport(partnerAdmin, [
          makeRow({ email: 'leaver@example.org', unenroll: true, memberships: [] }),
        ]);

        expect(mockAuthz.requirePermission).toHaveBeenCalledWith(
          partnerAdmin.userId,
          expect.any(String),
          'school:school-9',
        );
        expect(results[0]!).toMatchObject({ classification: 'unenrolled', status: 'ok' });
      });

      it('rejects an unenroll row with no permission over the user’s actual memberships, without mutating anything', async () => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
          { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
        ]);
        mockAuthz.requirePermission.mockRejectedValue(forbidden());

        const results = await buildService().bulkImport(partnerAdmin, [
          makeRow({ email: 'leaver@example.org', unenroll: true, memberships: [] }),
        ]);

        expect(results[0]!).toMatchObject({
          status: 'failed',
          classification: 'unenrolled',
          error: { code: ApiErrorCode.AUTH_FORBIDDEN },
        });
        expect(mockUserRepository.endAllOrgEnrollments).not.toHaveBeenCalled();
        expect(mockUserRepository.archiveUser).not.toHaveBeenCalled();
        expect(mockAuthz.deleteTuples).not.toHaveBeenCalled();
      });

      it('rejects an unenroll row when the target has zero active memberships, without mutating anything', async () => {
        // Empty memberships must fail closed, not fall through both loops in authorizeRow and
        // return as if authorized — a non-super-admin has nothing checkable to authorize against.
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([]);

        const results = await buildService().bulkImport(partnerAdmin, [
          makeRow({ email: 'leaver@example.org', unenroll: true, memberships: [] }),
        ]);

        expect(results[0]!).toMatchObject({
          status: 'failed',
          classification: 'unenrolled',
          error: { code: ApiErrorCode.AUTH_FORBIDDEN },
        });
        expect(mockAuthz.requirePermission).not.toHaveBeenCalled();
        expect(mockUserRepository.endAllOrgEnrollments).not.toHaveBeenCalled();
        expect(mockUserRepository.archiveUser).not.toHaveBeenCalled();
        expect(mockAuthz.deleteTuples).not.toHaveBeenCalled();
      });

      it('ignores a declared membership the requester lacks permission over, since it is not what gets unenrolled', async () => {
        // The row declares a membership the partner admin can't touch, but that's irrelevant —
        // the user's actual membership (school-9) is what's checked and what's removed.
        mockUserRepository.findClassParentSchool.mockResolvedValue('locked-out-school');
        mockAuthz.requirePermission.mockImplementation(async (_userId, _relation, object: string) => {
          if (object === 'school:locked-out-school') throw forbidden();
        });
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
          { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
        ]);

        const results = await buildService().bulkImport(partnerAdmin, [
          makeRow({
            email: 'leaver@example.org',
            unenroll: true,
            memberships: [{ entityType: EntityType.CLASS, entityId: 'class-locked', role: UserRole.STUDENT }],
          }),
        ]);

        expect(results[0]!).toMatchObject({ classification: 'unenrolled', status: 'ok' });
      });

      it('does not demand an org permission over a family membership the target holds', async () => {
        // A row can't declare a family membership, but the target's DB-sourced memberships can
        // include one written by the families endpoints. Families authorize through the family
        // itself (can_create_child), not can_create_users on an org, so authorizeRow skips them —
        // otherwise every import touching a user with a family would 403 for want of a permission
        // no caller can hold.
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
          { entityType: EntityType.SCHOOL, entityId: 'school-9', role: UserRole.STUDENT },
          { entityType: EntityType.FAMILY, entityId: 'fam-1', role: UserFamilyRole.CHILD },
        ]);

        const results = await buildService().bulkImport(partnerAdmin, [
          makeRow({ email: 'leaver@example.org', unenroll: true, memberships: [] }),
        ]);

        expect(mockAuthz.requirePermission).toHaveBeenCalledWith(
          partnerAdmin.userId,
          expect.any(String),
          'school:school-9',
        );
        expect(mockAuthz.requirePermission).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          'family:fam-1',
        );
        expect(results[0]!).toMatchObject({ classification: 'unenrolled', status: 'ok' });
      });

      it('rejects a target whose only membership is a family one', async () => {
        // Families are filtered out before the fail-closed guard, so nothing checkable remains and
        // the row is denied. Passing it would archive the user and stamp user_families.leftOn with
        // no FGA check having run at all.
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
          { entityType: EntityType.FAMILY, entityId: 'fam-1', role: UserFamilyRole.PARENT },
        ]);

        const results = await buildService().bulkImport(partnerAdmin, [
          makeRow({ email: 'leaver@example.org', unenroll: true, memberships: [] }),
        ]);

        expect(mockAuthz.requirePermission).not.toHaveBeenCalled();
        expect(results[0]!).toMatchObject({
          status: 'failed',
          error: { code: ApiErrorCode.AUTH_FORBIDDEN },
        });
        expect(mockUserRepository.archiveUser).not.toHaveBeenCalled();
      });
    });
  });

  describe('update bin', () => {
    const existing = (overrides = {}) =>
      UserFactory.build({
        email: 'updatee@example.org',
        nameFirst: 'Old',
        nameMiddle: null,
        nameLast: 'Name',
        ...overrides,
      });

    beforeEach(() => {
      mockUserRepository.findByEmails.mockResolvedValue([existing()]);
    });

    it('updates the profile fields and returns ok without touching importUsers', async () => {
      const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ nameFirst: 'Ada', nameLast: 'Lovelace' }) }),
      );
      expect(results[0]!).toMatchObject({ classification: 'updated', status: 'ok' });
      expect(importUsers).not.toHaveBeenCalled();
    });

    it('syncs the Firebase displayName when the name changed', async () => {
      await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

      expect(updateUser).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ displayName: 'Ada Lovelace' }),
      );
    });

    it('resets the Firebase password when one is supplied', async () => {
      await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org', password: 'newpass123' })]);

      expect(updateUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ password: 'newpass123' }));
    });

    it('rejects a password reset for a user with no linked Firebase account, without writing anything', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([existing({ authId: null })]);

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'updatee@example.org', password: 'newpass123' }),
      ]);

      expect(results[0]!).toMatchObject({
        classification: 'updated',
        status: 'failed',
        error: { code: ApiErrorCode.RESOURCE_UNPROCESSABLE },
      });
      expect(mockUserRepository.runTransaction).not.toHaveBeenCalled();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    });

    it('still updates profile fields for a user with no linked Firebase account when no password is sent', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([existing({ authId: null })]);

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'updatee@example.org', password: undefined }),
      ]);

      expect(results[0]!).toMatchObject({ classification: 'updated', status: 'ok' });
      expect(mockUserRepository.update).toHaveBeenCalled();
      // displayName sync is skipped silently — nothing to sync to without a Firebase account.
      expect(updateUser).not.toHaveBeenCalled();
    });

    it('skips the Firebase write when neither name nor password changed', async () => {
      // The existing user already matches the row's name (Ada Lovelace), and no password is sent.
      mockUserRepository.findByEmails.mockResolvedValue([
        existing({ nameFirst: 'Ada', nameMiddle: null, nameLast: 'Lovelace' }),
      ]);

      await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org', password: undefined })]);

      expect(updateUser).not.toHaveBeenCalled();
    });

    it('fails the row and continues the batch when the profile update throws', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([
        existing({ email: 'a@example.org' }),
        existing({ email: 'b@example.org' }),
      ]);
      mockUserRepository.update.mockRejectedValueOnce(new Error('db down'));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({ email: 'a@example.org' }),
        makeRow({ email: 'b@example.org' }),
      ]);

      expect(results[0]!.status).toBe('failed');
      expect(results[1]!.status).toBe('ok');
    });

    it('does not write nameMiddle when the row omits it (no clobber)', async () => {
      await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

      const updateData = mockUserRepository.update.mock.calls[0]![0].data;
      expect(updateData).not.toHaveProperty('nameMiddle');
    });

    it('rejects an update to a rostering-ended (archived) user without writing anything', async () => {
      mockUserRepository.findByEmails.mockResolvedValue([existing({ rosteringEnded: new Date() })]);

      const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

      expect(results[0]!).toMatchObject({
        classification: 'updated',
        status: 'failed',
        error: { code: ApiErrorCode.RESOURCE_NOT_FOUND },
      });
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    });

    it('reconciles memberships and syncs FGA tuples with the right shapes', async () => {
      const user = existing();
      mockUserRepository.findByEmails.mockResolvedValue([user]);
      // Removals are predicted from the current-vs-desired diff, so this mock must agree with the
      // reconcile result below: currently in school-1, row asks for school-2.
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-1', role: UserRole.STUDENT },
      ]);
      mockUserRepository.reconcileMemberships.mockResolvedValue({
        added: [{ entityType: EntityType.SCHOOL, entityId: 'school-2', role: 'student' }],
        removed: [{ entityType: EntityType.SCHOOL, entityId: 'school-1', role: 'student' }],
      });

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({
          email: 'updatee@example.org',
          memberships: [{ entityType: EntityType.SCHOOL, entityId: 'school-2', role: UserRole.STUDENT }],
        }),
      ]);

      // Added membership → condition-carrying tuple (identical shape to single-create). Without the
      // active_membership condition the grant would never evaluate true, so assert it explicitly.
      expect(mockAuthz.writeTuplesOrThrow).toHaveBeenCalledWith([
        {
          user: `user:${user.id}`,
          relation: 'student',
          object: 'school:school-2',
          condition: expect.objectContaining({ name: FGA_CONDITION_ACTIVE_MEMBERSHIP }),
        },
      ]);
      // Removed membership → key-only deletion tuple (no condition; FGA deletes by key).
      expect(mockAuthz.deleteTuples).toHaveBeenCalledWith([
        { user: `user:${user.id}`, relation: 'student', object: 'school:school-1' },
      ]);
      expect(results[0]!).toMatchObject({ classification: 'updated', status: 'ok' });
    });

    it('revokes before granting so a failed grant-write cannot strand a removed tuple', async () => {
      mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
        { entityType: EntityType.SCHOOL, entityId: 'school-1', role: UserRole.STUDENT },
      ]);
      mockUserRepository.reconcileMemberships.mockResolvedValue({
        added: [{ entityType: EntityType.SCHOOL, entityId: 'school-2', role: 'student' }],
        removed: [{ entityType: EntityType.SCHOOL, entityId: 'school-1', role: 'student' }],
      });
      mockAuthz.writeTuplesOrThrow.mockRejectedValueOnce(new Error('fga down'));

      const results = await buildService().bulkImport(superAdmin, [
        makeRow({
          email: 'updatee@example.org',
          memberships: [{ entityType: EntityType.SCHOOL, entityId: 'school-2', role: UserRole.STUDENT }],
        }),
      ]);

      // The revocation must have run (and run first) even though the grant-write threw — otherwise the
      // removed membership would stay authorized in FGA.
      expect(mockAuthz.deleteTuples).toHaveBeenCalled();
      const deleteOrder = mockAuthz.deleteTuples.mock.invocationCallOrder[0]!;
      const writeOrder = mockAuthz.writeTuplesOrThrow.mock.invocationCallOrder[0]!;
      expect(deleteOrder).toBeLessThan(writeOrder);
      expect(results[0]!.status).toBe('failed');
    });

    describe('revocation before the DB write', () => {
      beforeEach(() => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
          { entityType: EntityType.SCHOOL, entityId: 'school-1', role: UserRole.STUDENT },
        ]);
      });

      const rowMovingToSchool2 = () =>
        makeRow({
          email: 'updatee@example.org',
          memberships: [{ entityType: EntityType.SCHOOL, entityId: 'school-2', role: UserRole.STUDENT }],
        });

      it('revokes the predicted removals before committing the reconcile', async () => {
        await buildService().bulkImport(superAdmin, [rowMovingToSchool2()]);

        const deleteOrder = mockAuthz.deleteTuples.mock.invocationCallOrder[0]!;
        const txOrder = mockUserRepository.runTransaction.mock.invocationCallOrder[0]!;
        expect(deleteOrder).toBeLessThan(txOrder);
      });

      it('restores the revoked tuples when the DB write fails', async () => {
        mockUserRepository.runTransaction.mockRejectedValueOnce(new Error('db down'));

        const results = await buildService().bulkImport(superAdmin, [rowMovingToSchool2()]);

        expect(mockAuthz.writeTuplesOrThrow).toHaveBeenCalledWith([
          expect.objectContaining({ relation: 'student', object: 'school:school-1' }),
        ]);
        expect(results[0]!.status).toBe('failed');
      });

      it('does not revoke anything when the row removes no membership', async () => {
        await buildService().bulkImport(superAdmin, [
          makeRow({
            email: 'updatee@example.org',
            memberships: [{ entityType: EntityType.SCHOOL, entityId: 'school-1', role: UserRole.STUDENT }],
          }),
        ]);

        expect(mockAuthz.deleteTuples).not.toHaveBeenCalled();
      });

      it('leaves untouched entity types alone (replace-semantics is per declared type)', async () => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
          { entityType: EntityType.SCHOOL, entityId: 'school-1', role: UserRole.STUDENT },
          { entityType: EntityType.GROUP, entityId: 'group-1', role: UserRole.STUDENT },
        ]);

        await buildService().bulkImport(superAdmin, [rowMovingToSchool2()]);

        // The row declares only a school, so the group membership is not reconciled and must not be
        // revoked — matching UserRepository.reconcileMemberships' per-type grouping.
        expect(mockAuthz.deleteTuples).toHaveBeenCalledWith([expect.objectContaining({ object: 'school:school-1' })]);
      });

      it('leaves an existing family membership untouched while replacing the org one', async () => {
        // The same per-type rule, applied to the one entity type a row can no longer declare. A
        // family membership is always in `current` and never in `desired`, so it can't be predicted
        // as a removal — a routine roster update must not strip a parent's access to their child.
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([
          { entityType: EntityType.SCHOOL, entityId: 'school-1', role: UserRole.STUDENT },
          { entityType: EntityType.FAMILY, entityId: 'fam-1', role: UserFamilyRole.CHILD },
        ]);

        const results = await buildService().bulkImport(superAdmin, [rowMovingToSchool2()]);

        expect(mockAuthz.deleteTuples).toHaveBeenCalledWith([expect.objectContaining({ object: 'school:school-1' })]);
        expect(mockAuthz.deleteTuples).not.toHaveBeenCalledWith(
          expect.arrayContaining([expect.objectContaining({ object: 'family:fam-1' })]),
        );

        // The family row reaches the reconcile as `current` — proving it wasn't filtered out
        // upstream — but never as `desired`, which is what makes it survive.
        expect(mockUserRepository.reconcileMemberships).toHaveBeenCalledWith(
          expect.any(String),
          expect.not.arrayContaining([expect.objectContaining({ entityType: EntityType.FAMILY })]),
          expect.arrayContaining([expect.objectContaining({ entityType: EntityType.FAMILY })]),
          expect.anything(),
        );
        expect(results[0]!).toMatchObject({ classification: 'updated', status: 'ok' });
      });
    });

    describe('compensation on a failed grant-write', () => {
      const reconciled = {
        added: [{ entityType: EntityType.SCHOOL, entityId: 'school-2', role: 'student' }],
        removed: [{ entityType: EntityType.SCHOOL, entityId: 'school-1', role: 'student' }],
      };

      it('reverts the committed reconcile when writeTuplesOrThrow fails', async () => {
        mockUserRepository.reconcileMemberships.mockResolvedValue(reconciled);
        mockAuthz.writeTuplesOrThrow.mockRejectedValueOnce(new Error('fga down'));

        const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

        expect(mockUserRepository.revertReconciledMemberships).toHaveBeenCalledWith(
          expect.any(String),
          reconciled,
          expect.anything(),
        );
        expect(results[0]!.status).toBe('failed');
      });

      it('does not revert when the grant-write succeeds', async () => {
        mockUserRepository.reconcileMemberships.mockResolvedValue(reconciled);

        const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

        expect(mockUserRepository.revertReconciledMemberships).not.toHaveBeenCalled();
        expect(results[0]!.status).toBe('ok');
      });

      it('still fails the row when the compensation itself throws', async () => {
        mockUserRepository.reconcileMemberships.mockResolvedValue(reconciled);
        mockAuthz.writeTuplesOrThrow.mockRejectedValueOnce(new Error('fga down'));
        mockUserRepository.revertReconciledMemberships.mockRejectedValueOnce(new Error('db down'));

        const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

        // Compensation failure must not mask the row outcome or abort the batch — it's logged for
        // manual syncFga instead.
        expect(results[0]!.status).toBe('failed');
      });

      it('does not revert when there were no additions to grant', async () => {
        mockUserRepository.reconcileMemberships.mockResolvedValue({ added: [], removed: reconciled.removed });

        const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

        expect(mockAuthz.writeTuplesOrThrow).not.toHaveBeenCalled();
        expect(mockUserRepository.revertReconciledMemberships).not.toHaveBeenCalled();
        expect(results[0]!.status).toBe('ok');
      });
    });

    it('writes and deletes no FGA tuple for an admin-tier class membership (add/delete symmetry)', async () => {
      // administrator is not an FGA-valid class role — class admin access cascades via the org
      // hierarchy. Such a membership reconciles in the DB but maps to zero tuples on both paths.
      mockUserRepository.reconcileMemberships.mockResolvedValue({
        added: [{ entityType: EntityType.CLASS, entityId: 'class-1', role: 'administrator' }],
        removed: [{ entityType: EntityType.CLASS, entityId: 'class-2', role: 'administrator' }],
      });

      const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

      expect(mockAuthz.writeTuplesOrThrow).not.toHaveBeenCalled();
      expect(mockAuthz.deleteTuples).not.toHaveBeenCalled();
      expect(results[0]!.status).toBe('ok');
    });

    it('does not touch FGA when reconciliation reports no membership change', async () => {
      const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

      expect(mockUserRepository.reconcileMemberships).toHaveBeenCalled();
      expect(mockAuthz.writeTuplesOrThrow).not.toHaveBeenCalled();
      expect(mockAuthz.deleteTuples).not.toHaveBeenCalled();
      expect(results[0]!.status).toBe('ok');
    });

    describe('partial updates', () => {
      it('writes only the name when the row carries no optional fields', async () => {
        await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

        const updateData = mockUserRepository.update.mock.calls[0]![0].data;
        expect(Object.keys(updateData).sort()).toEqual(['nameFirst', 'nameLast']);
      });

      it('writes a provided field without touching the omitted ones', async () => {
        await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org', grade: '5' })]);

        const updateData = mockUserRepository.update.mock.calls[0]![0].data;
        expect(updateData).toMatchObject({ grade: '5' });
        expect(updateData).not.toHaveProperty('dob');
        expect(updateData).not.toHaveProperty('stateId');
      });

      it('clears a field when the row sends an explicit null', async () => {
        await buildService().bulkImport(superAdmin, [
          makeRow({ email: 'updatee@example.org', dob: null, grade: null }),
        ]);

        const updateData = mockUserRepository.update.mock.calls[0]![0].data;
        expect(updateData).toMatchObject({ dob: null, grade: null });
      });

      it('omits every demographic column when the row carries no demographics', async () => {
        await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

        const updateData = mockUserRepository.update.mock.calls[0]![0].data;
        for (const column of ['statusEll', 'statusFrl', 'statusIep', 'gender', 'race', 'homeLanguage']) {
          expect(updateData).not.toHaveProperty(column);
        }
      });

      it('writes the demographic columns the row does carry', async () => {
        mockUserRepository.findByEmails.mockResolvedValue([
          existing({ gender: 'male', race: 'white', statusEll: 'EL', homeLanguage: 'spanish' }),
        ]);

        await buildService().bulkImport(superAdmin, [
          makeRow({
            email: 'updatee@example.org',
            demographics: { gender: null, race: 'asian', statusEll: 'EL' },
          }),
        ]);

        const updateData = mockUserRepository.update.mock.calls[0]![0].data;
        expect(updateData).toMatchObject({ gender: null, race: 'asian', statusEll: 'EL' });

        // Demographics the row never mentions stay out of the write, so `homeLanguage`
        // keeps its stored value
        for (const column of ['statusFrl', 'statusIep', 'hispanicEthnicity', 'homeLanguage']) {
          expect(updateData).not.toHaveProperty(column);
        }
      });
    });

    describe('target-user authorization', () => {
      // The row declares school-1 (which the requester controls); the target actually belongs to
      // school-99. Phase 1 only sees the declared org, so the target's orgs must be checked too.
      const targetOrgs = [{ entityType: EntityType.SCHOOL, entityId: 'school-99', role: UserRole.STUDENT }];

      it("authorizes against the target's current memberships, not the row's declared ones", async () => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue(targetOrgs);

        await buildService().bulkImport(partnerAdmin, [makeRow({ email: 'updatee@example.org' })]);

        expect(mockAuthz.requirePermission).toHaveBeenCalledWith(
          partnerAdmin.userId,
          FgaRelation.CAN_CREATE_USERS,
          'school:school-99',
        );
      });

      it('fails the row when the requester has no rights over the target', async () => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue(targetOrgs);
        mockAuthz.requirePermission.mockImplementation(async (_userId, _relation, object) => {
          if (object === 'school:school-99') throw forbidden();
        });

        const results = await buildService().bulkImport(partnerAdmin, [makeRow({ email: 'updatee@example.org' })]);

        expect(results[0]!).toMatchObject({
          classification: 'updated',
          status: 'failed',
          error: { code: ApiErrorCode.AUTH_FORBIDDEN },
        });
      });

      it('denies before any write, so the profile and password are left untouched', async () => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue(targetOrgs);
        mockAuthz.requirePermission.mockImplementation(async (_userId, _relation, object) => {
          if (object === 'school:school-99') throw forbidden();
        });

        await buildService().bulkImport(partnerAdmin, [
          makeRow({ email: 'updatee@example.org', password: 'attacker-chosen' }),
        ]);

        expect(mockUserRepository.update).not.toHaveBeenCalled();
        expect(mockUserRepository.reconcileMemberships).not.toHaveBeenCalled();
        expect(updateUser).not.toHaveBeenCalled();
      });

      it('fails closed when the target has no active memberships to check', async () => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue([]);

        const results = await buildService().bulkImport(partnerAdmin, [makeRow({ email: 'updatee@example.org' })]);

        expect(results[0]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.AUTH_FORBIDDEN } });
      });

      it('fails only the denied row, leaving the rest of the batch to update', async () => {
        mockUserRepository.findByEmails.mockResolvedValue([
          existing({ id: 'user-allowed', email: 'allowed@example.org' }),
          existing({ id: 'user-denied', email: 'denied@example.org' }),
        ]);
        mockUserRepository.getActiveMembershipsWithRoles.mockImplementation(async (userId) => [
          {
            entityType: EntityType.SCHOOL,
            entityId: userId === 'user-denied' ? 'school-99' : 'school-1',
            role: UserRole.STUDENT,
          },
        ]);
        mockAuthz.requirePermission.mockImplementation(async (_userId, _relation, object) => {
          if (object === 'school:school-99') throw forbidden();
        });

        const results = await buildService().bulkImport(partnerAdmin, [
          makeRow({ email: 'allowed@example.org' }),
          makeRow({ email: 'denied@example.org' }),
        ]);

        expect(results[0]!.status).toBe('ok');
        expect(results[1]!).toMatchObject({ status: 'failed', error: { code: ApiErrorCode.AUTH_FORBIDDEN } });
        expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
      });

      it('allows a super admin regardless of the target’s memberships', async () => {
        mockUserRepository.getActiveMembershipsWithRoles.mockResolvedValue(targetOrgs);

        const results = await buildService().bulkImport(superAdmin, [makeRow({ email: 'updatee@example.org' })]);

        expect(results[0]!.status).toBe('ok');
      });
    });
  });
});
