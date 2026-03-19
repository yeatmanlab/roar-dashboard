import { SQL, inArray, eq, Column } from 'drizzle-orm';
import type { EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';
import { users, userClasses } from '../../db/schema';
import type { ListEnrolledUsersOptions } from '../../types/user';

export const ENROLLED_USERS_SORT_COLUMNS: Record<EnrolledUsersSortFieldType, Column> = {
  nameLast: users.nameLast,
  username: users.username,
  grade: users.grade,
};

export const getEnrolledUsersFilterConditions = (options: ListEnrolledUsersOptions): SQL[] => {
  const { grade, role } = options;
  const conditions: SQL[] = [];

  if (grade?.length) {
    conditions.push(inArray(users.grade, grade));
  }

  if (role) {
    conditions.push(eq(userClasses.role, role));
  }

  return conditions;
};
