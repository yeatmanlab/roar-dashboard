import { StatusCodes } from 'http-status-codes';
import type { AuthContext } from '../../types/auth-context';
import type { FamilyRepository } from '../../repositories/family.repository';
import type { AuthorizationService } from './authorization.service';
import { FgaType, FgaRelation } from './fga-constants';
import { ApiError } from '../../errors/api-error';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

/**
 * Verifies that an authenticated user has permission to act on behalf of a target user.
 *
 * Allows:
 * 1. Super admins (unrestricted access)
 * 2. Same user (requester === target)
 * 3. Users with specific FGA permission on target user's families
 *
 * @param authContext - User's auth context (id and super admin flag)
 * @param targetUserId - The user ID to verify access for
 * @param requiredPermission - The FGA relation to check (e.g., CAN_READ_CHILD, CAN_CREATE_RUN_FOR_CHILD)
 * @param familyRepository - Repository for looking up family relationships
 * @param authorizationService - Service for checking FGA permissions
 * @returns Array of family IDs the target user belongs to (empty for super admin/same user)
 * @throws {ApiError} FORBIDDEN if user lacks permission
 */
export async function verifyTargetUserAccess(
  authContext: AuthContext,
  targetUserId: string,
  requiredPermission: string,
  familyRepository: FamilyRepository,
  authorizationService: ReturnType<typeof AuthorizationService>,
): Promise<string[]> {
  const { userId, isSuperAdmin } = authContext;

  // Super admins have unrestricted access
  if (isSuperAdmin) {
    return [];
  }

  // User can access their own data
  if (userId === targetUserId) {
    return [];
  }

  // Check if user has required permission on any family containing the target user
  const targetFamilyIds = await familyRepository.getFamilyIdsForUser(targetUserId);
  const familyObjects = targetFamilyIds.map((id) => `${FgaType.FAMILY}:${id}`);
  const hasAccess = await authorizationService.hasAnyPermission(
    userId,
    requiredPermission as FgaRelation,
    familyObjects,
  );

  if (!hasAccess) {
    throw new ApiError(ApiErrorMessage.FORBIDDEN, {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
      context: { userId, targetUserId, requiredPermission },
    });
  }

  // Return family IDs so caller can reuse them if needed
  return targetFamilyIds;
}
