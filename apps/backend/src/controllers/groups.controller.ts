import { StatusCodes } from 'http-status-codes';
import { InvitationCodeService } from '../services/invitation-code/invitation-code.service';
import type { InvitationCode as ApiInvitationCode } from '@roar-dashboard/api-contract';
import type { InvitationCode } from '../db/schema';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';

const invitationCodeService = InvitationCodeService();

/**
 * Auth context passed from middleware.
 */
interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

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
   * Get the latest valid invitation code for a group.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param groupId - Group UUID
   * @returns Invitation code transformed to API response format
   */
  getInvitationCode: async (authContext: AuthContext, groupId: string) => {
    try {
      const invitationCode = await invitationCodeService.getLatestValidByGroupId(groupId, authContext);

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
};
