import { and, eq, sql, isNull, asc, desc, countDistinct, inArray } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  users,
  userOrgs,
  userClasses,
  userGroups,
  orgs,
  classes,
  groups,
  administrationOrgs,
  administrationClasses,
  administrationGroups,
  administrationTaskVariants,
  taskVariants,
  tasks,
} from '../db/schema';
import type * as CoreDbSchema from '../db/schema/core';
import { CoreDbClient } from '../db/clients';
import { fdwRuns } from '../db/schema/assessment-fdw/runs';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { ScopeType } from '../services/report/report.types';
import { OrgType } from '../enums/org-type.enum';
import { UserRole } from '../enums/user-role.enum';
import type { PaginatedResult } from './base.repository';
import { isEnrollmentActive } from './utils/enrollment.utils';

/**
 * Scope parameters for report queries.
 */
export interface ReportScope {
  scopeType: ScopeType;
  scopeId: string;
}

/**
 * Task metadata resolved from administration_task_variants.
 */
export interface ReportTaskMeta {
  taskId: string;
  taskVariantId: string;
  taskSlug: string;
  taskName: string;
  orderIndex: number;
}

/**
 * Raw progress data for a single student from the database.
 */
export interface StudentProgressRow {
  userId: string;
  assessmentPid: string | null;
  username: string | null;
  email: string | null;
  nameFirst: string | null;
  nameLast: string | null;
  grade: string | null;
  schoolName: string | null;
  /** Map of taskVariantId → run info. startedAt is from the FDW runs table's createdAt. */
  runs: Map<string, { completedAt: Date | null; startedAt: Date }>;
}

/**
 * Pagination options for report queries.
 */
export interface ReportPaginationOptions {
  page: number;
  perPage: number;
  sortColumn?: Column | SQL | undefined;
  sortDirection?: SortOrder | undefined;
}

/**
 * ReportRepository
 *
 * Provides data access for reporting endpoints. This is a standalone class
 * (not extending BaseRepository) because it performs cross-database queries
 * via FDW tables and complex multi-table joins that don't fit the standard
 * CRUD pattern.
 *
 * Uses `CoreDbClient` despite querying assessment data because the FDW tables
 * (`app_assessment_fdw.runs`) are foreign tables defined in the core database
 * that bridge to the assessment database. All queries go through the core DB
 * connection; the FDW handles the cross-database communication transparently.
 */
