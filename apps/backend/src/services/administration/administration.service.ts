import {
  AdministrationEmbedOption,
  type PaginatedResult,
  type AdministrationStats,
  type AdministrationEmbedOptionType,
  type AdministrationStatus,
  type AdministrationDistrictSortFieldType,
  type AdministrationSchoolSortFieldType,
  type AdministrationClassSortFieldType,
  type AdministrationGroupSortFieldType,
  type AdministrationTaskVariantSortFieldType,
} from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import type { Administration, Org, Class, Group } from '../../db/schema';
import { Permissions } from '../../constants/permissions';
import { rolesForPermission } from '../../constants/role-permissions';
import { hasSupervisoryRole } from '../../utils/has-supervisory-role.util';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { OrgType } from '../../enums/org-type.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import {
  AdministrationRepository,
  type AdministrationQueryOptions,
  type TaskVariantWithAssignment,
} from '../../repositories/administration.repository';
import {
  AdministrationTaskVariantRepository,
  type AdministrationTask,
} from '../../repositories/administration-task-variant.repository';
import { RunsRepository } from '../../repositories/runs.repository';
import { UserRepository } from '../../repositories/user.repository';
import type { AuthContext } from '../../types/auth-context';
import { TaskService } from '../task/task.service';
import type { Condition } from '../task/task.types';

/**
 * Administration with optional embedded data.
 */
export interface AdministrationWithEmbeds extends Administration {
  stats?: AdministrationStats;
  tasks?: AdministrationTask[];
}

/**
 * Options for listing administrations including embed and status filter.
 *
 * @property embed - Optional array of related data to include ('stats', 'tasks')
 * @property status - Optional filter by administration status:
 *   - 'active': dateStart <= now <= dateEnd
 *   - 'past': dateEnd < now
 *   - 'upcoming': dateStart > now
 */
export interface ListOptions extends AdministrationQueryOptions {
  embed?: AdministrationEmbedOptionType[];
  status?: AdministrationStatus;
}

/**
 * Options for listing orgs (districts/schools) of an administration.
 * Generic over the sort field type for type safety.
 */
export interface ListOrgsOptions<TSortField extends string = string> {
  page: number;
  perPage: number;
  sortBy: TSortField;
  sortOrder: 'asc' | 'desc';
}

