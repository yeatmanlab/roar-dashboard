import {
  AdministrationEmbedOption,
  AdministrationSortField,
  DistrictSortField,
  type PaginatedResult,
  type AdministrationStats,
  type ADMINISTRATION_EMBED_OPTIONS,
  type AdministrationStatus,
  type DISTRICT_SORT_FIELDS,
} from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import type { Administration, Org } from '../../db/schema';
import { Permissions } from '../../constants/permissions';
import { rolesForPermission } from '../../constants/role-permissions';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import {
  AdministrationRepository,
  type AdministrationQueryOptions,
  type AdministrationSortField as AdministrationSortFieldType,
} from '../../repositories/administration.repository';
import {
  AdministrationTaskVariantRepository,
  type AdministrationTask,
} from '../../repositories/administration-task-variant.repository';
import { RunsRepository } from '../../repositories/runs.repository';
import type { AuthContext } from '../../types/auth-context';

/**
 * Embed option type derived from api-contract.
 */
type AdministrationEmbedOptionType = (typeof ADMINISTRATION_EMBED_OPTIONS)[number];

/**
 * Administration with optional embedded data.
 */
export interface AdministrationWithEmbeds extends Administration {
  stats?: AdministrationStats;
  tasks?: AdministrationTask[];
}

/**
 * Maps API sort field names to database column names.
 */
const SORT_FIELD_TO_COLUMN: Record<AdministrationSortFieldType, string> = {
  [AdministrationSortField.NAME]: 'name',
  [AdministrationSortField.CREATED_AT]: 'createdAt',
  [AdministrationSortField.DATE_START]: 'dateStart',
  [AdministrationSortField.DATE_END]: 'dateEnd',
};

/**
 * Options for listing administrations including embed and status filter.
 */
export interface ListOptions extends AdministrationQueryOptions {
  embed?: AdministrationEmbedOptionType[];
  status?: AdministrationStatus;
}

/**
 * Sort field type for districts.
 */
type DistrictSortFieldType = (typeof DISTRICT_SORT_FIELDS)[number];

/**
 * Maps API sort field names to database column names for districts.
 */
const DISTRICT_SORT_FIELD_TO_COLUMN: Record<DistrictSortFieldType, string> = {
  [DistrictSortField.NAME]: 'name',
};

/**
 * Options for listing districts of an administration.
 */
export interface ListDistrictsOptions {
  page: number;
  perPage: number;
  sortBy: DistrictSortFieldType;
  sortOrder: 'asc' | 'desc';
}

/**
 * AdministrationService
 *
 * Provides administration-related business logic operations.
 * Follows the factory pattern with dependency injection.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns AdministrationService - An object with administration service methods.
 */
