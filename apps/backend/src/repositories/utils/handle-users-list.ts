import { eq, type SQL, Column } from 'drizzle-orm';
import { users, userClasses, type User } from '../../db/schema';
import { ApiError } from '../../errors/api-error';
import { toErrorResponse } from '../../utils/to-error-response.util';
import { StatusCodes } from 'http-status-codes';
import type {
  UsersListSortField,
  UsersListQueryFilters,
  SortQuery,
  PaginationQuery,
  User as ContractUser,
  UserRole,
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

export function handleSubResourceError(error: unknown) {
  if (error instanceof ApiError) {
    return toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
  }
  throw error;
}

export type UserWithRole = User & { userRole: UserRole; enrollmentStart: Date };

/**
 * Maps a database User entity with role to the API contract User schema.
 */
function toContractUser(user: UserWithRole): ContractUser & { enrollmentStart: string } {
  return {
    id: user.id,
    assessmentPid: user.assessmentPid,
    nameFirst: user.nameFirst,
    nameLast: user.nameLast,
    username: user.username,
    email: user.email,
    userRole: user.userRole,
    gender: user.gender,
    grade: user.grade,
    dob: user.dob,
    studentId: user.studentId,
    sisId: user.sisId,
    stateId: user.stateId,
    localId: user.localId,
    enrollmentStart: user.enrollmentStart.toISOString(),
  };
}

/**
 * TODO: Refactor
 * Builds a paginated response for user listing endpoints.
 */
export function handleSubResourceResponse(
  result: { items: UserWithRole[]; totalItems: number },
  page: number,
  perPage: number,
): {
  status: typeof StatusCodes.OK;
  body: {
    data: {
      items: (ContractUser & { enrollmentStart: string })[];
      pagination: { page: number; perPage: number; totalItems: number; totalPages: number };
    };
  };
} {
  const items = result.items.map(toContractUser);
  const totalPages = Math.ceil(result.totalItems / perPage);

  return {
    status: StatusCodes.OK as const,
    body: {
      data: {
        items,
        pagination: {
          page,
          perPage,
          totalItems: result.totalItems,
          totalPages,
        },
      },
    },
  };
}
