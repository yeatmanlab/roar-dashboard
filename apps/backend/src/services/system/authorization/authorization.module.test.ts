import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ClientWriteRequestOnDuplicateWrites } from '@openfga/sdk';
import type { OpenFgaClient } from '@openfga/sdk';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../../enums/api-error-message.enum';
import { ApiError } from '../../../errors/api-error';
import { logger } from '../../../logger';
import { AuthContextFactory } from '../../../test-support/factories/user.factory';
import { OrgType } from '../../../enums/org-type.enum';
import { AuthorizationModule } from './authorization.module';

// ── Mock DB ──────────────────────────────────────────────────────────────────

/**
 * Creates a thenable chain mock that resolves to `results` regardless
 * of how many Drizzle methods (.where, .innerJoin, .orderBy, etc.) are chained.
 * Each chained method returns the same thenable, so `.from(t).where(...).innerJoin(...)` works.
 */
function createThenableChain(results: unknown[]): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const handler = () => chain;
  // All Drizzle builder methods return `this` — mock them all
  for (const method of ['where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'offset', 'groupBy']) {
    chain[method] = vi.fn(handler);
  }
  // Make it thenable so `await db.select().from(t)` resolves to results
  chain['then'] = (resolve: (v: unknown[]) => void) => resolve(results);
  return chain;
}

/** Symbol used by Drizzle ORM to store the table name on table objects. */
const DRIZZLE_NAME = Symbol.for('drizzle:Name');

/**
 * Creates a mock Drizzle DB. Routes `from(table)` calls to the results
 * keyed by the Drizzle table's internal name (accessed via the drizzle:Name symbol).
 */
function createMockDb(mockFromResults: Record<string, unknown[]>) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((table: Record<string | symbol, unknown>) => {
        const name = (table[DRIZZLE_NAME] as string) ?? 'unknown';
        const results = mockFromResults[name] ?? [];
        return createThenableChain(results);
      }),
    }),
  };
}

// ── Mock FGA client ──────────────────────────────────────────────────────────

