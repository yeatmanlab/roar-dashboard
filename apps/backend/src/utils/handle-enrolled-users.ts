import { eq, inArray, type SQL, Column } from 'drizzle-orm';
import { users, userClasses, type User } from '../db/schema';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from './to-error-response.util';
import { StatusCodes } from 'http-status-codes';
import type {
  EnrolledUser,
  EnrolledUsersSortFieldType,
  UserRole,
  GradeFilter,
  SortOrder,
} from '@roar-dashboard/api-contract';

export interface ListEnrolledUsersOptions {
  page: number;
  perPage: number;
  orderBy?: { field: EnrolledUsersSortFieldType; direction: SortOrder };
  grade?: GradeFilter;
  role?: UserRole;
}

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

export function handleSubResourceError(error: unknown) {
  if (error instanceof ApiError) {
    return toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
  }
  throw error;
}

export type EnrolledUserEntity = User & { role: UserRole; enrollmentStart: Date };

/**
 * Maps a database User entity with role to the API contract EnrolledUser schema.
 */
function toContractEnrolledUser(user: EnrolledUserEntity): EnrolledUser {
  return {
    id: user.id,
    assessmentPid: user.assessmentPid,
    nameFirst: user.nameFirst,
    nameLast: user.nameLast,
    username: user.username,
    email: user.email,
    role: user.role,
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
 * Builds a paginated response for user listing endpoints.
 */
export function handleSubResourceResponse(
  result: { items: EnrolledUserEntity[]; totalItems: number },
  page: number,
  perPage: number,
): {
  status: typeof StatusCodes.OK;
  body: {
    data: {
      items: EnrolledUser[];
      pagination: { page: number; perPage: number; totalItems: number; totalPages: number };
    };
  };
} {
  const items = result.items.map(toContractEnrolledUser);
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
