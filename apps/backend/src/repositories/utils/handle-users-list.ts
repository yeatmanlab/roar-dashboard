import { eq, type SQL, Column } from 'drizzle-orm';
import { users, userClasses } from '../../db/schema';
import type {
  UsersListSortField,
  UsersListQueryFilters,
  SortQuery,
  PaginationQuery,
} from '@roar-dashboard/api-contract';

export interface ListUsersOptions {
  page: number;
  perPage: number;
  orderBy?: { field: UsersListSortField; direction: 'asc' | 'desc' };
  filters?: UsersListQueryFilters;
}

export const USERS_LIST_SORT_COLUMNS: Record<UsersListSortField, Column> = {
  nameLast: users.nameLast,
  username: users.username,
  grade: users.grade,
};

export type UsersListQueryOptions = PaginationQuery &
  SortQuery<UsersListSortField> & { filters?: UsersListQueryFilters };

export const getUsersListFilterConditions = (filters: UsersListQueryFilters): SQL[] => {
  if (!filters) {
    return [];
  }

  const conditions: SQL[] = [];
  if (filters.grade) {
    conditions.push(eq(users.grade, filters.grade));
  }

  if (filters.role) {
    conditions.push(eq(userClasses.role, filters.role));
  }
  return conditions;
};
