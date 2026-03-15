import type { EnrolledUsersQuery } from '@roar-dashboard/api-contract';
import { ClassService } from '../services/class/class.service';
import type { AuthContext } from '../types/auth-context';
import { handleSubResourceResponse, handleSubResourceError } from '../utils/handle-enrolled-users';

const classService = ClassService();

export const ClassesController = {
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
      return handleSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
