import { SQL, inArray, eq, Column } from 'drizzle-orm';
import type { EnrolledUsersSortFieldType } from '@roar-platform/api-contract';
import { users, userClasses, userGroups, userOrgs, userFamilies } from '../../db/schema';
import { isActiveRoster } from './enrollment.utils';
import type { ListEnrolledUsersOptions, ListEnrolledFamilyUsersOptions } from '../../types/user';

export const ENROLLED_USERS_SORT_COLUMNS: Record<EnrolledUsersSortFieldType, Column> = {
  nameLast: users.nameLast,
  username: users.username,
  grade: users.grade,
};

export enum UserJunctionTable {
  USER_GROUPS = 'userGroups',
  USER_CLASSES = 'userClasses',
  USER_ORGS = 'userOrgs',
  USER_FAMILIES = 'userFamilies',
}

/** Map of junction table types to their corresponding table schemas */
const TABLE_MAP = {
  [UserJunctionTable.USER_GROUPS]: userGroups,
  [UserJunctionTable.USER_CLASSES]: userClasses,
  [UserJunctionTable.USER_ORGS]: userOrgs,
  [UserJunctionTable.USER_FAMILIES]: userFamilies,
} as const;

export const getEnrolledUsersFilterConditions = (
  options: ListEnrolledUsersOptions | ListEnrolledFamilyUsersOptions,
  junctionTable: UserJunctionTable,
): SQL[] => {
  const { grade, role } = options;
  const conditions: SQL[] = [];

  // Always exclude rostering-ended users (#1742). Applied at the query
  // composition layer so every consumer of `getEnrolledUsersFilterConditions`
  // — district, school, class, group, family user-list endpoints — gets
  // the same hard boundary. There is no opt-in flag to include them.
  conditions.push(isActiveRoster(users));

  if (grade?.length) {
    conditions.push(inArray(users.grade, grade));
  }

  if (role) {
    conditions.push(eq(TABLE_MAP[junctionTable].role, role));
  }

  return conditions;
};