function createMockFgaClient() {
  return {
    writeTuples: vi.fn(),
    deleteTuples: vi.fn(),
  } as unknown as OpenFgaClient;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const schoolRow = { id: 'school-1', parentOrgId: 'district-1' };
const classRow = { id: 'class-1', schoolId: 'school-1' };

const orgMembershipDistrictRow = {
  userId: 'user-1',
  orgId: 'district-1',
  role: 'administrator',
  enrollmentStart: new Date('2024-01-01'),
  enrollmentEnd: null,
  orgType: OrgType.DISTRICT,
};

const orgMembershipSchoolRow = {
  userId: 'user-2',
  orgId: 'school-1',
  role: 'teacher',
  enrollmentStart: new Date('2024-01-01'),
  enrollmentEnd: new Date('2025-01-01'),
  orgType: OrgType.SCHOOL,
};

const classMembershipRow = {
  userId: 'user-3',
  classId: 'class-1',
  role: 'student',
  enrollmentStart: new Date('2024-01-01'),
  enrollmentEnd: null,
};

const groupMembershipRow = {
  userId: 'user-4',
  groupId: 'group-1',
  role: 'student',
  enrollmentStart: new Date('2024-01-01'),
  enrollmentEnd: null,
};

const familyMembershipRow = {
  userId: 'user-5',
  familyId: 'family-1',
  role: 'parent',
  joinedOn: new Date('2024-01-01'),
  leftOn: null,
};

const adminOrgDistrictRow = {
  administrationId: 'admin-1',
  orgId: 'district-1',
  orgType: OrgType.DISTRICT,
};

const adminOrgSchoolRow = {
  administrationId: 'admin-2',
  orgId: 'school-1',
  orgType: OrgType.SCHOOL,
};

const adminClassRow = {
  administrationId: 'admin-3',
  classId: 'class-1',
};

const adminGroupRow = {
  administrationId: 'admin-4',
  groupId: 'group-1',
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthorizationModule', () => {
  let mockClient: OpenFgaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockFgaClient();
  });

  describe('authorization', () => {
    it('throws 403 for non-super-admin', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: false });
      const db = createMockDb({});
      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });

      await expect(module.backfillFgaStore(authContext, { dryRun: false })).rejects.toThrow(
        expect.objectContaining({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );
    });

    it('does not query the database for non-super-admin', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: false });
      const db = createMockDb({});
      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });

      await expect(module.backfillFgaStore(authContext, { dryRun: false })).rejects.toThrow(ApiError);
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe('dry run', () => {
    it('returns tuple counts without calling writeTuples', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [schoolRow],
        classes: [classRow],
        user_orgs: [orgMembershipDistrictRow],
        user_classes: [classMembershipRow],
        user_groups: [groupMembershipRow],
        user_families: [familyMembershipRow],
        administration_orgs: [adminOrgDistrictRow],
        administration_classes: [adminClassRow],
        administration_groups: [adminGroupRow],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.totalTuples).toBeGreaterThan(0);
      expect(mockClient.writeTuples).not.toHaveBeenCalled();
    });

    it('logs tuple counts', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      await module.backfillFgaStore(authContext, { dryRun: true });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true, totalTuples: 0 }),
        'FGA backfill tuple counts',
      );
    });
  });

  describe('empty categories', () => {
    it('returns all zero counts when tables are empty', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: false });

      expect(result.categories).toEqual({
        orgHierarchy: 0,
        orgMemberships: 0,
        classMemberships: 0,
        groupMemberships: 0,
        familyMemberships: 0,
        administrationAssignments: 0,
      });
      expect(result.totalTuples).toBe(0);
      expect(mockClient.writeTuples).not.toHaveBeenCalled();
    });
  });

  describe('org hierarchy', () => {
    it('creates school hierarchy tuples (2 per school with parent)', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [schoolRow],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: true });

      // schoolHierarchyTuples returns 2 tuples per school
      expect(result.categories.orgHierarchy).toBe(2);
    });

    it('creates class hierarchy tuples (2 per class)', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [classRow],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: true });

      expect(result.categories.orgHierarchy).toBe(2);
    });
  });

  describe('org memberships', () => {
    it('routes district memberships to districtMembershipTuple', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [orgMembershipDistrictRow],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: false });

      expect(result.categories.orgMemberships).toBe(1);
      expect(mockClient.writeTuples).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user: 'user:user-1',
            object: 'district:district-1',
            relation: 'administrator',
          }),
        ]),
        expect.anything(),
      );
    });

    it('routes school memberships to schoolMembershipTuple', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [orgMembershipSchoolRow],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: false });

      expect(result.categories.orgMemberships).toBe(1);
      expect(mockClient.writeTuples).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user: 'user:user-2',
            object: 'school:school-1',
            relation: 'teacher',
          }),
        ]),
        expect.anything(),
      );
    });
  });

  describe('family memberships', () => {
    it('uses joinedOn/leftOn for family tuples', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [familyMembershipRow],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: false });

      expect(result.categories.familyMemberships).toBe(1);
      expect(mockClient.writeTuples).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user: 'user:user-5',
            object: 'family:family-1',
            relation: 'parent',
            condition: expect.objectContaining({
              name: 'active_membership',
              context: expect.objectContaining({
                grant_start: '2024-01-01T00:00:00.000Z',
              }),
            }),
          }),
        ]),
        expect.anything(),
      );
    });
  });

  describe('administration assignments', () => {
    it('routes district administration assignments correctly', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [adminOrgDistrictRow],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: false });

      expect(result.categories.administrationAssignments).toBe(1);
      expect(mockClient.writeTuples).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user: 'district:district-1',
            object: 'administration:admin-1',
            relation: 'assigned_district',
          }),
        ]),
        expect.anything(),
      );
    });

    it('routes school administration assignments correctly', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [adminOrgSchoolRow],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: false });

      expect(result.categories.administrationAssignments).toBe(1);
      expect(mockClient.writeTuples).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user: 'school:school-1',
            object: 'administration:admin-2',
            relation: 'assigned_school',
          }),
        ]),
        expect.anything(),
      );
    });

    it('handles class and group administration assignments', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [adminClassRow],
        administration_groups: [adminGroupRow],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: false });

      expect(result.categories.administrationAssignments).toBe(2);
    });
  });

  describe('SDK chunking', () => {
    it('splits tuples into batches of 100', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });

      // Create 250 class membership rows
      const manyClassRows = Array.from({ length: 250 }, (_, i) => ({
        userId: `user-${i}`,
        classId: `class-${i}`,
        role: 'student',
        enrollmentStart: new Date('2024-01-01'),
        enrollmentEnd: null,
      }));

      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: manyClassRows,
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      const result = await module.backfillFgaStore(authContext, { dryRun: false });

      expect(result.categories.classMemberships).toBe(250);

      // 250 tuples should be split into 3 batches: 100, 100, 50
      const classBatchCalls = (mockClient.writeTuples as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[][]) => call[0]!.length > 0,
      );
      // The class batch should have calls with sizes 100, 100, 50
      const classBatchSizes = classBatchCalls.map((call: unknown[][]) => call[0]!.length);
      expect(classBatchSizes).toContain(100);
      expect(classBatchSizes).toContain(50);
    });

    it('passes onDuplicateWrites: Ignore for idempotent writes', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createMockDb({
        orgs: [schoolRow],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });
      await module.backfillFgaStore(authContext, { dryRun: false });

      expect(mockClient.writeTuples).toHaveBeenCalledWith(expect.any(Array), {
        conflict: { onDuplicateWrites: ClientWriteRequestOnDuplicateWrites.Ignore },
      });
    });
  });

  describe('error handling', () => {
    it('wraps DB errors with per-category context via per-promise .catch()', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const dbError = new Error('Connection refused');

      // Create a chain that rejects on any await — all method calls return the chain,
      // but then() rejects with the error
      function createRejectingChain(): Record<string, unknown> {
        const chain: Record<string, unknown> = {};
        const handler = () => chain;
        for (const method of ['where', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'offset', 'groupBy']) {
          chain[method] = vi.fn(handler);
        }
        chain['then'] = (_resolve: unknown, reject: (e: Error) => void) => reject(dbError);
        return chain;
      }

      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue(createRejectingChain()),
        }),
      };

      const module = AuthorizationModule({ db: db as never, getClient: () => mockClient });

      await expect(module.backfillFgaStore(authContext, { dryRun: false })).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: dbError }),
        expect.stringContaining('Failed to build'),
      );
    });

    it('wraps FGA write errors with EXTERNAL_SERVICE_FAILED', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const fgaError = new Error('FGA connection timeout');

      const db = createMockDb({
        orgs: [schoolRow],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const failingClient = {
        ...createMockFgaClient(),
        writeTuples: vi.fn().mockRejectedValue(fgaError),
      } as unknown as OpenFgaClient;

      const module = AuthorizationModule({ db: db as never, getClient: () => failingClient });

      await expect(module.backfillFgaStore(authContext, { dryRun: false })).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });
  });
});