export class ReportRepository {
  constructor(private readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Get task metadata for an administration, ordered by orderIndex.
   *
   * @param administrationId - The administration to get tasks for
   * @returns Ordered array of task metadata
   */
  async getTaskMetadata(administrationId: string): Promise<ReportTaskMeta[]> {
    const rows = await this.db
      .select({
        taskId: tasks.id,
        taskVariantId: taskVariants.id,
        taskSlug: tasks.slug,
        taskName: tasks.name,
        orderIndex: administrationTaskVariants.orderIndex,
      })
      .from(administrationTaskVariants)
      .innerJoin(taskVariants, eq(administrationTaskVariants.taskVariantId, taskVariants.id))
      .innerJoin(tasks, eq(taskVariants.taskId, tasks.id))
      .where(eq(administrationTaskVariants.administrationId, administrationId))
      .orderBy(asc(administrationTaskVariants.orderIndex));

    return rows;
  }

  /**
   * Validate that a scope entity is assigned to the administration.
   *
   * @param administrationId - The administration ID
   * @param scope - The scope to validate
   * @returns true if the scope entity is assigned to the administration
   */
  async isScopeAssignedToAdministration(administrationId: string, scope: ReportScope): Promise<boolean> {
    let result: { exists: boolean }[];

    switch (scope.scopeType) {
      case 'district': {
        // Check administration_orgs for any org whose path is at or below the district
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationOrgs)
          .innerJoin(orgs, eq(administrationOrgs.orgId, orgs.id))
          .where(
            and(
              eq(administrationOrgs.administrationId, administrationId),
              // ltree <@ includes self-matches, so an exact ID check is unnecessary
              sql`${orgs.path} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
            ),
          )
          .limit(1);
        if (result.length > 0) return true;

        // Also check administration_classes — the administration may only have classes assigned
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationClasses)
          .innerJoin(classes, eq(administrationClasses.classId, classes.id))
          .where(
            and(
              eq(administrationClasses.administrationId, administrationId),
              sql`${classes.orgPath} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
            ),
          )
          .limit(1);
        return result.length > 0;
      }

      case 'school': {
        // Check administration_orgs for the school org itself
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationOrgs)
          .innerJoin(orgs, eq(administrationOrgs.orgId, orgs.id))
          .where(
            and(
              eq(administrationOrgs.administrationId, administrationId),
              sql`${orgs.path} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
            ),
          )
          .limit(1);
        if (result.length > 0) return true;

        // Also check administration_classes where the class belongs to this school
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationClasses)
          .innerJoin(classes, eq(administrationClasses.classId, classes.id))
          .where(and(eq(administrationClasses.administrationId, administrationId), eq(classes.schoolId, scope.scopeId)))
          .limit(1);
        return result.length > 0;
      }

      case 'class':
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationClasses)
          .where(
            and(
              eq(administrationClasses.administrationId, administrationId),
              eq(administrationClasses.classId, scope.scopeId),
            ),
          )
          .limit(1);

        if (result.length > 0) return true;

        // A class also counts as assigned if its school or a parent org is assigned
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationOrgs)
          .innerJoin(orgs, eq(administrationOrgs.orgId, orgs.id))
          .where(
            and(
              eq(administrationOrgs.administrationId, administrationId),
              sql`(SELECT org_path FROM app.classes WHERE id = ${scope.scopeId}) <@ ${orgs.path}`,
            ),
          )
          .limit(1);
        return result.length > 0;

      case 'group':
        result = await this.db
          .select({ exists: sql<boolean>`true` })
          .from(administrationGroups)
          .where(
            and(
              eq(administrationGroups.administrationId, administrationId),
              eq(administrationGroups.groupId, scope.scopeId),
            ),
          )
          .limit(1);
        return result.length > 0;
    }
  }

  /**
   * Get the user's roles on the scope entity or its ancestors.
   * Used to determine if a user has a supervisory role at or above the scope level.
   *
   * @param userId - The user to check roles for
   * @param scope - The scope to check against
   * @returns Array of role strings the user holds at or above the scope
   */
  async getUserRolesAtOrAboveScope(userId: string, scope: ReportScope): Promise<string[]> {
    switch (scope.scopeType) {
      case 'district':
      case 'school': {
        // Check user_orgs for roles at the scope org or any ancestor
        const orgRoles = await this.db
          .select({ role: userOrgs.role })
          .from(userOrgs)
          .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
          .where(
            and(
              eq(userOrgs.userId, userId),
              isEnrollmentActive(userOrgs),
              isNull(orgs.rosteringEnded),
              sql`(SELECT path FROM app.orgs WHERE id = ${scope.scopeId}) <@ ${orgs.path}`,
            ),
          );
        return orgRoles.map((r) => r.role);
      }

      case 'class': {
        // Check user_classes for role on this class
        const classRoles = await this.db
          .select({ role: userClasses.role })
          .from(userClasses)
          .innerJoin(classes, eq(userClasses.classId, classes.id))
          .where(
            and(
              eq(userClasses.userId, userId),
              eq(userClasses.classId, scope.scopeId),
              isEnrollmentActive(userClasses),
              isNull(classes.rosteringEnded),
            ),
          );

        // Also check user_orgs for roles at the class's school or above
        const orgRoles = await this.db
          .select({ role: userOrgs.role })
          .from(userOrgs)
          .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
          .where(
            and(
              eq(userOrgs.userId, userId),
              isEnrollmentActive(userOrgs),
              isNull(orgs.rosteringEnded),
              sql`(SELECT org_path FROM app.classes WHERE id = ${scope.scopeId}) <@ ${orgs.path}`,
            ),
          );
        return [...classRoles.map((r) => r.role), ...orgRoles.map((r) => r.role)];
      }

      case 'group': {
        // Check user_groups for role on this group
        const groupRoles = await this.db
          .select({ role: userGroups.role })
          .from(userGroups)
          .innerJoin(groups, eq(userGroups.groupId, groups.id))
          .where(
            and(
              eq(userGroups.userId, userId),
              eq(userGroups.groupId, scope.scopeId),
              isEnrollmentActive(userGroups),
              isNull(groups.rosteringEnded),
            ),
          );
        return groupRoles.map((r) => r.role);
      }
    }
  }

  /**
   * Get paginated students within a scope, with their run data for the given task variants.
   *
   * Students are resolved from the scope entity (org/class/group junction tables),
   * filtered to student roles, and left-joined with FDW runs for completion status.
   *
   * @param administrationId - The administration ID
   * @param scope - The scope to query students within
   * @param taskVariantIds - The task variant IDs to get run data for
   * @param options - Pagination and sorting options
   * @param filterCondition - Optional SQL filter condition. Must only reference columns
   *   from the `users` table, since that's the only data table in the count and data queries.
   *   The allowed fields are controlled by PROGRESS_FILTER_FIELDS in the service layer.
   * @returns Paginated student rows with run data
   */
  async getProgressStudents(
    administrationId: string,
    scope: ReportScope,
    taskVariantIds: string[],
    options: ReportPaginationOptions,
    filterCondition?: SQL,
  ): Promise<PaginatedResult<StudentProgressRow>> {
    const { page, perPage } = options;
    const offset = (page - 1) * perPage;

    // Build the student-in-scope subquery
    const studentsInScope = this.buildStudentInScopeSubquery(scope);

    // Get total count — use countDistinct because the UNION-based subquery
    // can produce duplicate userIds (e.g., a student in both user_orgs and user_classes)
    const [countRow] = await this.db
      .select({ total: countDistinct(users.id) })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId))
      .where(filterCondition);

    const totalItems = countRow?.total ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Get paginated students with sorting
    const sortFn = options.sortDirection === SortOrder.DESC ? desc : asc;
    const sortExpr = options.sortColumn ?? users.nameLast;

    const studentRows = await this.db
      .selectDistinct({
        userId: users.id,
        assessmentPid: users.assessmentPid,
        username: users.username,
        email: users.email,
        nameFirst: users.nameFirst,
        nameLast: users.nameLast,
        grade: users.grade,
      })
      .from(users)
      .innerJoin(studentsInScope, eq(users.id, studentsInScope.userId))
      .where(filterCondition)
      .orderBy(sortFn(sortExpr), asc(users.id))
      .limit(perPage)
      .offset(offset);

    if (studentRows.length === 0) {
      return { items: [], totalItems };
    }

    const studentIds = studentRows.map((s) => s.userId);

    // Skip FDW query when there are no task variants — nothing to look up
    if (taskVariantIds.length === 0) {
      return {
        items: studentRows.map((student) => ({
          ...student,
          schoolName: null,
          runs: new Map(),
        })),
        totalItems,
      };
    }

    // Bulk fetch runs for these students.
    // Filter out soft-deleted, aborted, and non-reporting runs.
    // reliableRun is intentionally not filtered — unreliable runs still represent progress.
    const runRows = await this.db
      .select({
        userId: fdwRuns.userId,
        taskVariantId: fdwRuns.taskVariantId,
        completedAt: fdwRuns.completedAt,
        createdAt: fdwRuns.createdAt,
      })
      .from(fdwRuns)
      .where(
        and(
          eq(fdwRuns.administrationId, administrationId),
          inArray(fdwRuns.userId, studentIds),
          inArray(fdwRuns.taskVariantId, taskVariantIds),
          isNull(fdwRuns.deletedAt),
          isNull(fdwRuns.abortedAt),
          eq(fdwRuns.useForReporting, true),
        ),
      );

    // Build run maps per student.
    // If multiple runs exist for the same task variant, prefer completed over non-completed,
    // and among completed runs prefer the most recent completedAt.
    const runsByStudent = new Map<string, Map<string, { completedAt: Date | null; startedAt: Date }>>();
    for (const run of runRows) {
      if (!runsByStudent.has(run.userId)) {
        runsByStudent.set(run.userId, new Map());
      }
      const studentRuns = runsByStudent.get(run.userId)!;
      const existing = studentRuns.get(run.taskVariantId);
      const shouldReplace =
        !existing ||
        (run.completedAt && !existing.completedAt) ||
        (run.completedAt && existing.completedAt && run.completedAt > existing.completedAt);
      if (shouldReplace) {
        studentRuns.set(run.taskVariantId, {
          completedAt: run.completedAt,
          startedAt: run.createdAt,
        });
      }
    }

    // Resolve school names if district scope
    let schoolNamesByUser: Map<string, string> | undefined;
    if (scope.scopeType === 'district') {
      schoolNamesByUser = await this.getSchoolNamesForUsers(studentIds);
    }

    // Assemble results
    const items: StudentProgressRow[] = studentRows.map((student) => ({
      userId: student.userId,
      assessmentPid: student.assessmentPid,
      username: student.username,
      email: student.email,
      nameFirst: student.nameFirst,
      nameLast: student.nameLast,
      grade: student.grade,
      schoolName: schoolNamesByUser?.get(student.userId) ?? null,
      runs: runsByStudent.get(student.userId) ?? new Map(),
    }));

    return { items, totalItems };
  }

  /**
   * Builds a subquery that returns student userIds within a scope.
   * Filters to student roles and excludes rosteringEnded entities.
   * UNION (not UNION ALL) handles deduplication across branches.
   *
   * No `deletedAt` filter on users is needed because the users table has no
   * soft-delete column. Instead, rostered users are protected from hard deletion
   * by the `prevent_rostered_entity_delete` DB trigger.
   */
  private buildStudentInScopeSubquery(scope: ReportScope) {
    switch (scope.scopeType) {
      case 'district':
        // Students in user_orgs where org path is at or below the district
        // UNION students in user_classes where class orgPath is at or below.
        // UNION (not UNION ALL) deduplicates across branches; no selectDistinct needed.
        return this.db
          .select({ userId: userOrgs.userId })
          .from(userOrgs)
          .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
          .where(
            and(
              eq(userOrgs.role, UserRole.STUDENT),
              isEnrollmentActive(userOrgs),
              isNull(orgs.rosteringEnded),
              sql`${orgs.path} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
            ),
          )
          .union(
            this.db
              .select({ userId: userClasses.userId })
              .from(userClasses)
              .innerJoin(classes, eq(userClasses.classId, classes.id))
              .where(
                and(
                  eq(userClasses.role, UserRole.STUDENT),
                  isEnrollmentActive(userClasses),
                  isNull(classes.rosteringEnded),
                  sql`${classes.orgPath} <@ (SELECT path FROM app.orgs WHERE id = ${scope.scopeId})`,
                ),
              ),
          )
          .as('students_in_scope');

      case 'school':
        // Students in user_orgs where orgId = schoolId
        // UNION students in user_classes where class.schoolId = schoolId
        return this.db
          .select({ userId: userOrgs.userId })
          .from(userOrgs)
          .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
          .where(
            and(
              eq(userOrgs.role, UserRole.STUDENT),
              isEnrollmentActive(userOrgs),
              isNull(orgs.rosteringEnded),
              eq(userOrgs.orgId, scope.scopeId),
            ),
          )
          .union(
            this.db
              .select({ userId: userClasses.userId })
              .from(userClasses)
              .innerJoin(classes, eq(userClasses.classId, classes.id))
              .where(
                and(
                  eq(userClasses.role, UserRole.STUDENT),
                  isEnrollmentActive(userClasses),
                  isNull(classes.rosteringEnded),
                  eq(classes.schoolId, scope.scopeId),
                ),
              ),
          )
          .as('students_in_scope');

      case 'class':
        return this.db
          .select({ userId: userClasses.userId })
          .from(userClasses)
          .innerJoin(classes, eq(userClasses.classId, classes.id))
          .where(
            and(
              eq(userClasses.role, UserRole.STUDENT),
              isEnrollmentActive(userClasses),
              isNull(classes.rosteringEnded),
              eq(userClasses.classId, scope.scopeId),
            ),
          )
          .as('students_in_scope');

      case 'group':
        return this.db
          .select({ userId: userGroups.userId })
          .from(userGroups)
          .innerJoin(groups, eq(userGroups.groupId, groups.id))
          .where(
            and(
              eq(userGroups.role, UserRole.STUDENT),
              isEnrollmentActive(userGroups),
              isNull(groups.rosteringEnded),
              eq(userGroups.groupId, scope.scopeId),
            ),
          )
          .as('students_in_scope');

      default:
        // Exhaustive check — this should never be reached since ScopeType is validated by Zod
        throw new Error(`Unsupported scope type: ${scope.scopeType satisfies never}`);
    }
  }

