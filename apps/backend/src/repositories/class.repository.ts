import { eq, asc, desc, count, and, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import { ClassAccessControls } from './access-controls/class.access-controls';
import { OrgAccessControls } from './access-controls/org.access-controls';
import {
  getEnrolledUsersFilterConditions,
  ENROLLED_USERS_SORT_COLUMNS,
  UserJunctionTable,
} from './utils/enrolled-users-query.utils';
import { isEnrollmentActive } from './utils/enrollment.utils';
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { Class } from '../db/schema';
import { classes, userClasses, users } from '../db/schema';
import type { UserRole } from '../enums/user-role.enum';
import type { ListEnrolledUsersOptions, EnrolledUserEntity } from '../types/user';

export class ClassRepository extends BaseRepository<Class, typeof classes> {
  private readonly classAccessControls: ClassAccessControls;
  private readonly orgAccessControls: OrgAccessControls;

  constructor(
    db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient,
    classAccessControls: ClassAccessControls = new ClassAccessControls(db),
    orgAccessControls: OrgAccessControls = new OrgAccessControls(db),
  ) {
    super(db, classes);
    this.classAccessControls = classAccessControls;
    this.orgAccessControls = orgAccessControls;
  }

  /**
   * Get a single class by ID, only if the user is authorized to access it and rosteringEnded is null.
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param classId - The class ID to retrieve
   * @returns The class if found and accessible, null otherwise
   */
  async getAuthorizedById(accessControlFilter: AccessControlFilter, classId: string): Promise<Class | null> {
    const accessibleClasses = this.orgAccessControls
      .buildUserAccessibleOrgIdsQuery(accessControlFilter)
      .as('accessible_classes');

    const result = await this.db
      .select({ class: classes })
      .from(classes)
      .innerJoin(accessibleClasses, eq(classes.schoolId, accessibleClasses.orgId))
      .where(and(eq(classes.id, classId), isNull(classes.rosteringEnded)))
      .limit(1);

    return result[0]?.class ?? null;
  }

  /**
   * Get the distinct roles a user holds for a specific class.
   *
   * Queries both direct class memberships and org memberships in ancestor
   * orgs to determine all roles the user has that grant access to this class.
   *
   * @param userId - The user ID to query roles for
   * @param classId - The class ID to check access for
   * @returns Array of distinct roles the user has for the class
   */
  async getUserRolesForClass(userId: string, classId: string): Promise<UserRole[]> {
    return this.classAccessControls.getUserRolesForClass(userId, classId);
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
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_CLASSES),
    );

    const countResult = await this.db
      .select({ count: count() })
      .from(userClasses)
      .innerJoin(users, eq(users.id, userClasses.userId))
      .where(whereCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field as EnrolledUsersSortFieldType | undefined;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users, enrollmentStart: userClasses.enrollmentStart, role: userClasses.role })
      .from(userClasses)
      .innerJoin(users, eq(users.id, userClasses.userId))
      .where(whereCondition)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({ ...row.user, enrollmentStart: row.enrollmentStart, role: row.role })),
      totalItems,
    };
  }

  /**
   * Get users enrolled in a class if class is found in the user's accessible orgs.
   *
   * Returns all users who have an active enrollment in the specified class.
   * Only includes users with active enrollments (enrollment_start <= now and
   * enrollment_end is null or >= now).
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param classId - The class ID to get users for
   * @param options - Pagination and sorting options
   * @returns Paginated result with users
   */
  async getAuthorizedUsersByClassId(
    accessControlFilter: AccessControlFilter,
    classId: string,
    options: ListEnrolledUsersOptions,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const accessibleClasses = this.orgAccessControls
      .buildUserAccessibleOrgIdsQuery(accessControlFilter)
      .as('accessible_classes');
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
      .innerJoin(accessibleClasses, eq(accessibleClasses.orgId, classes.schoolId))
      .where(whereCondition);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field as EnrolledUsersSortFieldType | undefined;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users, enrollmentStart: userClasses.enrollmentStart, role: userClasses.role })
      .from(userClasses)
      .innerJoin(users, eq(users.id, userClasses.userId))
      .innerJoin(classes, eq(classes.id, userClasses.classId))
      .innerJoin(accessibleClasses, eq(accessibleClasses.orgId, classes.schoolId))
      .where(whereCondition)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({ ...row.user, enrollmentStart: row.enrollmentStart, role: row.role })),
      totalItems,
    };
  }
}
