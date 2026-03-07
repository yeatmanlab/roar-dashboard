import { eq, asc, desc, count, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { classes, userClasses, users, type Class, type User } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository, type PaginatedResult } from './base.repository';
import { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import { ClassAccessControls } from './access-controls/class.access-controls';
import { OrgAccessControls } from './access-controls/org.access-controls';
import { isEnrollmentActive } from './utils/enrollment.utils';
import type { UsersListSortField } from '@roar-dashboard/api-contract';
import type { UserRole } from '../enums/user-role.enum';
import { ListUsersOptions, getUsersListFilterConditions, USERS_LIST_SORT_COLUMNS } from './utils/handle-users-list';

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
   * Get a single class by ID, only if the user is authorized to access it.
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
      .where(eq(classes.id, classId))
      .limit(1);

    return result[0]?.class ?? null;
  }

  /**
   * User in service to check if has supervisory role
   * @param userId
   * @param classId
   * @returns
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
  async getUsersByClassId(classId: string, options: ListUsersOptions): Promise<PaginatedResult<User>> {
    const { page, perPage, orderBy, filters } = options;
    const offset = (page - 1) * perPage;

    const whereCondition = and(
      eq(userClasses.classId, classId),
      isEnrollmentActive(userClasses),
      ...getUsersListFilterConditions(filters),
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

    const sortField = orderBy?.field as UsersListSortField | undefined;
    const sortColumn = sortField ? USERS_LIST_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === 'desc' ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users })
      .from(userClasses)
      .innerJoin(users, eq(users.id, userClasses.userId))
      .where(whereCondition)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => row.user),
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
    options: ListUsersOptions,
  ): Promise<PaginatedResult<User>> {
    const accessibleClasses = this.orgAccessControls
      .buildUserAccessibleOrgIdsQuery(accessControlFilter)
      .as('accessible_classes');
    const { page, perPage, orderBy, filters } = options;
    const offset = (page - 1) * perPage;

    const whereCondition = and(
      eq(userClasses.classId, classId),
      isEnrollmentActive(userClasses),
      ...getUsersListFilterConditions(filters),
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

    const sortField = orderBy?.field as UsersListSortField | undefined;
    const sortColumn = sortField ? USERS_LIST_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === 'desc' ? desc(sortColumn) : asc(sortColumn);

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
      items: dataResult.map((row) => row.user),
      totalItems,
    };
  }
}
