import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import type { SyncFgaResponse } from '@roar-dashboard/api-contract';
import { ClientWriteRequestOnDuplicateWrites } from '@openfga/sdk';
import type { OpenFgaClient, TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { FgaClient } from '../../../clients/fga.client';
import { getCoreDbClient } from '../../../db/clients';
import type * as CoreDbSchema from '../../../db/schema/core';
import {
  orgs,
  classes,
  userOrgs,
  userClasses,
  userGroups,
  userFamilies,
  administrationOrgs,
  administrationClasses,
  administrationGroups,
} from '../../../db/schema/core';
import { OrgType } from '../../../enums/org-type.enum';
import { ApiErrorCode } from '../../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../../enums/api-error-message.enum';
import { ApiError } from '../../../errors/api-error';
import { logger } from '../../../logger';
import type { AuthContext } from '../../../types/auth-context';
import type { UserRole } from '../../../enums/user-role.enum';
import type { UserFamilyRole } from '../../../enums/user-family-role.enum';
import {
  schoolHierarchyTuples,
  classHierarchyTuples,
  districtMembershipTuple,
  schoolMembershipTuple,
  classMembershipTuple,
  groupMembershipTuple,
  familyMembershipTuple,
  administrationDistrictTuple,
  administrationSchoolTuple,
  administrationClassTuple,
  administrationGroupTuple,
} from '../../authorization/helpers/fga-tuples';
import { FGA_CLASS_VALID_ROLES } from '../../authorization/fga-constants';
import { categorizeFgaTuples, diffTuples } from './tuple-key.utils';
import type { SyncCategory, DiffResult } from './tuple-key.utils';

/** Maximum tuples per FGA writeTuples / deleteTuples call. */
const FGA_WRITE_BATCH_SIZE = 100;

/** Page size for FGA read calls. */
const FGA_READ_PAGE_SIZE = 100;

/**
 * Split an array into chunks of the given size.
 *
 * @param items - Array to chunk
 * @param size - Maximum chunk size
 * @returns Array of chunks
 */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * AuthorizationModule
 *
 * Reads all existing data from Postgres junction tables, compares against
 * current FGA tuples, and writes new / deletes stale tuples. Used to sync
 * an FGA store from existing Postgres data with diff-based reconciliation.
 *
 * @param db - Core database client (injectable for testing)
 * @param getClient - Callback returning the OpenFGA client
 */
export function AuthorizationModule({
  db,
  getClient = () => FgaClient.getClient(),
}: {
  db?: NodePgDatabase<typeof CoreDbSchema>;
  getClient?: () => OpenFgaClient;
} = {}) {
  /** Lazily resolve the DB client. */
  function getDb(): NodePgDatabase<typeof CoreDbSchema> {
    return db ?? getCoreDbClient();
  }

  /**
   * Write tuples to FGA in batches, skipping duplicates for idempotency.
   *
   * Uses `onDuplicateWrites: Ignore` so that re-running the backfill after a
   * partial failure (or against an already-hydrated store) succeeds without
   * erroring on tuples that were already written.
   *
   * @param tuples - Tuples to write
   */
  async function writeTuplesInBatches(tuples: (TupleKey | TupleKeyWithoutCondition)[]): Promise<void> {
    const client = getClient();
    const batches = chunk(tuples, FGA_WRITE_BATCH_SIZE);

    for (const batch of batches) {
      await client.writeTuples(batch, {
        conflict: { onDuplicateWrites: ClientWriteRequestOnDuplicateWrites.Ignore },
      });
    }
  }

  /**
   * Delete tuples from FGA in batches.
   *
   * @param tuples - Tuples to delete
   */
  async function deleteTuplesInBatches(tuples: TupleKey[]): Promise<void> {
    const client = getClient();
    const batches = chunk(tuples, FGA_WRITE_BATCH_SIZE);

    for (const batch of batches) {
      await client.deleteTuples(batch);
    }
  }

  /**
   * Read all tuples from the FGA store, paginating through continuation tokens.
   *
   * Passes an empty body so the server returns every tuple regardless of type.
   * Per-type filtering happens client-side via `categorizeFgaTuples`.
   *
   * @returns All tuples currently in the FGA store
   */
  async function readAllExistingTuples(): Promise<TupleKey[]> {
    const client = getClient();
    const allTuples: TupleKey[] = [];
    let continuationToken = '';

    do {
      const response = await client.read(
        {},
        {
          pageSize: FGA_READ_PAGE_SIZE,
          ...(continuationToken ? { continuationToken } : {}),
        },
      );

      for (const tuple of response.tuples) {
        allTuples.push(tuple.key);
      }

      continuationToken = response.continuation_token;
    } while (continuationToken);

    return allTuples;
  }

  // ── Category builders ──────────────────────────────────────────────────────

  /**
   * Build org hierarchy tuples: school->district and class->school links.
   */
  async function buildOrgHierarchyTuples(): Promise<TupleKeyWithoutCondition[]> {
    const dbClient = getDb();
    const tuples: TupleKeyWithoutCondition[] = [];

    // Schools with parent districts
    const schools = await dbClient
      .select({ id: orgs.id, parentOrgId: orgs.parentOrgId })
      .from(orgs)
      .where(eq(orgs.orgType, OrgType.SCHOOL));

    for (const school of schools) {
      if (school.parentOrgId) {
        tuples.push(...schoolHierarchyTuples(school.parentOrgId, school.id));
      }
    }

    // Classes with parent schools
    const allClasses = await dbClient.select({ id: classes.id, schoolId: classes.schoolId }).from(classes);

    for (const cls of allClasses) {
      tuples.push(...classHierarchyTuples(cls.schoolId, cls.id));
    }

    return tuples;
  }

  /**
   * Build org membership tuples from user_orgs, routing to district or school
   * based on org type.
   */
  async function buildOrgMembershipTuples(): Promise<TupleKey[]> {
    const dbClient = getDb();
    const tuples: TupleKey[] = [];

    const rows = await dbClient
      .select({
        userId: userOrgs.userId,
        orgId: userOrgs.orgId,
        role: userOrgs.role,
        enrollmentStart: userOrgs.enrollmentStart,
        enrollmentEnd: userOrgs.enrollmentEnd,
        orgType: orgs.orgType,
      })
      .from(userOrgs)
      .innerJoin(orgs, eq(userOrgs.orgId, orgs.id));

    for (const row of rows) {
      if (row.orgType === OrgType.DISTRICT) {
        tuples.push(
          districtMembershipTuple(row.userId, row.orgId, row.role as UserRole, row.enrollmentStart, row.enrollmentEnd),
        );
      } else {
        tuples.push(
          schoolMembershipTuple(row.userId, row.orgId, row.role as UserRole, row.enrollmentStart, row.enrollmentEnd),
        );
      }
    }

    return tuples;
  }

  /**
   * Build class membership tuples from user_classes.
   *
   * Filters out admin-tier roles (`administrator`, `district_administrator`, etc.)
   * because the FGA `class` type only defines educator and supervised roles.
   * Admin access to classes flows through the org hierarchy instead.
   */
  async function buildClassMembershipTuples(): Promise<TupleKey[]> {
    const dbClient = getDb();

    const rows = await dbClient
      .select({
        userId: userClasses.userId,
        classId: userClasses.classId,
        role: userClasses.role,
        enrollmentStart: userClasses.enrollmentStart,
        enrollmentEnd: userClasses.enrollmentEnd,
      })
      .from(userClasses);

    const tuples: TupleKey[] = [];
    let skipped = 0;

    for (const row of rows) {
      if (!FGA_CLASS_VALID_ROLES.has(row.role)) {
        skipped++;
        continue;
      }
      tuples.push(
        classMembershipTuple(row.userId, row.classId, row.role as UserRole, row.enrollmentStart, row.enrollmentEnd),
      );
    }

    if (skipped > 0) {
      logger.info({ skipped }, 'Skipped class membership rows with admin-tier roles (not valid on FGA class type)');
    }

    return tuples;
  }

  /**
   * Build group membership tuples from user_groups.
   */
  async function buildGroupMembershipTuples(): Promise<TupleKey[]> {
    const dbClient = getDb();

    const rows = await dbClient
      .select({
        userId: userGroups.userId,
        groupId: userGroups.groupId,
        role: userGroups.role,
        enrollmentStart: userGroups.enrollmentStart,
        enrollmentEnd: userGroups.enrollmentEnd,
      })
      .from(userGroups);

    return rows.map((row) =>
      groupMembershipTuple(row.userId, row.groupId, row.role as UserRole, row.enrollmentStart, row.enrollmentEnd),
    );
  }

  /**
   * Build family membership tuples from user_families.
   * Uses joinedOn/leftOn (not enrollmentStart/enrollmentEnd).
   */
  async function buildFamilyMembershipTuples(): Promise<TupleKey[]> {
    const dbClient = getDb();

    const rows = await dbClient
      .select({
        userId: userFamilies.userId,
        familyId: userFamilies.familyId,
        role: userFamilies.role,
        joinedOn: userFamilies.joinedOn,
        leftOn: userFamilies.leftOn,
      })
      .from(userFamilies);

    return rows.map((row) =>
      familyMembershipTuple(row.userId, row.familyId, row.role as UserFamilyRole, row.joinedOn, row.leftOn),
    );
  }

  /**
   * Build administration assignment tuples from administration_orgs,
   * administration_classes, and administration_groups.
   */
  async function buildAdministrationAssignmentTuples(): Promise<TupleKeyWithoutCondition[]> {
    const dbClient = getDb();
    const tuples: TupleKeyWithoutCondition[] = [];

    // Org assignments — route to district or school based on org type
    const orgRows = await dbClient
      .select({
        administrationId: administrationOrgs.administrationId,
        orgId: administrationOrgs.orgId,
        orgType: orgs.orgType,
      })
      .from(administrationOrgs)
      .innerJoin(orgs, eq(administrationOrgs.orgId, orgs.id));

    for (const row of orgRows) {
      if (row.orgType === OrgType.DISTRICT) {
        tuples.push(administrationDistrictTuple(row.administrationId, row.orgId));
      } else {
        tuples.push(administrationSchoolTuple(row.administrationId, row.orgId));
      }
    }

    // Class assignments
    const classRows = await dbClient
      .select({
        administrationId: administrationClasses.administrationId,
        classId: administrationClasses.classId,
      })
      .from(administrationClasses);

    for (const row of classRows) {
      tuples.push(administrationClassTuple(row.administrationId, row.classId));
    }

    // Group assignments
    const groupRows = await dbClient
      .select({
        administrationId: administrationGroups.administrationId,
        groupId: administrationGroups.groupId,
      })
      .from(administrationGroups);

    for (const row of groupRows) {
      tuples.push(administrationGroupTuple(row.administrationId, row.groupId));
    }

    return tuples;
  }

  // ── Main sync method ────────────────────────────────────────────────────────

  /**
   * Sync all FGA tuples from Postgres junction tables with diff-based reconciliation.
   *
   * Builds desired tuples from Postgres, reads existing tuples from FGA, diffs per
   * category, then deletes stale tuples and writes new ones. Deletes execute before
   * writes per category because FGA keys tuples by {user, relation, object} — if a
   * condition changed, the old tuple must be removed first.
   *
   * Authorization: super-admin only.
   *
   * @param authContext - The authenticated user's context
   * @param options - Sync options
   * @param options.dryRun - When true, reads FGA and returns diff counts without writing.
   *                         Requires a live FGA connection even in dry-run mode.
   * @returns Sync result with per-category write/delete counts
   * @throws {ApiError} FORBIDDEN if the user is not a super admin
   * @throws {ApiError} INTERNAL_SERVER_ERROR if a database or FGA error occurs
   */
  async function syncFgaStore(authContext: AuthContext, { dryRun }: { dryRun: boolean }): Promise<SyncFgaResponse> {
    const { userId, isSuperAdmin } = authContext;

    if (!isSuperAdmin) {
      logger.warn({ userId }, 'Non-super-admin attempted FGA sync');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId },
      });
    }

    /** Wrap a category builder promise — logs the underlying error, then throws ApiError. */
    function wrapCategoryBuilder<T>(promise: Promise<T>, category: string): Promise<T> {
      return promise.catch((err) => {
        const message = `Failed to build ${category} tuples`;
        logger.error({ err, context: { userId, category } }, message);
        throw new ApiError(message, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, category },
          cause: err,
        });
      });
    }

    try {
      // 1. Build desired tuples from Postgres (parallel per-category)
      const [orgHierarchy, orgMemberships, classMemberships, groupMemberships, familyMemberships, adminAssignments] =
        await Promise.all([
          wrapCategoryBuilder(buildOrgHierarchyTuples(), 'orgHierarchy'),
          wrapCategoryBuilder(buildOrgMembershipTuples(), 'orgMemberships'),
          wrapCategoryBuilder(buildClassMembershipTuples(), 'classMemberships'),
          wrapCategoryBuilder(buildGroupMembershipTuples(), 'groupMemberships'),
          wrapCategoryBuilder(buildFamilyMembershipTuples(), 'familyMemberships'),
          wrapCategoryBuilder(buildAdministrationAssignmentTuples(), 'administrationAssignments'),
        ]);

      // 2. Read existing tuples from FGA
      let existingTuples: TupleKey[];
      try {
        existingTuples = await readAllExistingTuples();
      } catch (err) {
        const message = 'Failed to read existing tuples from FGA';
        logger.error({ err, context: { userId } }, message);
        throw new ApiError(message, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          context: { userId },
          cause: err,
        });
      }

      // 3. Categorize existing tuples and diff per category
      const existingByCategory = categorizeFgaTuples(existingTuples);

      const desiredByCategory: Record<SyncCategory, (TupleKey | TupleKeyWithoutCondition)[]> = {
        orgHierarchy,
        orgMemberships,
        classMemberships,
        groupMemberships,
        familyMemberships,
        administrationAssignments: adminAssignments,
      };

      const categoryNames: SyncCategory[] = [
        'orgHierarchy',
        'orgMemberships',
        'classMemberships',
        'groupMemberships',
        'familyMemberships',
        'administrationAssignments',
      ];

      const categories = {} as Record<SyncCategory, { write: number; delete: number }>;
      const diffs = {} as Record<SyncCategory, DiffResult>;

      for (const name of categoryNames) {
        const diff = diffTuples(desiredByCategory[name], existingByCategory[name]);
        diffs[name] = diff;
        categories[name] = { write: diff.toWrite.length, delete: diff.toDelete.length };
      }

      const totalWrites = categoryNames.reduce((sum, name) => sum + categories[name].write, 0);
      const totalDeletes = categoryNames.reduce((sum, name) => sum + categories[name].delete, 0);

      logger.info({ categories, totalWrites, totalDeletes, dryRun, userId }, 'FGA sync diff counts');

      // 4. Execute deletes then writes per category
      if (!dryRun) {
        const syncCategories = [
          { name: 'orgHierarchy' as const, label: 'org hierarchy' },
          { name: 'orgMemberships' as const, label: 'org membership' },
          { name: 'classMemberships' as const, label: 'class membership' },
          { name: 'groupMemberships' as const, label: 'group membership' },
          { name: 'familyMemberships' as const, label: 'family membership' },
          { name: 'administrationAssignments' as const, label: 'administration assignment' },
        ] as const;

        for (const { name, label } of syncCategories) {
          const diff = diffs[name];

          try {
            // Deletes before writes — required for condition changes
            if (diff.toDelete.length > 0) {
              await deleteTuplesInBatches(diff.toDelete);
              logger.info({ count: diff.toDelete.length }, `Deleted stale ${label} tuples`);
            }

            if (diff.toWrite.length > 0) {
              await writeTuplesInBatches(diff.toWrite);
              logger.info({ count: diff.toWrite.length }, `Wrote new ${label} tuples`);
            }
          } catch (err) {
            if (err instanceof ApiError) throw err;
            logger.error({ err, context: { userId, category: label } }, `Failed to sync ${label} tuples to FGA`);
            throw new ApiError(`Failed to sync ${label} tuples to FGA`, {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
              context: { userId, category: label },
              cause: err,
            });
          }
        }

        logger.info({ totalWrites, totalDeletes, userId }, 'FGA sync completed successfully');
      }

      return {
        dryRun,
        categories,
        totalWrites,
        totalDeletes,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // Defensive: all known error paths (DB via wrapCategoryBuilder, FGA via per-category catch)
      // already throw ApiError, so this branch guards against unexpected failures only.
      logger.error({ err: error, context: { userId } }, 'FGA sync failed');
      throw new ApiError('FGA sync failed', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        context: { userId },
        cause: error,
      });
    }
  }

  return { syncFgaStore };
}
