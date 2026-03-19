import { SQL, inArray, eq, Column } from 'drizzle-orm';
import type { EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';
import { users, userClasses, userGroups, userOrgs } from '../../db/schema';
import type { ListEnrolledUsersOptions } from '../../types/user';

export const ENROLLED_USERS_SORT_COLUMNS: Record<EnrolledUsersSortFieldType, Column> = {
  nameLast: users.nameLast,
  username: users.username,
  grade: users.grade,
};

type UserJunctionTable = 'userGroups' | 'userClasses' | 'userOrgs';

const tableMap: Record<UserJunctionTable, typeof userGroups | typeof userClasses | typeof userOrgs> = {
  userGroups: userGroups,
  userClasses: userClasses,
  userOrgs: userOrgs,
} as const;

export const getEnrolledUsersFilterConditions = (
  options: ListEnrolledUsersOptions,
  junctionTable: UserJunctionTable,
): SQL[] => {
  const { grade, role } = options;
  const conditions: SQL[] = [];

  if (grade?.length) {
    conditions.push(inArray(users.grade, grade));
  }

  if (role) {
    conditions.push(eq(tableMap[junctionTable].role, role));
  }

  return conditions;
};
