import {
  AdministrationEmbedOption,
  AdministrationSortField,
  ADMINISTRATION_STATUS_VALUES,
  type PaginatedResult,
  type AdministrationStats,
  type ADMINISTRATION_EMBED_OPTIONS,
  type AdministrationStatus,
} from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import type { Administration } from '../../db/schema';
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
 * Auth context containing user identity and super admin flag.
 */
interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * Options for listing administrations including embed and status filter.
 */
export interface ListOptions extends AdministrationQueryOptions {
  embed?: AdministrationEmbedOptionType[];
  status?: AdministrationStatus;
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
   * List administrations accessible to a user with pagination, sorting, and optional embeds.
   *
   * super_admin users have unrestricted access to all administrations.
   * Other users only see administrations they're assigned to via org/class/group membership.
   *
   * @param authContext - User's auth context (id and type)
   * @param options - Query options including pagination, sorting, and embed
   * @returns Paginated result with administrations (optionally with embedded stats)
   * @throws {ApiError} If the database query fails.
   */
  async function list(
    authContext: AuthContext,
    options: ListOptions,
  ): Promise<PaginatedResult<AdministrationWithEmbeds>> {
    const { userId, isSuperAdmin } = authContext;

    // Validate status parameter (defense in depth - API contract also validates)
    if (options.status && !ADMINISTRATION_STATUS_VALUES.includes(options.status)) {
      throw new ApiError('Invalid status filter', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { status: options.status },
      });
    }

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
      };

      // Fetch administrations based on user role and authorization
      if (isSuperAdmin) {
        result = await administrationRepository.listAll({
          ...queryParams,
          ...(options.status && { status: options.status }),
        });
      } else {
        const allowedRoles = rolesForPermission(Permissions.Administrations.LIST);
        result = await administrationRepository.listAuthorized(
          { userId, allowedRoles },
          { ...queryParams, ...(options.status && { status: options.status }) },
        );
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
    // Stats are only available for super admins
    const shouldEmbedStats = isSuperAdmin && embedOptions.includes(AdministrationEmbedOption.STATS);
    const shouldEmbedTasks = embedOptions.includes(AdministrationEmbedOption.TASKS);

    // Handle embed=stats
    let statsMap: Map<string, AdministrationStats> | null = null;

    if (shouldEmbedStats) {
      // Fetch stats from both databases in parallel with graceful error handling.
      // If either query fails, we log the error and omit stats entirely (all-or-nothing).
      const [assignedResult, runsResult] = await Promise.allSettled([
        administrationRepository.getAssignedUserCountsByAdministrationIds(administrationIds),
        runsRepository.getRunStatsByAdministrationIds(administrationIds),
      ]);

      // Extract results, logging any failures
      const assignedCounts = assignedResult.status === 'fulfilled' ? assignedResult.value : null;
      const runStats = runsResult.status === 'fulfilled' ? runsResult.value : null;

      if (assignedResult.status === 'rejected') {
        logger.error(
          { err: assignedResult.reason, context: { userId } },
          'Failed to fetch assigned user counts for stats embed',
        );
      }
      if (runsResult.status === 'rejected') {
        logger.error({ err: runsResult.reason, context: { userId } }, 'Failed to fetch run stats for stats embed');
      }

      // Only build stats map if both queries succeeded (all-or-nothing)
      if (assignedCounts !== null && runStats !== null) {
        statsMap = new Map();
        for (const adminId of administrationIds) {
          statsMap.set(adminId, {
            assigned: assignedCounts.get(adminId) ?? 0,
            started: runStats.get(adminId)?.started ?? 0,
            completed: runStats.get(adminId)?.completed ?? 0,
          });
        }
      }
    }

    // Handle embed=tasks
    let tasksMap: Map<string, AdministrationTask[]> | null = null;

    if (shouldEmbedTasks) {
      try {
        tasksMap = await administrationTaskVariantRepository.getByAdministrationIds(administrationIds);
      } catch (err) {
        logger.error({ err, context: { userId } }, 'Failed to fetch tasks for tasks embed');
      }
    }

    // Attach embeds to each administration
    const itemsWithEmbeds: AdministrationWithEmbeds[] = result.items.map((admin) => {
      const adminWithEmbeds: AdministrationWithEmbeds = { ...admin };

      if (shouldEmbedStats && statsMap !== null) {
        adminWithEmbeds.stats = statsMap.get(admin.id) ?? { assigned: 0, started: 0, completed: 0 };
      }

      if (shouldEmbedTasks && tasksMap !== null) {
        adminWithEmbeds.tasks = tasksMap.get(admin.id) ?? [];
      }

      return adminWithEmbeds;
    });

    return {
      items: itemsWithEmbeds,
      totalItems: result.totalItems,
    };
  }

  return { list };
}
