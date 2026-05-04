import { StatusCodes } from 'http-status-codes';
import { InvitationCodeService } from '../services/invitation-code/invitation-code.service';
import type {
  CreateGroupRequest,
  InvitationCode as ApiInvitationCode,
  EnrolledUsersQuery,
} from '@roar-dashboard/api-contract';
import type { InvitationCode } from '../db/schema';
import type { CreateGroupServiceInput } from '../services/group/group.service';
import { GroupService } from '../services/group/group.service';
import type { AuthContext } from '../types/auth-context';
import { ApiError } from '../errors/api-error';
import { handleUserSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';
import { toErrorResponse } from '../utils/to-error-response.util';

const invitationCodeService = InvitationCodeService();
const groupService = GroupService();

/**
 * Maps a database InvitationCode entity to the API schema.
 * Converts Date fields to ISO strings.
 */
function transformInvitationCode(invitationCode: InvitationCode): ApiInvitationCode {
  return {
    id: invitationCode.id,
    groupId: invitationCode.groupId,
    code: invitationCode.code,
    validFrom: invitationCode.validFrom.toISOString(),
    validTo: invitationCode.validTo?.toISOString() ?? null,
    dates: {
      created: invitationCode.createdAt.toISOString(),
      updated: invitationCode.updatedAt?.toISOString() ?? invitationCode.createdAt.toISOString(),
    },
  };
}

/**
 * GroupsController
 *
 * Handles HTTP concerns for the /groups endpoints.
 * Calls services for business logic and formats responses.
 */
export const GroupsController = {
  /**
   * Create a new group.
   *
   * Restricted to super admins (enforced in GroupService). Returns the new
   * group id only.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param body - Request body with group fields
   */
  create: async (authContext: AuthContext, body: CreateGroupRequest) => {
    try {
      const serviceInput: CreateGroupServiceInput = {
        name: body.name,
        abbreviation: body.abbreviation,
        groupType: body.groupType,
        location: body.location,
      };

      const { id } = await groupService.create(authContext, serviceInput);

      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: { id },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * Get the latest valid invitation code for a group.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param groupId - Group UUID
   * @returns Invitation code transformed to API response format
   */
  getInvitationCode: async (authContext: AuthContext, groupId: string) => {
    try {
      const invitationCode = await invitationCodeService.getLatestValidByGroupId(authContext, groupId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformInvitationCode(invitationCode),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Lists users in a group with pagination and filtering.
   * @param authContext The authentication context.
   * @param groupId The ID of the group.
   * @param query The query parameters for listing users.
   * @returns The list of users in the group.
   */
  listUsers: async (authContext: AuthContext, groupId: string, query: EnrolledUsersQuery) => {
    try {
      const result = await groupService.listUsers(authContext, groupId, query);
      return handleUserSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
