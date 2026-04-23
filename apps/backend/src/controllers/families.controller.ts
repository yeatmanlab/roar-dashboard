import type { EnrolledFamilyUsersQuery } from '@roar-dashboard/api-contract';
import type { AuthContext } from '../types/auth-context';
import { FamilyService } from '../services/family/family.service';
import { handleUserSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';

const familyService = FamilyService();

/**
 * FamiliesController
 *
 * Handles HTTP concerns for the /families endpoints.
 * Calls services for business logic and formats responses.
 */
export const FamiliesController = {
  /**
   * Lists users in a family with pagination and filtering.
   * @param authContext The authentication context.
   * @param familyId The ID of the family.
   * @param query The query parameters for listing users.
   * @returns The list of users in the family.
   */
  listUsers: async (authContext: AuthContext, familyId: string, query: EnrolledFamilyUsersQuery) => {
    try {
      const { page, perPage } = query;

      const result = await familyService.listUsers(authContext, familyId, query);
      return handleUserSubResourceResponse(result, page, perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
