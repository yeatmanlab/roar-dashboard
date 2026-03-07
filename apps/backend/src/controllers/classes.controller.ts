import { ClassService } from '../services/class/class.service';
import type { UsersListQuery } from '@roar-dashboard/api-contract';
import type { AuthContext } from '../types/auth-context';
import { handleSubResourceError } from '../repositories/utils/handle-users-list';

const classService = ClassService();

export const ClassesController = {
  listUsers: async (authContext: AuthContext, classId: string, query: UsersListQuery) => {
    try {
      const result = await classService.listUsers(authContext, classId, query);
      return handleSubResourceError(result);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
