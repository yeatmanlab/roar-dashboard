import { StatusCodes } from 'http-status-codes';
import type { Org } from '../../db/schema';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import { DistrictRepository, type DistrictWithCounts } from '../../repositories/district.repository';
import type { AuthContext } from '../../types/auth-context';
import { rolesForPermission } from '../../constants/role-permissions';
import { Permissions } from '../../constants/permissions';

/**
 * District with optional embedded data.
 */
export interface DistrictWithEmbeds extends DistrictWithCounts {
  children?: Org[];
}

/**
 * Options for getting a district by ID.
 */
export interface GetByIdOptions {
  embedChildren?: boolean;
}

/**
 * DistrictService
 *
 * Provides district-related business logic operations.
 * Follows the factory pattern with dependency injection.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns DistrictService - An object with district service methods.
 */
export function DistrictService({
  districtRepository = new DistrictRepository(),
}: {
  districtRepository?: DistrictRepository;
} = {}) {
  /**
   * Get a district by ID with optional embeds.
   *
   * Enforces access control:
   * - Super admins can access any district
   * - Regular users can only access districts where they have active membership
   *
   * @param id - District UUID
   * @param authContext - Authenticated user context
   * @param options - Optional embeds (children)
   * @returns District with optional embeds
   * @throws ApiError 400 if ID is invalid UUID format
   * @throws ApiError 403 if user lacks access to the district
   * @throws ApiError 404 if district not found or not a district type
   */
  const getById = async (
    id: string,
    authContext: AuthContext,
    options: GetByIdOptions = {},
  ): Promise<DistrictWithEmbeds> => {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      logger.warn(`Invalid UUID format for district ID: ${id}`);
      throw new ApiError('Invalid UUID format', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    }

    // Build access control filter
    const accessControlFilter = {
      userId: authContext.userId,
      allowedRoles: rolesForPermission(Permissions.Organizations.LIST),
    };

    // Fetch district with optional embeds
    const district = await districtRepository.getByIdWithEmbeds(
      id,
      accessControlFilter,
      options.embedChildren ?? false,
    );

    if (!district) {
      // District not found or user lacks access
      // We don't distinguish between these cases for security reasons
      logger.warn(`District not found or access denied: ${id} for user ${authContext.userId}`);
      throw new ApiError('District not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    }

    return district;
  };

  return {
    getById,
  };
}
