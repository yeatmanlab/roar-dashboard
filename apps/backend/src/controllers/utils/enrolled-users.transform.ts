import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import type { EnrolledUser, EnrolledUserEntity } from '../../types/user';
import { toErrorResponse } from '../../utils/to-error-response.util';

/**
 * Maps a database User entity with role to the API contract EnrolledUser schema.
 * Returns select values from User and their associated role and enrollment start date
 * in organization context.
 * @param user - The user entity to map.
 * @returns The mapped EnrolledUser.
 */
function toContractEnrolledUser(user: EnrolledUserEntity): EnrolledUser {
  return {
    id: user.id,
    assessmentPid: user.assessmentPid,
    nameFirst: user.nameFirst,
    nameLast: user.nameLast,
    username: user.username,
    email: user.email,
    roles: user.roles,
    gender: user.gender,
    grade: user.grade,
    dob: user.dob,
    studentId: user.studentId,
    sisId: user.sisId,
    stateId: user.stateId,
    localId: user.localId,
  };
}

/**
 * Builds a paginated response for user listing endpoints.
 * @param result - The result from the database query.
 * @param page - The current page number.
 * @param perPage - The number of items per page.
 * @returns The paginated response.
 */
export function handleUserSubResourceResponse(
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
  const items = result.items.map((item) => toContractEnrolledUser(item)) as EnrolledUser[];
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

/**
 * Handles errors for sub-resource endpoints.
 * @param error - The error to handle.
 * @returns The error response.
 */
export function handleSubResourceError(error: unknown) {
  if (error instanceof ApiError) {
    return toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
  }
  throw error;
}
