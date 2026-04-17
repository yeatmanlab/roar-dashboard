import { eq, and, isNull, count, asc, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type { Family } from '../db/schema';
import { families, userFamilies, users } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { EnrolledFamilyUserEntity, ListEnrolledFamilyUsersOptions } from '../types/user';
import {
  getEnrolledUsersFilterConditions,
  ENROLLED_USERS_SORT_COLUMNS,
  UserJunctionTable,
} from './utils/enrolled-users-query.utils';
import { isEnrollmentActive } from './utils/enrollment.utils';
/**
 * Family Repository
 *
 * Handles data access for families.
 * Provides both unrestricted access (for super admins) and FGA-filtered access
 * (for regular users based on their FGA object membership).
 */
export class FamilyRepository extends BaseRepository<Family, typeof families> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, families);
  }

  async getUsersByFamilyId(
    familyId: string,
    options: ListEnrolledFamilyUsersOptions,
  ): Promise<PaginatedResult<EnrolledFamilyUserEntity>> {
    const { page, perPage, orderBy } = options;
    const offset = (page - 1) * perPage;

    const familyConditions = and(
      isEnrollmentActive({ enrollmentStart: userFamilies.joinedOn, enrollmentEnd: userFamilies.leftOn }),
      isNull(families.rosteringEnded),
      eq(userFamilies.familyId, familyId),
      ...getEnrolledUsersFilterConditions(options, UserJunctionTable.USER_FAMILIES),
    );

    const countResult = await this.db
      .select({ count: count() })
      .from(userFamilies)
      .innerJoin(users, eq(users.id, userFamilies.userId))
      .innerJoin(families, eq(families.id, userFamilies.familyId))
      .where(familyConditions);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortField = orderBy?.field as EnrolledUsersSortFieldType | undefined;
    const sortColumn = sortField ? ENROLLED_USERS_SORT_COLUMNS[sortField] : users.nameLast;
    const primaryOrder = orderBy?.direction === SortOrder.DESC ? desc(sortColumn) : asc(sortColumn);

    const dataResult = await this.db
      .select({ user: users, role: userFamilies.role })
      .from(userFamilies)
      .innerJoin(users, eq(users.id, userFamilies.userId))
      .innerJoin(families, eq(families.id, userFamilies.familyId))
      .where(familyConditions)
      .orderBy(primaryOrder, asc(users.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult.map((row) => ({ ...row.user, roles: [row.role] })),
      totalItems,
    };
  }
}