  /**
   * Resolve school names for a set of users by looking up their org memberships.
   * Returns the name of the school-type org the user belongs to.
   * If a user belongs to multiple schools, uses the alphabetically first school name
   * for deterministic results.
   *
   * Note: This lookup is not scoped to the administration's assigned orgs — it returns
   * the user's school from their org membership regardless of which schools are part of
   * the administration. For a user enrolled in multiple schools, the alphabetically first
   * school may not be the most relevant one for the current report context.
   */
  private async getSchoolNamesForUsers(userIds: string[]): Promise<Map<string, string>> {
    const rows = await this.db
      .selectDistinct({
        userId: userOrgs.userId,
        schoolName: orgs.name,
      })
      .from(userOrgs)
      .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
      .where(
        and(
          inArray(userOrgs.userId, userIds),
          eq(orgs.orgType, OrgType.SCHOOL),
          isEnrollmentActive(userOrgs),
          isNull(orgs.rosteringEnded),
        ),
      )
      .orderBy(asc(orgs.name));

    const map = new Map<string, string>();
    for (const row of rows) {
      // If a user belongs to multiple schools, use the alphabetically first one
      if (!map.has(row.userId)) {
        map.set(row.userId, row.schoolName);
      }
    }

    // Also check user_classes → classes → school for users not found via user_orgs
    const missingUserIds = userIds.filter((id) => !map.has(id));
    if (missingUserIds.length > 0) {
      const classRows = await this.db
        .selectDistinct({
          userId: userClasses.userId,
          schoolName: orgs.name,
        })
        .from(userClasses)
        .innerJoin(classes, eq(userClasses.classId, classes.id))
        .innerJoin(orgs, eq(classes.schoolId, orgs.id))
        .where(
          and(
            inArray(userClasses.userId, missingUserIds),
            isEnrollmentActive(userClasses),
            isNull(classes.rosteringEnded),
            isNull(orgs.rosteringEnded),
          ),
        )
        .orderBy(asc(orgs.name));

      for (const row of classRows) {
        if (!map.has(row.userId)) {
          map.set(row.userId, row.schoolName);
        }
      }
    }

    return map;
  }
}
