import { SQL, inArray, eq, Column } from 'drizzle-orm';
import { EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';
import { users, userClasses } from '../../db/schema';
import { ListEnrolledUsersOptions } from '../../types/user';

export const ENROLLED_USERS_SORT_COLUMNS: Record<EnrolledUsersSortFieldType, Column> = {
  nameLast: users.nameLast,
  username: users.username,
  grade: users.grade,
};

export const getEnrolledUsersFilterConditions = (options: ListEnrolledUsersOptions): SQL[] => {
  if (!options) {
    return [];
  }

  const conditions: SQL[] = [];

  if (options.grade && options.grade.length > 0) {
    conditions.push(inArray(users.grade, options.grade));
  }

  if (options.role) {
    conditions.push(eq(userClasses.role, options.role));
  }

  return conditions;
};
