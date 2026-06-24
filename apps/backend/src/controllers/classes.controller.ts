import { StatusCodes } from 'http-status-codes';
import type {
  ClassDetail as ApiClass,
  CreateClassRequest,
  EnrolledUsersQuery,
  UpdateClassRequest,
} from '@roar-platform/api-contract';
import type { Class } from '../db/schema';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { CreateClassServiceInput, UpdateClassServiceInput } from '../services/class/class.service';
import { ClassService } from '../services/class/class.service';
import type { AuthContext } from '../types/auth-context';
import { handleUserSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';
import { isPresentString } from './utils/is-present';

const classService = ClassService();

/**
 * Maps a database Class entity to the API schema.
 *
 * Renames nothing — the surfaced column names already match the API fields —
 * but converts the `rosteringEnded` Date to an ISO string and drops fields that
 * are absent. `courseId`, `number`, `period`, `location`, and `rosteringEnded`
 * are nullable columns omitted when null; `subjects`, `grades`, and the
 * generated `schoolLevels` arrays are included only when populated. `location`
 * is a single free-text column (a room/location label), not an assembled
 * address object, so it passes through as a string. `orgPath`, `termId`, and
 * the timestamps columns are intentionally not surfaced.
 */
function transformClass(classEntity: Class): ApiClass {
  return {
    id: classEntity.id,
    name: classEntity.name,
    schoolId: classEntity.schoolId,
    districtId: classEntity.districtId,
    classType: classEntity.classType,
    // String columns: null and empty-string are treated as absent (see `isPresentString`).
    ...(isPresentString(classEntity.courseId) && { courseId: classEntity.courseId }),
    ...(isPresentString(classEntity.number) && { number: classEntity.number }),
    ...(isPresentString(classEntity.period) && { period: classEntity.period }),
    // Array columns: a populated array is kept; an empty array is valid and not dropped here.
    ...(classEntity.subjects && { subjects: classEntity.subjects }),
    ...(classEntity.grades && { grades: classEntity.grades }),
    ...(classEntity.schoolLevels && { schoolLevels: classEntity.schoolLevels }),
    ...(isPresentString(classEntity.location) && { location: classEntity.location }),
    ...(classEntity.rosteringEnded && { rosteringEnded: classEntity.rosteringEnded.toISOString() }),
  };
}

export const ClassesController = {
  /**
   * Create a new class under an existing school.
   *
   * Restricted to super admins (enforced in ClassService). Returns the new
   * class id only.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param body - Request body with schoolId and class fields
   */
  create: async (authContext: AuthContext, body: CreateClassRequest) => {
    try {
      const serviceInput: CreateClassServiceInput = {
        schoolId: body.schoolId,
        name: body.name,
        classType: body.classType,
        number: body.number,
        period: body.period,
        termId: body.termId,
        courseId: body.courseId,
        subjects: body.subjects,
        grades: body.grades,
        location: body.location,
      };

      const { id } = await classService.create(authContext, serviceInput);

      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: { id },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.FORBIDDEN,
          StatusCodes.UNPROCESSABLE_ENTITY,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Get a single class by ID.
   *
   * Delegates to ClassService for authorization and retrieval.
   *
   * @param authContext - User's authentication context
   * @param classId - UUID of the class to retrieve
   */
  get: async (authContext: AuthContext, classId: string) => {
    try {
      const classEntity = await classService.getById(authContext, classId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformClass(classEntity),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Update a class.
   *
   * Restricted to super admins (enforced in ClassService). Returns the updated
   * class id only.
   *
   * @param authContext - User's authentication context
   * @param classId - UUID of the class to update
   * @param body - Request body with the mutable class fields
   */
  update: async (authContext: AuthContext, classId: string, body: UpdateClassRequest) => {
    try {
      const serviceInput: UpdateClassServiceInput = {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.classType !== undefined && { classType: body.classType }),
        ...(body.subjects !== undefined && { subjects: body.subjects }),
        ...(body.grades !== undefined && { grades: body.grades }),
        ...(body.location !== undefined && { location: body.location }),
      };

      const { id } = await classService.update(authContext, classId, serviceInput);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: { id },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Lists users in a class with pagination and filtering.
   * @param authContext The authentication context.
   * @param classId The ID of the class.
   * @param query The query parameters for listing users.
   * @returns The list of users in the class.
   */
  listUsers: async (authContext: AuthContext, classId: string, query: EnrolledUsersQuery) => {
    try {
      const result = await classService.listUsers(authContext, classId, query);
      return handleUserSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