export type ListDistrictsOptions = ListOrgsOptions<AdministrationDistrictSortFieldType>;
export type ListSchoolsOptions = ListOrgsOptions<AdministrationSchoolSortFieldType>;
export type ListClassesOptions = ListOrgsOptions<AdministrationClassSortFieldType>;
export type ListGroupsOptions = ListOrgsOptions<AdministrationGroupSortFieldType>;
export type ListTaskVariantsOptions = ListOrgsOptions<AdministrationTaskVariantSortFieldType>;

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
  userRepository = new UserRepository(),
  taskService = TaskService(),
}: {
  administrationRepository?: AdministrationRepository;
  administrationTaskVariantRepository?: AdministrationTaskVariantRepository;
  runsRepository?: RunsRepository;
  userRepository?: UserRepository;
  taskService?: ReturnType<typeof TaskService>;
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

    // Look up the administration first to distinguish 404 from 403
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
    const authorized = await administrationRepository.getAuthorizedById({ userId, allowedRoles }, administrationId);

    if (!authorized) {
      logger.warn({ userId, administrationId }, 'User attempted to access administration without permission');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, administrationId },
      });
    }

    return authorized;
  }

  /**
   * List orgs of a specific type assigned to an administration with access control.
   * Internal helper used by listDistricts and listSchools.
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get orgs for
   * @param orgType - The type of org to list (district or school)
   * @param options - Pagination and sorting options
   * @returns Paginated result with orgs
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listOrgs(
    authContext: AuthContext,
    administrationId: string,
    orgType: OrgType,
    options: ListOrgsOptions,
  ): Promise<PaginatedResult<Org>> {
    const { userId, isSuperAdmin } = authContext;
    const orgTypeName = orgType === OrgType.DISTRICT ? 'districts' : 'schools';

    try {
      await verifyAdministrationAccess(authContext, administrationId);

      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
      };

      if (isSuperAdmin) {
        return orgType === OrgType.DISTRICT
          ? await administrationRepository.getDistrictsByAdministrationId(administrationId, queryParams)
          : await administrationRepository.getSchoolsByAdministrationId(administrationId, queryParams);
      }

      const userRoles = await administrationRepository.getUserRolesForAdministration(userId, administrationId);

      if (!hasSupervisoryRole(userRoles)) {
        logger.warn(
          { userId, administrationId, userRoles },
          `Supervised user attempted to list administration ${orgTypeName}`,
        );
        throw new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        });
      }

      const allowedRoles = rolesForPermission(Permissions.Organizations.LIST);
      return orgType === OrgType.DISTRICT
        ? await administrationRepository.getAuthorizedDistrictsByAdministrationId(
            { userId, allowedRoles },
            administrationId,
            queryParams,
          )
        : await administrationRepository.getAuthorizedSchoolsByAdministrationId(
            { userId, allowedRoles },
            administrationId,
            queryParams,
          );
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, options } },
        `Failed to list administration ${orgTypeName}`,
      );

      throw new ApiError(`Failed to retrieve administration ${orgTypeName}`, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
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

    try {
      // Transform API contract format to repository format
      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        ...(options.status && { status: options.status }),
      };

      // Fetch administrations based on user role and authorization
      let result;
      if (isSuperAdmin) {
        result = await administrationRepository.listAll(queryParams);
      } else {
        const allowedRoles = rolesForPermission(Permissions.Administrations.LIST);
        result = await administrationRepository.listAuthorized({ userId, allowedRoles }, queryParams);
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
   * Authorization behavior:
   * - Super admin: sees all districts assigned to the administration
   * - Supervisory roles: sees only districts that intersect with their accessible org tree
   * - Supervised roles (student/guardian/parent/relative): returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get districts for
   * @param options - Pagination and sorting options
   * @returns Paginated result with districts
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the administration or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listDistricts(
    authContext: AuthContext,
    administrationId: string,
    options: ListDistrictsOptions,
  ): Promise<PaginatedResult<Org>> {
    return listOrgs(authContext, administrationId, OrgType.DISTRICT, options);
  }

  /**
   * List schools assigned to an administration with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all schools assigned to the administration
   * - Supervisory roles: sees only schools that intersect with their accessible org tree
   * - Supervised roles (student/guardian/parent/relative): returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get schools for
   * @param options - Pagination and sorting options
   * @returns Paginated result with schools
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the administration or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listSchools(
    authContext: AuthContext,
    administrationId: string,
    options: ListSchoolsOptions,
  ): Promise<PaginatedResult<Org>> {
    return listOrgs(authContext, administrationId, OrgType.SCHOOL, options);
  }

  /**
   * Performs authorization checks for sub-resource listing.
   * Throws if user lacks access or is a supervised user.
   *
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access or is a supervised user
   */
  async function authorizeSubResourceAccess(authContext: AuthContext, administrationId: string): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    await verifyAdministrationAccess(authContext, administrationId);

    if (isSuperAdmin) return;

    const userRoles = await administrationRepository.getUserRolesForAdministration(userId, administrationId);

    if (!hasSupervisoryRole(userRoles)) {
      logger.warn(
        { userId, administrationId, userRoles },
        'Supervised user attempted to list administration sub-resources',
      );
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    }
  }

  /**
   * List classes assigned to an administration with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all classes assigned to the administration
   * - Supervisory roles: sees only classes that belong to schools in their accessible org tree
   * - Supervised roles (student/guardian/parent/relative): returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get classes for
   * @param options - Pagination and sorting options
   * @returns Paginated result with classes
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the administration or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listClasses(
    authContext: AuthContext,
    administrationId: string,
    options: ListClassesOptions,
  ): Promise<PaginatedResult<Class>> {
    const { userId, isSuperAdmin } = authContext;

    try {
      await authorizeSubResourceAccess(authContext, administrationId);

      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
      };

      if (isSuperAdmin) {
        return await administrationRepository.getClassesByAdministrationId(administrationId, queryParams);
      }

      const allowedRoles = rolesForPermission(Permissions.Classes.LIST);
      return await administrationRepository.getAuthorizedClassesByAdministrationId(
        { userId, allowedRoles },
        administrationId,
        queryParams,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, options } },
        'Failed to list administration classes',
      );

      throw new ApiError('Failed to retrieve administration classes', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  /**
   * List groups assigned to an administration with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all groups assigned to the administration
   * - Supervisory roles: sees only groups they are directly a member of (groups are flat, no hierarchy)
   * - Supervised roles (student/guardian/parent/relative): returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get groups for
   * @param options - Pagination and sorting options
   * @returns Paginated result with groups
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the administration or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listGroups(
    authContext: AuthContext,
    administrationId: string,
    options: ListGroupsOptions,
  ): Promise<PaginatedResult<Group>> {
    const { userId, isSuperAdmin } = authContext;

    try {
      await authorizeSubResourceAccess(authContext, administrationId);

      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
      };

      if (isSuperAdmin) {
        return await administrationRepository.getGroupsByAdministrationId(administrationId, queryParams);
      }

      const allowedRoles = rolesForPermission(Permissions.Groups.LIST);
      return await administrationRepository.getAuthorizedGroupsByAdministrationId(
        { userId, allowedRoles },
        administrationId,
        queryParams,
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, options } },
        'Failed to list administration groups',
      );

      throw new ApiError('Failed to retrieve administration groups', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  /**
   * List task variants assigned to an administration with access control and eligibility filtering.
   *
   * Task variants are administration-level resources (no org hierarchy filtering).
   * Unlike districts/schools/classes/groups, task variants are visible to ALL users
   * with administration access - students need this to know which assessments to take.
   *
   * Authorization and eligibility behavior:
   * - Super admin: sees all task variants assigned to the administration (no filtering)
   * - Supervisory roles (teachers, admins): sees all task variants (no filtering)
   * - Supervised roles (students): sees only task variants where conditionsAssignment passes.
   *   - conditionsAssignment (assigned_if): determines if the variant is visible/assigned to the student
   *   - conditionsRequirements (optional_if): determines if a visible variant is optional (vs required)
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get task variants for
   * @param options - Pagination and sorting options
   * @returns Paginated result with task variants
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the administration
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listTaskVariants(
    authContext: AuthContext,
    administrationId: string,
    options: ListTaskVariantsOptions,
  ): Promise<PaginatedResult<TaskVariantWithAssignment>> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // Verify administration exists and user has access (students included)
      await verifyAdministrationAccess(authContext, administrationId);

      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
      };

      const result = await administrationRepository.getTaskVariantsByAdministrationId(administrationId, queryParams);

      // Super admins see all task variants without filtering
      if (isSuperAdmin) {
        return result;
      }

      // Get user roles to determine if eligibility filtering applies
      const userRoles = await administrationRepository.getUserRolesForAdministration(userId, administrationId);

      // Supervisory roles (teachers, admins) see all task variants without filtering
      if (hasSupervisoryRole(userRoles)) {
        return result;
      }

      // For supervised roles (students), filter by eligibility conditions
      // Fetch user data for condition evaluation
      const user = await userRepository.getById({ id: userId });
      if (!user) {
        // This should be rare - authenticated user exists in auth but not in DB (data inconsistency)
        logger.error(
          { userId, administrationId },
          'User not found during eligibility filtering - possible data inconsistency',
        );
        throw new ApiError('Failed to retrieve user data for eligibility check', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, administrationId },
        });
      }

      // Filter task variants by eligibility conditions using TaskService
      // Note: Post-filter pagination fetches all variants from DB, filters in-memory by assigned_if,
      // and returns the count of eligible items. This is acceptable for typical administration sizes
      // (<50 variants). For larger datasets, consider moving filtering to the repository layer.
      const eligibleItems = result.items
        .map((item) => {
          try {
            const assignedIf = item.assignment.conditionsAssignment as Condition | null;
            const optionalIf = item.assignment.conditionsRequirements as Condition | null;
            const { isAssigned, isOptional } = taskService.evaluateTaskVariantEligibility(user, assignedIf, optionalIf);
            return isAssigned ? { item, isOptional } : null;
          } catch (error) {
            // Malformed condition data - exclude variant and log warning
            logger.warn(
              { taskVariantId: item.variant.id, error, userId, administrationId },
              'Invalid condition structure - excluding variant',
            );
            return null;
          }
        })
        .filter((result): result is { item: TaskVariantWithAssignment; isOptional: boolean } => result !== null)
        .map(({ item, isOptional }) => ({
          ...item,
          assignment: {
            ...item.assignment,
            // Don't expose eligibility conditions to students - only provide evaluated result
            conditionsAssignment: null,
            conditionsRequirements: null,
            optional: isOptional,
          },
        }));

      return {
        items: eligibleItems,
        totalItems: eligibleItems.length,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, options } },
        'Failed to list administration task variants',
      );

      throw new ApiError('Failed to retrieve administration task variants', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  return { list, getById, listDistricts, listSchools, listClasses, listGroups, listTaskVariants };
}
