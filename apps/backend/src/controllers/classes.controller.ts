import { StatusCodes } from 'http-status-codes';
import { ClassService } from '../services/class/class.service';
import type { UsersListQuery } from '@roar-dashboard/api-contract';
import type { AuthContext } from '../types/auth-context';

const classService = ClassService();

/**
 * TODO:
 * - handleSubResourceResponse - administration
 *   - extract to separate reusable function for other users endpoints?
 */
export const ClassesController = {
  listUsers: async (authContext: AuthContext, classId: string, query: UsersListQuery) => {
    try {
      const result = await classService.listUsers(authContext, classId, query);
      return {
        statusCode: StatusCodes.OK,
        body: result,
      };
    } catch (error) {
      return {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        body: {
          error,
        },
      };
    }
  },
};
