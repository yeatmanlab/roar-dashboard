import { StatusCodes } from 'http-status-codes';
import type { CreateClassRequest, EnrolledUsersQuery } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { CreateClassServiceInput } from '../services/class/class.service';
import { ClassService } from '../services/class/class.service';
import type { AuthContext } from '../types/auth-context';
import { handleUserSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';

const classService = ClassService();

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
