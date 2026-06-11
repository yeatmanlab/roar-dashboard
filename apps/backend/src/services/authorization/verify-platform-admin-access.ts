import { StatusCodes } from 'http-status-codes';
import type { AuthContext } from '../../types/auth-context';
import type { UserRepository } from '../../repositories/user.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { logger } from '../../logger';

/**
 * Verifies that the caller is a super admin or an active platform administrator.
 *
 * Used by global catalog read endpoints (task variants, task bundles) that are not
 * scoped to an org entity, so there is no per-entity FGA object to check a permission
 * against. Platform admin status is resolved from the caller's active `platform_admin`
 * org/group memberships via `UserRepository.hasPlatformAdminRole`.
 *
 * Allows:
 * 1. Super admins (unrestricted access, no role lookup performed)
 * 2. Users with an active `platform_admin` role on any org or group
 *
 * @param authContext - Caller's auth context ({ userId, isSuperAdmin })
 * @param userRepository - Repository used to look up the caller's platform admin role
 * @param action - Short action identifier for structured logging (e.g., 'task-variants.list')
 * @returns Resolves when access is granted
 * @throws {ApiError} FORBIDDEN if the caller is neither a super admin nor a platform admin
 */
export async function verifyPlatformAdminAccess(
  authContext: AuthContext,
  userRepository: UserRepository,
  action: string,
): Promise<void> {
  const { userId, isSuperAdmin } = authContext;

  // Super admins bypass the role lookup — checked first in every authorization flow
  if (isSuperAdmin) return;

  const isPlatformAdmin = await userRepository.hasPlatformAdminRole(userId);

  if (!isPlatformAdmin) {
    logger.warn({ userId, action }, 'Caller without super admin or platform admin role denied access');
    throw new ApiError(ApiErrorMessage.FORBIDDEN, {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
      context: { userId, action },
    });
  }
}
