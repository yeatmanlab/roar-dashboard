import { SQL, inArray, eq, Column } from 'drizzle-orm';
import type { EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';
import { users, userClasses, userGroups, userOrgs, userFamilies } from '../../db/schema';
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

  if (grade?.length) {
    conditions.push(inArray(users.grade, grade));
  }

  if (role) {
    conditions.push(eq(TABLE_MAP[junctionTable].role, role));
  }

  return conditions;
};
