import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import type { BackfillFgaResponse } from '@roar-dashboard/api-contract';
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

/** Maximum tuples per FGA writeTuples call. */
const FGA_WRITE_BATCH_SIZE = 100;

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
 * Reads all existing data from Postgres junction tables and writes
 * the corresponding FGA tuples. Used to hydrate an FGA store from
 * existing Postgres data (e.g., after a dbt migration from Firestore).
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

  // ── Category builders ──────────────────────────────────────────────────────

  /**
   * Build org hierarchy tuples: school→district and class→school links.
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

  // ── Main backfill method ────────────────────────────────────────────────────

  /**
   * Backfill all FGA tuples from Postgres junction tables.
   *
   * Authorization: super-admin only.
   *
   * @param authContext - The authenticated user's context
   * @param options - Backfill options
   * @param options.dryRun - When true, returns counts without writing to FGA
   * @returns Backfill result with per-category tuple counts
   * @throws {ApiError} FORBIDDEN if the user is not a super admin
   * @throws {ApiError} INTERNAL_SERVER_ERROR if a database or FGA error occurs
   */
  async function backfillFgaStore(
    authContext: AuthContext,
    { dryRun }: { dryRun: boolean },
  ): Promise<BackfillFgaResponse> {
    const { userId, isSuperAdmin } = authContext;

    if (!isSuperAdmin) {
      logger.warn({ userId }, 'Non-super-admin attempted FGA backfill');
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
      // Build all tuples in parallel — per-promise .catch() preserves which category failed
      const [orgHierarchy, orgMemberships, classMemberships, groupMemberships, familyMemberships, adminAssignments] =
        await Promise.all([
          wrapCategoryBuilder(buildOrgHierarchyTuples(), 'orgHierarchy'),
          wrapCategoryBuilder(buildOrgMembershipTuples(), 'orgMemberships'),
          wrapCategoryBuilder(buildClassMembershipTuples(), 'classMemberships'),
          wrapCategoryBuilder(buildGroupMembershipTuples(), 'groupMemberships'),
          wrapCategoryBuilder(buildFamilyMembershipTuples(), 'familyMemberships'),
          wrapCategoryBuilder(buildAdministrationAssignmentTuples(), 'administrationAssignments'),
        ]);

      const categories = {
        orgHierarchy: orgHierarchy.length,
        orgMemberships: orgMemberships.length,
        classMemberships: classMemberships.length,
        groupMemberships: groupMemberships.length,
        familyMemberships: familyMemberships.length,
        administrationAssignments: adminAssignments.length,
      };

      const totalTuples =
        categories.orgHierarchy +
        categories.orgMemberships +
        categories.classMemberships +
        categories.groupMemberships +
        categories.familyMemberships +
        categories.administrationAssignments;

      logger.info({ categories, totalTuples, dryRun, userId }, 'FGA backfill tuple counts');

      if (!dryRun) {
        // Write all categories sequentially to avoid overwhelming FGA
        const writeCategories = [
          { tuples: orgHierarchy, label: 'org hierarchy' },
          { tuples: orgMemberships, label: 'org membership' },
          { tuples: classMemberships, label: 'class membership' },
          { tuples: groupMemberships, label: 'group membership' },
          { tuples: familyMemberships, label: 'family membership' },
          { tuples: adminAssignments, label: 'administration assignment' },
        ] as const;

        for (const { tuples, label } of writeCategories) {
          try {
            await writeTuplesInBatches(tuples);
            logger.info({ count: tuples.length }, `Wrote ${label} tuples`);
          } catch (err) {
            logger.error({ err, context: { userId, category: label } }, `Failed to write ${label} tuples to FGA`);
            throw new ApiError(`Failed to write ${label} tuples to FGA`, {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
              context: { userId, category: label },
              cause: err,
            });
          }
        }

        logger.info({ totalTuples, userId }, 'FGA backfill completed successfully');
      }

      return { dryRun, categories, totalTuples };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'FGA backfill failed');
      throw new ApiError('FGA backfill failed', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.INTERNAL,
        context: { userId },
        cause: error,
      });
    }
  }

  return { backfillFgaStore };
}
