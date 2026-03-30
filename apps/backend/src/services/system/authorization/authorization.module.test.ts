import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ClientWriteRequestOnDuplicateWrites } from '@openfga/sdk';
import type { OpenFgaClient } from '@openfga/sdk';
import { StatusCodes } from 'http-status-codes';
import { ApiErrorCode } from '../../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../../enums/api-error-message.enum';
import { ApiError } from '../../../errors/api-error';
import { logger } from '../../../logger';
import {
  createMockFgaClient,
  mockReadResponse,
  mockReadImplementation,
  type MockFgaClient,
} from '../../../test-support/clients/fga.client';
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Helper to create an empty-tables DB for tests that only care about FGA behavior. */
function createEmptyDb() {
  return createMockDb({
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
}

// ── Tests ────────────────────────────────────────────────────────────────────

// Safe cast: the module only calls writeTuples/deleteTuples/read, which the mock provides
const asOpenFgaClient = (mock: MockFgaClient) => mock as unknown as OpenFgaClient;

describe('AuthorizationModule', () => {
  let mockClient: MockFgaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockFgaClient();
  });

  describe('authorization', () => {
    it('throws 403 for non-super-admin', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: false });
      const db = createMockDb({});
      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });

      await expect(module.syncFgaStore(authContext, { dryRun: false })).rejects.toThrow(
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
      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });

      await expect(module.syncFgaStore(authContext, { dryRun: false })).rejects.toThrow(ApiError);
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe('dry run', () => {
    it('returns write/delete counts without calling writeTuples or deleteTuples', async () => {
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.totalWrites).toBeGreaterThan(0);
      expect(result.totalDeletes).toBe(0);
      expect(mockClient.read).toHaveBeenCalled();
      expect(mockClient.writeTuples).not.toHaveBeenCalled();
      expect(mockClient.deleteTuples).not.toHaveBeenCalled();
    });

    it('logs diff counts', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createEmptyDb();

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      await module.syncFgaStore(authContext, { dryRun: true });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true, totalWrites: 0, totalDeletes: 0 }),
        'FGA sync diff counts',
      );
    });
  });

  describe('empty categories', () => {
    it('returns all zero counts when tables are empty and FGA is empty', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createEmptyDb();

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories).toEqual({
        orgHierarchy: { write: 0, delete: 0 },
        orgMemberships: { write: 0, delete: 0 },
        classMemberships: { write: 0, delete: 0 },
        groupMemberships: { write: 0, delete: 0 },
        familyMemberships: { write: 0, delete: 0 },
        administrationAssignments: { write: 0, delete: 0 },
      });
      expect(result.totalWrites).toBe(0);
      expect(result.totalDeletes).toBe(0);
      expect(mockClient.writeTuples).not.toHaveBeenCalled();
      expect(mockClient.deleteTuples).not.toHaveBeenCalled();
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: true });

      // schoolHierarchyTuples returns 2 tuples per school
      expect(result.categories.orgHierarchy.write).toBe(2);
      expect(result.categories.orgHierarchy.delete).toBe(0);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: true });

      expect(result.categories.orgHierarchy.write).toBe(2);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.orgMemberships.write).toBe(1);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.orgMemberships.write).toBe(1);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.familyMemberships.write).toBe(1);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.administrationAssignments.write).toBe(1);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.administrationAssignments.write).toBe(1);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.administrationAssignments.write).toBe(2);
    });
  });

  describe('class membership role filtering', () => {
    it('skips admin-tier roles on class memberships and logs the count', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });

      const validRow = {
        userId: 'user-valid',
        classId: 'class-1',
        role: 'student',
        enrollmentStart: new Date('2024-01-01'),
        enrollmentEnd: null,
      };
      const adminRow = {
        userId: 'user-admin',
        classId: 'class-1',
        role: 'administrator',
        enrollmentStart: new Date('2024-01-01'),
        enrollmentEnd: null,
      };

      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [validRow, adminRow],
        user_groups: [],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      // Only the student row should produce a tuple
      expect(result.categories.classMemberships.write).toBe(1);

      // The writeTuples call should not contain the administrator row
      const writtenTuples = mockClient.writeTuples.mock.calls.flatMap((call) => call[0]);
      expect(writtenTuples).not.toContainEqual(
        expect.objectContaining({ user: 'user:user-admin', object: 'class:class-1' }),
      );
      expect(writtenTuples).toContainEqual(
        expect.objectContaining({ user: 'user:user-valid', object: 'class:class-1', relation: 'student' }),
      );

      // Should log the skip count
      expect(logger.info).toHaveBeenCalledWith(
        { skipped: 1 },
        'Skipped class membership rows with admin-tier roles (not valid on FGA class type)',
      );
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.classMemberships.write).toBe(250);

      // 250 tuples should be split into 3 batches: 100, 100, 50
      const classBatchCalls = mockClient.writeTuples.mock.calls.filter((call) => call[0].length > 0);
      // The class batch should have calls with sizes 100, 100, 50
      const classBatchSizes = classBatchCalls.map((call) => call[0].length);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      await module.syncFgaStore(authContext, { dryRun: false });

      expect(mockClient.writeTuples).toHaveBeenCalledWith(expect.any(Array), {
        conflict: { onDuplicateWrites: ClientWriteRequestOnDuplicateWrites.Ignore },
      });
    });
  });

  describe('diff-based reconciliation', () => {
    it('deletes stale tuples not in Postgres', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createEmptyDb();

      // FGA has a stale group membership
      const staleTuple = {
        key: { user: 'user:old-user', relation: 'student', object: 'group:group-1' },
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockReadImplementation(mockClient, async (body) => {
        const obj = body?.object ?? '';
        if (typeof obj === 'string' && obj.startsWith('group:')) {
          return mockReadResponse([staleTuple]);
        }
        return mockReadResponse([]);
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.groupMemberships.delete).toBe(1);
      expect(result.categories.groupMemberships.write).toBe(0);
      expect(mockClient.deleteTuples).toHaveBeenCalledWith([staleTuple.key]);
    });

    it('handles condition change as 1 delete + 1 write', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });

      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [
          {
            userId: 'user-4',
            groupId: 'group-1',
            role: 'student',
            enrollmentStart: new Date('2024-01-01'),
            enrollmentEnd: new Date('2026-01-01'), // updated end date
          },
        ],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      // FGA has the old version with a different end date
      const oldTuple = {
        key: {
          user: 'user:user-4',
          relation: 'student',
          object: 'group:group-1',
          condition: {
            name: 'active_membership',
            context: {
              grant_start: '2024-01-01T00:00:00.000Z',
              grant_end: '2025-01-01T00:00:00.000Z', // old end date
            },
          },
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockReadImplementation(mockClient, async (body) => {
        const obj = body?.object ?? '';
        if (typeof obj === 'string' && obj.startsWith('group:')) {
          return mockReadResponse([oldTuple]);
        }
        return mockReadResponse([]);
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.groupMemberships.delete).toBe(1);
      expect(result.categories.groupMemberships.write).toBe(1);
    });

    it('no-op when FGA matches Postgres exactly', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });

      const db = createMockDb({
        orgs: [],
        classes: [],
        user_orgs: [],
        user_classes: [],
        user_groups: [
          {
            userId: 'user-4',
            groupId: 'group-1',
            role: 'student',
            enrollmentStart: new Date('2024-01-01'),
            enrollmentEnd: null,
          },
        ],
        user_families: [],
        administration_orgs: [],
        administration_classes: [],
        administration_groups: [],
      });

      // FGA already has the exact same tuple
      const matchingTuple = {
        key: {
          user: 'user:user-4',
          relation: 'student',
          object: 'group:group-1',
          condition: {
            name: 'active_membership',
            context: {
              grant_start: '2024-01-01T00:00:00.000Z',
              grant_end: '9999-12-31T23:59:59Z',
            },
          },
        },
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockReadImplementation(mockClient, async (body) => {
        const obj = body?.object ?? '';
        if (typeof obj === 'string' && obj.startsWith('group:')) {
          return mockReadResponse([matchingTuple]);
        }
        return mockReadResponse([]);
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      expect(result.categories.groupMemberships.write).toBe(0);
      expect(result.categories.groupMemberships.delete).toBe(0);
      expect(result.totalWrites).toBe(0);
      expect(result.totalDeletes).toBe(0);
      expect(mockClient.writeTuples).not.toHaveBeenCalled();
      expect(mockClient.deleteTuples).not.toHaveBeenCalled();
    });

    it('paginates through continuation tokens', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const db = createEmptyDb();

      const tuple1 = {
        key: { user: 'user:u1', relation: 'student', object: 'group:g1' },
        timestamp: '2024-01-01T00:00:00Z',
      };
      const tuple2 = {
        key: { user: 'user:u2', relation: 'student', object: 'group:g2' },
        timestamp: '2024-01-01T00:00:00Z',
      };

      let callCount = 0;
      mockReadImplementation(mockClient, async (body) => {
        const obj = body?.object ?? '';
        if (typeof obj === 'string' && obj.startsWith('group:')) {
          callCount++;
          if (callCount === 1) {
            return mockReadResponse([tuple1], 'page2-token');
          }
          return mockReadResponse([tuple2]);
        }
        return mockReadResponse([]);
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      const result = await module.syncFgaStore(authContext, { dryRun: false });

      // Both stale tuples should be detected as deletes
      expect(result.categories.groupMemberships.delete).toBe(2);

      // Should have called read with continuation token
      expect(mockClient.read).toHaveBeenCalledWith(
        { object: 'group:' },
        expect.objectContaining({ continuationToken: 'page2-token' }),
      );
    });

    it('deletes execute before writes within a category', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });

      // Postgres has a hierarchy tuple
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

      // FGA has a stale hierarchy tuple that overlaps on district/school prefix
      const staleTuple = {
        key: { user: 'district:old-district', relation: 'parent_org', object: 'school:school-1' },
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockReadImplementation(mockClient, async (body) => {
        const obj = body?.object ?? '';
        if (typeof obj === 'string' && obj.startsWith('school:')) {
          return mockReadResponse([staleTuple]);
        }
        return mockReadResponse([]);
      });

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });
      await module.syncFgaStore(authContext, { dryRun: false });

      // Verify delete is called before write
      const deleteCalls = mockClient.deleteTuples.mock.invocationCallOrder;
      const writeCalls = mockClient.writeTuples.mock.invocationCallOrder;

      // Find the first delete and first write call
      const firstDelete = deleteCalls[0];
      const firstWrite = writeCalls[0];

      expect(firstDelete).toBeDefined();
      expect(firstWrite).toBeDefined();
      expect(firstDelete!).toBeLessThan(firstWrite!);
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

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(mockClient) });

      await expect(module.syncFgaStore(authContext, { dryRun: false })).rejects.toThrow(
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

      const failingClient = createMockFgaClient();
      failingClient.writeTuples.mockRejectedValue(fgaError);

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(failingClient) });

      await expect(module.syncFgaStore(authContext, { dryRun: false })).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );
    });

    it('wraps FGA read errors with EXTERNAL_SERVICE_FAILED', async () => {
      const authContext = AuthContextFactory.build({ isSuperAdmin: true });
      const fgaError = new Error('FGA read timeout');
      const db = createEmptyDb();

      const failingClient = createMockFgaClient();
      failingClient.read.mockRejectedValue(fgaError);

      const module = AuthorizationModule({ db: db as never, getClient: () => asOpenFgaClient(failingClient) });

      await expect(module.syncFgaStore(authContext, { dryRun: false })).rejects.toThrow(
        expect.objectContaining({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        }),
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: fgaError }),
        'Failed to read existing tuples from FGA',
      );
    });
  });
});
