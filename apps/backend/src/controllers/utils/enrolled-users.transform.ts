import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../errors/api-error';
import type { EnrolledUser, EnrolledUserEntity, EnrolledFamilyUser, EnrolledFamilyUserEntity } from '../../types/user';
import { toErrorResponse } from '../../utils/to-error-response.util';
import { UserFamilyRole } from '../../enums/user-family-role.enum';

/**
 * Maps a database User entity with role to the API contract EnrolledUser schema.
 * Returns select values from User and their associated role(s).
 * User can have multiple roles (e.g., student, teacher, admin) across org hierarchies.
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
 * Maps a database User entity with family role to the API contract EnrolledFamilyUser schema.
 * Returns select values from User and their associated family roles.
 * @param user - The user entity to map.
 * @returns The mapped EnrolledFamilyUser.
 */
function toContractEnrolledFamilyUser(user: EnrolledFamilyUserEntity): EnrolledFamilyUser {
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
export function handleUserSubResourceResponse<T extends EnrolledUserEntity | EnrolledFamilyUserEntity>(
  result: { items: T[]; totalItems: number },
  page: number,
  perPage: number,
): {
  status: typeof StatusCodes.OK;
  body: {
    data: {
      items: T extends EnrolledUserEntity ? EnrolledUser[] : EnrolledFamilyUser[];
      pagination: { page: number; perPage: number; totalItems: number; totalPages: number };
    };
  };
} {
  const items = result.items.map((item) => {
    // Discriminate based on role values: UserFamilyRole only has ['parent', 'child']
    const hasFamilyRole = item.roles.some((role) => role === UserFamilyRole.PARENT || role === UserFamilyRole.CHILD);
    if (hasFamilyRole) {
      return toContractEnrolledFamilyUser(item as EnrolledFamilyUserEntity);
    }
    return toContractEnrolledUser(item as EnrolledUserEntity);
  }) as T extends EnrolledUserEntity ? EnrolledUser[] : EnrolledFamilyUser[];
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
