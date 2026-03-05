import { StatusCodes } from 'http-status-codes';
import { ClassService } from '../services/class/class.service';
import type { UsersListQuery } from '@roar-dashboard/api-contract';
import type { AuthContext } from '../types/auth-context';

const classService = ClassService();

/**
 * TODO:
 * - handleSubResourceResponse - extract to separate reusable function for other endpoints?
 * - What fields to return, sort
 * - classId in items? { classId: string, users: User[]} - for other endpoints {schoolId: string} etc?
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
