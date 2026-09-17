import { StatusCodes } from 'http-status-codes';
import { InvitationCodeRepository } from '../../repositories/invitation-code.repository';
import type { InvitationCode } from '../../db/schema';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';
import type { AuthContext } from '../../types/auth-context';

/**
 * InvitationCodeService
 *
 * Business logic layer for invitation code operations.
 * Handles authorization (super admin only) and delegates to repository.
 */
export function InvitationCodeService({
  invitationCodeRepository = new InvitationCodeRepository(),
}: {
  invitationCodeRepository?: InvitationCodeRepository;
} = {}) {
  /**
   * Get the latest valid invitation code for a group.
   *
   * Authorization:
   * - Super admins can access any group's invitation code
   * - Other users receive 403 Forbidden
   *
   * @param groupId - Group UUID
   * @param authContext - User's auth context (id and super admin flag)
   * @returns The latest valid invitation code
   * @throws {ApiError} 403 if user is not a super admin
   * @throws {ApiError} 404 if no valid invitation code exists
   */
  async function getLatestValidByGroupId(authContext: AuthContext, groupId: string): Promise<InvitationCode> {
    const { userId, isSuperAdmin } = authContext;

    // Only super admins can access invitation codes
    if (!isSuperAdmin) {
      logger.warn({ userId, groupId }, 'Non-super admin attempted to access group invitation code');
      throw new ApiError('Access denied', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, groupId },
      });
    }

    try {
      const invitationCode = await invitationCodeRepository.getLatestValidByGroupId(groupId);

      if (!invitationCode) {
        logger.info({ groupId }, 'No valid invitation code found for group');
        throw new ApiError('No valid invitation code found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { groupId },
        });
      }

      return invitationCode;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, groupId } }, 'Failed to retrieve invitation code');

      throw new ApiError('Failed to retrieve invitation code', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, groupId },
        cause: error,
      });
    }
  }

  return {
    getLatestValidByGroupId,
  };
}

export type IInvitationCodeService = ReturnType<typeof InvitationCodeService>;
