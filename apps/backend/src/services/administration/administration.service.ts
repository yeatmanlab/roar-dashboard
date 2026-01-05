import type { Administration } from '../../db/schema';
import {
  AdministrationRepository,
  type AdministrationQueryOptions,
  type AdministrationSortField as AdministrationSortFieldType,
} from '../../repositories/administration.repository';
import { AuthorizationRepository } from '../../repositories/authorization.repository';
import { RunsRepository } from '../../repositories/runs.repository';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  AdministrationEmbedOption,
  AdministrationSortField,
  type PaginatedResult,
  type AdministrationStats,
  type ADMINISTRATION_EMBED_OPTIONS,
} from '@roar-dashboard/api-contract';
import type { UserType } from '../../enums/user-type.enum';
import { isUnrestrictedResource } from '../../utils/resource-scope.utils';
import { logger } from '../../logger';

/**
 * Embed option type derived from api-contract.
 */
type AdministrationEmbedOptionType = (typeof ADMINISTRATION_EMBED_OPTIONS)[number];

/**
 * Administration with optional embedded stats.
 */
export interface AdministrationWithEmbeds extends Administration {
  stats?: AdministrationStats;
}

/**
 * Maps API sort field names to database column names.
 *
 * @TODO: Check with team whether to rename DB column 'nameInternal' to 'name'
 * to eliminate this mapping.
 */
const SORT_FIELD_TO_COLUMN: Record<AdministrationSortFieldType, string> = {
  [AdministrationSortField.NAME]: 'nameInternal',
  [AdministrationSortField.CREATED_AT]: 'createdAt',
  [AdministrationSortField.DATE_START]: 'dateStart',
  [AdministrationSortField.DATE_END]: 'dateEnd',
};

/**
 * Auth context containing user identity and role.
 */
interface AuthContext {
  userId: string;
  userType: UserType;
}

/**
 * Options for listing administrations including embed options.
 */
export interface ListOptions extends AdministrationQueryOptions {
  embed?: AdministrationEmbedOptionType[];
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
  authorizationRepository = new AuthorizationRepository(),
  authorizationService = AuthorizationService(),
  runsRepository = new RunsRepository(),
}: {
  administrationRepository?: AdministrationRepository;
  authorizationRepository?: AuthorizationRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
  runsRepository?: RunsRepository;
} = {}) {
  /**
   * List administrations accessible to a user with pagination, sorting, and optional embeds.
   *
   * Users with unrestricted scope have access to all administrations.
   * Users with scoped access only see administrations they're assigned to.
   *
   * @param authContext - User's auth context (id and type)
   * @param options - Query options including pagination, sorting, and embed
   * @returns Paginated result with administrations (optionally with embedded stats)
   */
  async function list(
    authContext: AuthContext,
    options: ListOptions,
  ): Promise<PaginatedResult<AdministrationWithEmbeds>> {
    const { userId, userType } = authContext;
    const scope = await authorizationService.getAdministrationsScope(userId, userType);

    // Transform API contract format to repository format
    const queryParams = {
      page: options.page,
      perPage: options.perPage,
      orderBy: {
        field: SORT_FIELD_TO_COLUMN[options.sortBy],
        direction: options.sortOrder,
      },
    };

    // Fetch administrations based on user's scope
    const result = isUnrestrictedResource(scope)
      ? await administrationRepository.getAll(queryParams)
      : await administrationRepository.getByIds(scope.ids, queryParams);

    // If no embeds requested, return as-is
    const embedOptions = options.embed ?? [];
    if (embedOptions.length === 0) {
      return result;
    }

    // Handle embed=stats
    const shouldEmbedStats = embedOptions.includes(AdministrationEmbedOption.STATS);
    let statsMap: Map<string, AdministrationStats> | null = null;

    if (shouldEmbedStats && result.items.length > 0) {
      const administrationIds = result.items.map((admin) => admin.id);

      // Fetch stats from both databases in parallel with graceful error handling.
      // If either query fails, we log the error and omit stats entirely (all-or-nothing).
      const [assignedResult, runsResult] = await Promise.allSettled([
        authorizationRepository.getAssignedUserCountsByAdministrationIds(administrationIds),
        runsRepository.getRunStatsByAdministrationIds(administrationIds),
      ]);

      // Extract results, logging any failures
      const assignedCounts = assignedResult.status === 'fulfilled' ? assignedResult.value : null;
      const runStats = runsResult.status === 'fulfilled' ? runsResult.value : null;

      if (assignedResult.status === 'rejected') {
        logger.error({ err: assignedResult.reason }, 'Failed to fetch assigned user counts for stats embed');
      }
      if (runsResult.status === 'rejected') {
        logger.error({ err: runsResult.reason }, 'Failed to fetch run stats for stats embed');
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

    // Attach embeds to each administration (only if stats were successfully fetched)
    const itemsWithEmbeds: AdministrationWithEmbeds[] = result.items.map((admin) => {
      const adminWithEmbeds: AdministrationWithEmbeds = { ...admin };

      if (shouldEmbedStats && statsMap !== null) {
        adminWithEmbeds.stats = statsMap.get(admin.id) ?? { assigned: 0, started: 0, completed: 0 };
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
