import type { SchoolClassSortFieldType } from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { Column, SQL } from 'drizzle-orm';
import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CoreDbClient } from '../db/clients';
import type { Class } from '../db/schema';
import { classes, userClasses, users } from '../db/schema';
import type * as CoreDbSchema from '../db/schema/core';
import type { ClassType } from '../enums/class-type.enum';
import type { Grade } from '../enums/grade.enum';
import type { ParsedFilter } from '../types/filter';
import type { EnrolledUserEntity, EnrolledUsersSortFieldType, ListEnrolledUsersOptions } from '../types/user';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import {
  ENROLLED_USERS_SORT_COLUMNS,
  getEnrolledUsersFilterConditions,
  UserJunctionTable,
} from './utils/enrolled-users-query.utils';
import { isEnrollmentActive } from './utils/enrollment.utils';

/**
 * Input for creating a class at the repository layer.
 *
 * Server-managed columns are NOT part of this interface — the repository sets
 * them itself based on class invariants:
 * - `orgPath` is computed by the `trg_classes_compute_org_path_insert` BEFORE
 *   INSERT trigger, which copies the parent school's path. The repository
 *   passes a placeholder ltree to satisfy the NOT NULL column constraint.
 * - `schoolLevels` is a generated column (`generatedAlwaysAs`) — it cannot be
 *   set by INSERT. PostgreSQL computes it from `grades` via the
 *   `app.get_school_levels_from_grades_array` SQL function.
 *
 * The caller is responsible for supplying both `schoolId` and `districtId`;
 * the database-level `validate_class_org_refs` trigger enforces consistency
 * (school must be a child of the supplied district, and the orgType of each
 * must match the column).
 */
export interface CreateClassInput {
  schoolId: string;
  districtId: string;
  name: string;
  classType: ClassType;
  number?: string | undefined;
  period?: string | undefined;
  termId?: string | undefined;
  courseId?: string | undefined;
  subjects?: string[] | undefined;
  grades?: Grade[] | undefined;
  location?: string | undefined;
}

export class ClassRepository extends BaseRepository<Class, typeof classes> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, classes);
  }

  /**
   * Create a new class under a school.
   *
   * Sets server-managed columns according to class invariants:
   * - `orgPath` is initially set to a placeholder ltree value to satisfy the
   *   NOT NULL column constraint at the Drizzle insert layer; the
   *   `trg_classes_compute_org_path_insert` BEFORE INSERT trigger overwrites
   *   it by copying the parent school's `path` (which is itself
   *   `district_<id>.school_<id>`).
   * - `schoolLevels` is intentionally omitted from the insert payload — it's
   *   a generated column computed by PostgreSQL from `grades`.
   *
   * The repository does NOT verify that `schoolId` resolves to an active
   * school — that's the service's responsibility, so the service can return
   * a 422 with a useful context object before the DB attempt. If the parent
   * school does not exist, the path trigger will RAISE; the service should
   * ensure that doesn't happen.
   *
   * @param input - Class fields plus the resolved schoolId and derived districtId
   * @returns The new class id
   */
  async createClass(input: CreateClassInput): Promise<{ id: string }> {
    return this.create({
      data: {
        name: input.name,
        schoolId: input.schoolId,
        districtId: input.districtId,
        classType: input.classType,
        orgPath: 'placeholder',
        ...(input.number !== undefined && { number: input.number }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.termId !== undefined && { termId: input.termId }),
        ...(input.courseId !== undefined && { courseId: input.courseId }),
        ...(input.subjects !== undefined && { subjects: input.subjects }),
        ...(input.grades !== undefined && { grades: input.grades }),
        ...(input.location !== undefined && { location: input.location }),
      },
    });
  }

  /**
   * Get users enrolled in a class.
   *
   * Returns all users who have an active enrollment in the specified class.
   * Only includes users with active enrollments (enrollment_start <= now and
   * enrollment_end is null or >= now).
   *
   * @param classId - The class ID to get users for
   * @param options - Pagination, sorting, and filtering options
   * @returns Paginated result with users
   */
  async getUsersByClassId(
    classId: string,
    options: ListEnrolledUsersOptions,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const whereCondition = and(
      eq(userClasses.classId, classId),
      isEnrollmentActive(userClasses),
      isNull(classes.rosteringEnded),
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_CLASSES),
    );

    const countResult = await this.db
      .select({ count: count() })
      .from(userClasses)
      .innerJoin(users, eq(users.id, userClasses.userId))
      .innerJoin(classes, eq(classes.id, userClasses.classId))
      .where(whereCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field as EnrolledUsersSortFieldType | undefined;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users, role: userClasses.role })
      .from(userClasses)
      .innerJoin(users, eq(users.id, userClasses.userId))
      .innerJoin(classes, eq(classes.id, userClasses.classId))
      .where(whereCondition)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({ ...row.user, roles: [row.role] })),
      totalItems,
    };
  }

  /**
   * List active classes in a school with pagination, sorting, and filtering.
   *
   * Only returns classes where rosteringEnded is null.
   *
   * @param schoolId - The school ID to list classes for
   * @param options - Pagination, sorting, and filtering options
   * @returns Paginated result with classes
   */
  async listBySchoolId(
    schoolId: string,
    options: {
      page: number;
      perPage: number;
      orderBy?: {
        field: SchoolClassSortFieldType;
        direction: 'asc' | 'desc';
      };
      filter?: ParsedFilter[];
    },
  ): Promise<PaginatedResult<Class>> {
    const { page, perPage, orderBy, filter } = options;
    const offset = (page - 1) * perPage;

    // Build where conditions
    const whereConditions: SQL[] = [eq(classes.schoolId, schoolId), isNull(classes.rosteringEnded)];

    // Apply filters if provided
    if (filter && filter.length > 0) {
      for (const f of filter) {
        if (f.field === 'grade' && f.value) {
          // grades is a PostgreSQL array column — use @> (array contains) operator
          whereConditions.push(sql`${classes.grades} @> ARRAY[${f.value}]::app.grade[]`);
        } else if (f.field === 'classType' && f.value) {
          // Filter value is validated by the API contract — safe to cast to the enum type
          whereConditions.push(eq(classes.classType, f.value as ClassType));
        }
      }
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Count query
    const countResult = await this.db.select({ count: count() }).from(classes).where(whereClause);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Resolve sort column
    const SORT_COLUMNS = {
      name: classes.name,
      createdAt: classes.createdAt,
    } as const satisfies Record<SchoolClassSortFieldType, Column>;

    const sortField = orderBy?.field as SchoolClassSortFieldType | undefined;
    const sortColumn =
      sortField && sortField in SORT_COLUMNS ? SORT_COLUMNS[sortField as keyof typeof SORT_COLUMNS] : classes.name;
    const sortDirection = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    // Data query
    const dataResult = await this.db
      .select()
      .from(classes)
      .where(whereClause)
      .orderBy(sortDirection, asc(classes.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult,
      totalItems,
    };
  }
}