export function AdministrationService({
  administrationRepository = new AdministrationRepository(),
  administrationTaskVariantRepository = new AdministrationTaskVariantRepository(),
  runsRepository = new RunsRepository(),
}: {
  administrationRepository?: AdministrationRepository;
  administrationTaskVariantRepository?: AdministrationTaskVariantRepository;
  runsRepository?: RunsRepository;
} = {}) {
  /**
   * Verify that an administration exists and the user has access to it.
   *
   * Performs a two-step check:
   * 1. Verify the administration exists (returns 404 if not)
   * 2. Verify the user has access (returns 403 if not, skipped for super admins)
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param administrationId - The administration ID to verify access for
   * @returns The administration if found and accessible
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access
   */
  async function verifyAdministrationAccess(
    authContext: AuthContext,
    administrationId: string,
  ): Promise<Administration> {
    const { userId, isSuperAdmin } = authContext;

    // Look up the administration first (unrestricted) to distinguish 404 from 403
    const administration = await administrationRepository.getById({ id: administrationId });

    if (!administration) {
      throw new ApiError('Administration not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, administrationId },
      });
    }

    // Super admins have unrestricted access
    if (isSuperAdmin) {
      return administration;
    }

    // Check access for non-super admin users
    const allowedRoles = rolesForPermission(Permissions.Administrations.READ);
    const authorized = await administrationRepository.getAuthorized({ userId, allowedRoles }, administrationId);

    if (!authorized) {
      throw new ApiError('You do not have permission to access this administration', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, administrationId },
      });
    }

    return authorized;
  }

  /**
   * Fetch stats for administrations (assigned counts and run stats).
   * Queries run in parallel.
   *
   * @param administrationIds - IDs of administrations to fetch stats for
   * @param userId - User ID for error context
   * @returns Map of administration ID to stats
   * @throws {ApiError} If either query fails
   */
  async function fetchStatsEmbed(
    administrationIds: string[],
    userId: string,
  ): Promise<Map<string, AdministrationStats>> {
    const [assignedCounts, runStats] = await Promise.all([
      administrationRepository.getAssignedUserCountsByAdministrationIds(administrationIds).catch((err) => {
        throw new ApiError('Failed to fetch administration stats', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, administrationIds, embed: 'stats' },
          cause: err,
        });
      }),
      runsRepository.getRunStatsByAdministrationIds(administrationIds).catch((err) => {
        throw new ApiError('Failed to fetch administration stats', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, administrationIds, embed: 'stats' },
          cause: err,
        });
      }),
    ]);

    const statsMap = new Map<string, AdministrationStats>();
    for (const adminId of administrationIds) {
      statsMap.set(adminId, {
        assigned: assignedCounts.get(adminId) ?? 0,
        started: runStats.get(adminId)?.started ?? 0,
        completed: runStats.get(adminId)?.completed ?? 0,
      });
    }
    return statsMap;
  }

  /**
   * Fetch tasks for administrations.
   *
   * @param administrationIds - IDs of administrations to fetch tasks for
   * @param userId - User ID for error context
   * @returns Map of administration ID to tasks array
   * @throws {ApiError} If query fails
   */
  async function fetchTasksEmbed(
    administrationIds: string[],
    userId: string,
  ): Promise<Map<string, AdministrationTask[]>> {
    try {
      return await administrationTaskVariantRepository.getByAdministrationIds(administrationIds);
    } catch (err) {
      throw new ApiError('Failed to fetch administration tasks', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationIds, embed: 'tasks' },
        cause: err,
      });
    }
  }

  /**
   * List administrations accessible to a user with pagination, sorting, and optional embeds.
   *
   * super_admin users have unrestricted access to all administrations.
   * Other users only see administrations they're assigned to via org/class/group membership.
   *
   * **Embed restrictions:**
   * - `stats`: Only returned for super_admin users (expensive query, sensitive data).
   *   Non-super-admins requesting stats will receive results without stats silently.
   * - `tasks`: Available to all users.
   *
   * @param authContext - User's auth context (id and type)
   * @param options - Query options including pagination, sorting, and embed
   * @returns Paginated result with administrations (optionally with embedded stats/tasks)
   * @throws {ApiError} If the database query fails.
   */
  async function list(
    authContext: AuthContext,
    options: ListOptions,
  ): Promise<PaginatedResult<AdministrationWithEmbeds>> {
    const { userId, isSuperAdmin } = authContext;

    let result;

    try {
      // Transform API contract format to repository format
      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: SORT_FIELD_TO_COLUMN[options.sortBy],
          direction: options.sortOrder,
        },
        ...(options.status && { status: options.status }),
      };

      // Fetch administrations based on user role and authorization
      if (isSuperAdmin) {
        result = await administrationRepository.listAll(queryParams);
      } else {
        const allowedRoles = rolesForPermission(Permissions.Administrations.LIST);
        result = await administrationRepository.listAuthorized({ userId, allowedRoles }, queryParams);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to list administrations');

      throw new ApiError('Failed to retrieve administrations', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }

    // If no embeds requested, return as-is
    const embedOptions = options.embed ?? [];
    if (embedOptions.length === 0) {
      return result;
    }

    // Early return if no items to embed data onto
    if (result.items.length === 0) {
      return result;
    }

    const administrationIds = result.items.map((admin) => admin.id);
    const shouldEmbedStats = isSuperAdmin && embedOptions.includes(AdministrationEmbedOption.STATS);
    const shouldEmbedTasks = embedOptions.includes(AdministrationEmbedOption.TASKS);

    // Fetch embed data (throws on failure)
    const statsMap = shouldEmbedStats ? await fetchStatsEmbed(administrationIds, userId) : null;
    const tasksMap = shouldEmbedTasks ? await fetchTasksEmbed(administrationIds, userId) : null;

    // Attach embeds to each administration
    const itemsWithEmbeds: AdministrationWithEmbeds[] = result.items.map((admin) => {
      const adminWithEmbeds: AdministrationWithEmbeds = { ...admin };

      if (statsMap) {
        adminWithEmbeds.stats = statsMap.get(admin.id) ?? { assigned: 0, started: 0, completed: 0 };
      }

      if (tasksMap) {
        adminWithEmbeds.tasks = tasksMap.get(admin.id) ?? [];
      }

      return adminWithEmbeds;
    });

    return {
      items: itemsWithEmbeds,
      totalItems: result.totalItems,
    };
  }

  /**
   * Get a single administration by ID with access control.
   *
   * Super admin users can access any administration.
   * Other users can only access administrations they're assigned to via org/class/group membership.
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to retrieve
   * @returns The administration if found and accessible
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function getById(authContext: AuthContext, administrationId: string): Promise<Administration> {
    const { userId } = authContext;

    try {
      return await verifyAdministrationAccess(authContext, administrationId);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, administrationId } }, 'Failed to get administration');

      throw new ApiError('Failed to retrieve administration', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  /**
   * List districts assigned to an administration with access control.
   *
   * Super admin users can access any administration's districts.
   * Other users can only access districts for administrations they have access to.
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get districts for
   * @param options - Pagination and sorting options
   * @returns Paginated result with districts
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the administration
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listDistricts(
    authContext: AuthContext,
    administrationId: string,
    options: ListDistrictsOptions,
  ): Promise<PaginatedResult<Org>> {
    const { userId } = authContext;

    try {
      // Verify the administration exists and user has access
      await verifyAdministrationAccess(authContext, administrationId);

      // Fetch districts for the administration
      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: DISTRICT_SORT_FIELD_TO_COLUMN[options.sortBy],
          direction: options.sortOrder,
        },
      };

      return await administrationRepository.getDistrictsByAdministrationId(administrationId, queryParams);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, options } },
        'Failed to list administration districts',
      );

      throw new ApiError('Failed to retrieve administration districts', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  return { list, getById, listDistricts };
}
