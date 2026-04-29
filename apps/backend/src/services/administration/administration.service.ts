import type {
  PaginatedResult,
  AdministrationStats,
  AdministrationEmbedOptionType,
  AdministrationStatus,
  AdministrationTaskVariantSortFieldType,
  AdministrationAgreementSortFieldType,
  TreeEmbedOptionType,
  TreeParentEntityType,
  CreateAdministrationRequest,
} from '@roar-dashboard/api-contract';
import { AdministrationEmbedOption, TreeEmbedOption } from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import type { Administration } from '../../db/schema';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { extractFgaObjectId } from '../authorization/helpers/extract-fga-object-id.helper';
import {
  administrationDistrictTuple,
  administrationSchoolTuple,
  administrationClassTuple,
  administrationGroupTuple,
} from '../authorization/helpers/fga-tuples';
import { AgreementType } from '../../enums/agreement-type.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { TaskVariantStatus } from '../../enums/task-variant-status.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import type {
  AccessibleIds,
  AdministrationAssignees,
  AdministrationQueryOptions,
  AgreementWithVersion,
  TaskVariantWithAssignment,
  TreeNode,
  CreateAdministrationInput,
} from '../../repositories/administration.repository';
import { AdministrationRepository } from '../../repositories/administration.repository';
import type { AdministrationTask } from '../../repositories/administration-task-variant.repository';
import { AdministrationTaskVariantRepository } from '../../repositories/administration-task-variant.repository';
import { ReportRepository } from '../../repositories/report.repository';
import type { ReportScope } from '../../repositories/report.repository';
import { UserRepository } from '../../repositories/user.repository';
import type { AuthContext } from '../../types/auth-context';
import { RunRepository } from '../../repositories/run.repository';
import { TaskService } from '../task/task.service';
import { DistrictRepository } from '../../repositories/district.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import { ClassRepository } from '../../repositories/class.repository';
import { GroupRepository } from '../../repositories/group.repository';
import { TaskVariantRepository } from '../../repositories/task-variant.repository';
import { AgreementRepository } from '../../repositories/agreement.repository';
import type { Condition } from '../../types/condition';
import { isMajorityAge } from '../../utils/is-majority-age.util';

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
 * Options for listing task variants of an administration.
 */
export interface ListTaskVariantsOptions {
  page: number;
  perPage: number;
  sortBy: AdministrationTaskVariantSortFieldType;
  sortOrder: 'asc' | 'desc';
}

/**
 * Options for listing agreements of an administration.
 */
export interface ListAgreementsOptions {
  page: number;
  perPage: number;
  sortBy: AdministrationAgreementSortFieldType;
  sortOrder: 'asc' | 'desc';
  locale: string;
}

/**
 * Options for the tree endpoint.
 */
export interface GetTreeOptions {
  page: number;
  perPage: number;
  parentEntityType?: TreeParentEntityType;
  parentEntityId?: string;
  embed?: TreeEmbedOptionType[];
}

/**
 * Per-node stats returned when `?embed=stats` is requested on the tree endpoint.
 */
export interface TreeNodeStats {
  assignment: {
    studentsWithRequiredTasks: number;
    studentsAssigned: number;
    studentsStarted: number;
    studentsCompleted: number;
  };
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
  reportRepository = new ReportRepository(),
  userRepository = new UserRepository(),
  authorizationService = AuthorizationService(),
  runRepository = new RunRepository(),
  taskService = TaskService(),
  districtRepository = new DistrictRepository(),
  schoolRepository = new SchoolRepository(),
  classRepository = new ClassRepository(),
  groupRepository = new GroupRepository(),
  taskVariantRepository = new TaskVariantRepository(),
  agreementRepository = new AgreementRepository(),
}: {
  administrationRepository?: AdministrationRepository;
  administrationTaskVariantRepository?: AdministrationTaskVariantRepository;
  reportRepository?: ReportRepository;
  runRepository?: RunRepository;
  userRepository?: UserRepository;
  taskService?: ReturnType<typeof TaskService>;
  authorizationService?: ReturnType<typeof AuthorizationService>;
  districtRepository?: DistrictRepository;
  schoolRepository?: SchoolRepository;
  classRepository?: ClassRepository;
  groupRepository?: GroupRepository;
  taskVariantRepository?: TaskVariantRepository;
  agreementRepository?: AgreementRepository;
} = {}) {
  /**
   * Verify that an administration exists and the user has access to it.
   *
   * Performs a two-step check:
   * 1. Verify the administration exists (returns 404 if not)
   * 2. Verify the user has access via FGA (returns 403 if not, skipped for super admins)
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param administrationId - The administration ID to verify access for
   * @param fgaRelation - The FGA permission relation to check (defaults to can_read)
   * @returns The administration if found and accessible
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access
   */
  async function verifyAdministrationAccess(
    authContext: AuthContext,
    administrationId: string,
    fgaRelation: FgaRelation = FgaRelation.CAN_READ,
  ): Promise<Administration> {
    const { userId, isSuperAdmin } = authContext;

    // Look up the administration first to distinguish 404 from 403
    const administration = await administrationRepository.getById({ id: administrationId });

    if (!administration) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, administrationId },
      });
    }

    // Super admins have unrestricted access
    if (isSuperAdmin) {
      return administration;
    }

    // Check access via FGA permission check
    await authorizationService.requirePermission(userId, fgaRelation, `${FgaType.ADMINISTRATION}:${administrationId}`);

    return administration;
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
      runRepository.getRunStatsByAdministrationIds(administrationIds).catch((err) => {
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
        // FGA resolves which administrations the user can access based on their
        // role memberships and the org/class/group hierarchy
        const objects = await authorizationService.listAccessibleObjects(
          userId,
          FgaRelation.CAN_LIST,
          FgaType.ADMINISTRATION,
        );
        const ids = objects.map(extractFgaObjectId);
        if (ids.length === 0) {
          return { items: [], totalItems: 0 };
        }
        result = await administrationRepository.getByIds(ids, queryParams);
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
   * Get all assignees (districts, schools, classes, groups) for an administration.
   *
   * Authorization behavior:
   * - Super admin: can view assignees for any administration
   * - Other users: returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param administrationId - The administration ID to get assignees for
   * @returns All assignees (districts, schools, classes, groups)
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user is not super admin
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function getAssignees(authContext: AuthContext, administrationId: string): Promise<AdministrationAssignees> {
    const { userId, isSuperAdmin } = authContext;

    // Super admin gate — only super admins can view assignees
    if (!isSuperAdmin) {
      logger.warn({ userId, administrationId }, 'Non-super admin attempted to access administration assignees');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, administrationId },
      });
    }

    try {
      // Verify administration exists (404 before data fetch)
      const administration = await administrationRepository.getById({ id: administrationId });
      if (!administration) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, administrationId },
        });
      }

      return await administrationRepository.getAssignees(administrationId);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, administrationId } }, 'Failed to get administration assignees');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
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
   *
   * Authorization, status filtering, and eligibility behavior:
   * - Super admin: sees all task variants (including draft/deprecated), no eligibility filtering
   * - Supervisory roles (teachers, admins): sees all task variants (including draft/deprecated), no eligibility filtering
   * - Students: sees only **published** task variants where conditionsAssignment passes.
   *   - conditionsAssignment (assigned_if): determines if the variant is visible/assigned to the student
   *   - conditionsRequirements (optional_if): determines if a visible variant is optional (vs required)
   * - Other supervised roles (guardian, parent, relative): returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get task variants for
   * @param options - Pagination and sorting options
   * @returns Paginated result with task variants
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the administration or is a non-student supervised role
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

      // Super admins see all task variants of all statuses without eligibility filtering
      if (isSuperAdmin) {
        return await administrationRepository.getTaskVariantsByAdministrationId(
          administrationId,
          false, // publishedOnly = false
          queryParams,
        );
      }

      // Check if user has supervisory access (can_list_users on the administration)
      const canListUsers = await authorizationService.hasPermission(
        userId,
        FgaRelation.CAN_LIST_USERS,
        `${FgaType.ADMINISTRATION}:${administrationId}`,
      );

      // Supervisory roles (teachers, admins) see all task variants of all statuses without eligibility filtering
      if (canListUsers) {
        return await administrationRepository.getTaskVariantsByAdministrationId(
          administrationId,
          false, // publishedOnly = false
          queryParams,
        );
      }

      // For non-supervisory users, only students (can_create_run) can access task variants
      // Other roles (guardian, parent, relative) get 403 Forbidden
      await authorizationService.requirePermission(
        userId,
        FgaRelation.CAN_CREATE_RUN,
        `${FgaType.ADMINISTRATION}:${administrationId}`,
      );

      // Students only see published task variants
      const result = await administrationRepository.getTaskVariantsByAdministrationId(
        administrationId,
        true, // publishedOnly = true
        queryParams,
      );

      // Students: filter by eligibility conditions
      // Fetch user data for condition evaluation
      const user = await userRepository.getById({ id: userId });
      if (!user) {
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

  /**
   * List agreements assigned to an administration with access control and age-based filtering.
   *
   * Each agreement includes the current version for the requested locale.
   * If no current version exists for that locale, currentVersion will be null.
   *
   * Access control:
   * - **Super admins and supervisory roles** (teachers, admins): see all agreements
   * - **Students**: see `assent` (if minor) or `consent` (if adult)
   * - **Other supervised roles** (guardian, parent, relative): 403 Forbidden
   *
   * Age is determined first by dob, then by grade if dob is unavailable.
   * If age cannot be determined, the student is conservatively treated as a minor.
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to get agreements for
   * @param options - Pagination, sorting, filtering, and locale options
   * @returns Paginated result with agreements and their current versions
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access or is a non-student supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listAgreements(
    authContext: AuthContext,
    administrationId: string,
    options: ListAgreementsOptions,
  ): Promise<PaginatedResult<AgreementWithVersion>> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // Verify administration exists and user has access (all roles allowed)
      await verifyAdministrationAccess(authContext, administrationId);

      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        locale: options.locale,
      };

      // Fetch agreements before the second-level auth check. This is safe because
      // verifyAdministrationAccess already confirmed read permissions on the
      // administration itself. The agreements will be filtered in-memory after
      // fetching based on the user's role and age.
      const result = await administrationRepository.getAgreementsByAdministrationId(administrationId, queryParams);

      // Super admins see all agreements without filtering
      if (isSuperAdmin) {
        return result;
      }

      // Check if user has supervisory access (can_list_users on the administration)
      const canListUsers = await authorizationService.hasPermission(
        userId,
        FgaRelation.CAN_LIST_USERS,
        `${FgaType.ADMINISTRATION}:${administrationId}`,
      );

      // Supervisory roles (teachers, admins) see all agreements without filtering
      if (canListUsers) {
        return result;
      }

      // For non-supervisory users, only students (can_create_run) can access agreements
      // Other roles (guardian, parent, relative) get 403 Forbidden
      await authorizationService.requirePermission(
        userId,
        FgaRelation.CAN_CREATE_RUN,
        `${FgaType.ADMINISTRATION}:${administrationId}`,
      );

      // Students: filter by age (assent for minors, consent for adults)
      // Fetch user data for age determination
      const user = await userRepository.getById({ id: userId });
      if (!user) {
        logger.error(
          { userId, administrationId },
          'User not found during agreement filtering - possible data inconsistency',
        );
        throw new ApiError('Failed to retrieve user data for agreement filtering', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, administrationId },
        });
      }

      // Determine if user is of majority age (18+)
      // null means age cannot be determined - conservatively treat as minor
      const isOfMajorityAge = isMajorityAge({ dob: user.dob, grade: user.grade });
      const isAdult = isOfMajorityAge === true;

      // Filter agreements based on student's age:
      // - assent: shown only to minors (isAdult === false)
      // - consent: shown only to adults (isAdult === true)
      // - tos: never shown to students
      // TODO: Pagination is broken for students - filtering happens after DB pagination,
      // so totalItems/page counts are incorrect. Fix by moving filter to repository layer.
      const filteredItems = result.items.filter((item) => {
        switch (item.agreement.agreementType) {
          case AgreementType.ASSENT:
            return !isAdult;
          case AgreementType.CONSENT:
            return isAdult;
          default:
            return false; // Students never see TOS or unknown types
        }
      });

      return {
        items: filteredItems,
        totalItems: filteredItems.length,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId, administrationId, options } },
        'Failed to list administration agreements',
      );

      throw new ApiError('Failed to retrieve administration agreements', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  /**
   * Delete an administration by ID with access control.
   *
   * Authorization behavior:
   * - Super admin: can delete any administration
   * - Users with DELETE permission: can delete administrations they have access to
   *
   * Junction tables (administrationOrgs, administrationClasses, etc.) have ON DELETE CASCADE,
   * so those will be cleaned up automatically.
   *
   * Returns 409 CONFLICT if the administration has existing assessment runs in the assessment database.
   *
   * @param authContext - User's auth context (id and type)
   * @param administrationId - The administration ID to delete
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks permission to delete
   * @throws {ApiError} CONFLICT if runs exist for this administration
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database operation fails
   */
  async function deleteById(authContext: AuthContext, administrationId: string): Promise<void> {
    const { userId } = authContext;

    try {
      // Verify existence and authorization with DELETE permission via FGA
      await verifyAdministrationAccess(authContext, administrationId, FgaRelation.CAN_DELETE);

      // Check if runs exist in the assessment database
      // Since runs are in a separate DB without FK constraints, we must check explicitly
      const run = await runRepository.getByAdministrationId(administrationId);
      if (run) {
        throw new ApiError('Cannot delete administration with existing assessment runs', {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, administrationId },
        });
      }

      // Delete the administration (junction tables cascade automatically)
      await administrationRepository.delete({ id: administrationId });
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, administrationId } }, 'Failed to delete administration');

      throw new ApiError('Failed to delete administration', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
        cause: error,
      });
    }
  }

  /**
   * List administrations accessible to a requester and target user with pagination, sorting, and optional embeds.
   *
   * super_admin users have unrestricted access to all administrations.
   * Other requesters only see target user's administrations they're also assigned to via org/class/group membership.
   *
   * **Embed restrictions:**
   * - `stats`: Only returned for super_admin users (expensive query, sensitive data).
   *   Non-super-admins requesting stats will receive results without stats silently.
   * - `tasks`: Available to all users.
   *
   * @param authContext - Authentication context
   * @param userId - User ID to get administrations for
   * @param options - List options with pagination and embeds
   * @returns Paginated result with optional embeds (stats, tasks)
   * @throws {ApiError} NOT_FOUND if target user doesn't exist
   * @throws {ApiError} FORBIDDEN if requester lacks access to target user's administrations
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database operation fails
   */
  async function getUserAdministrations(
    authContext: AuthContext,
    userId: string,
    options: ListOptions,
  ): Promise<PaginatedResult<AdministrationWithEmbeds>> {
    const { userId: requesterUserId, isSuperAdmin } = authContext;

    if (requesterUserId === userId) {
      return list(authContext, options);
    }

    try {
      // Verify target user exists
      const targetUser = await userRepository.getById({ id: userId });

      if (!targetUser) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId },
        });
      }
      const queryParams = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        ...(options.status && { status: options.status }),
      };

      const targetUserAdmins = await authorizationService.listAccessibleObjects(
        userId,
        FgaRelation.CAN_LIST,
        FgaType.ADMINISTRATION,
      );
      const targetUserAdminIds = targetUserAdmins.map(extractFgaObjectId);

      if (targetUserAdminIds.length === 0) {
        return { items: [], totalItems: 0 };
      }
      // Fetch administrations based on user role and authorization
      let result: PaginatedResult<Administration>;

      if (isSuperAdmin) {
        result = await administrationRepository.getByIds(targetUserAdminIds, queryParams);
      } else {
        const requesterUserAdmins = await authorizationService.listAccessibleObjects(
          requesterUserId,
          FgaRelation.CAN_LIST,
          FgaType.ADMINISTRATION,
        );
        const requesterUserAdminIds = new Set(requesterUserAdmins.map(extractFgaObjectId));
        const intersectedIds = targetUserAdminIds.filter((id) => requesterUserAdminIds.has(id));

        if (intersectedIds.length === 0) {
          logger.warn(
            { requesterUserId, userId },
            'User attempted to list administrations for user they have no shared access with',
          );

          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { requesterUserId, targetUserId: userId },
          });
        }

        result = await administrationRepository.getByIds(intersectedIds, queryParams);
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
      const statsMap = shouldEmbedStats ? await fetchStatsEmbed(administrationIds, requesterUserId) : null;
      const tasksMap = shouldEmbedTasks ? await fetchTasksEmbed(administrationIds, requesterUserId) : null;

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

      logger.error({ err: error, context: { userId } }, 'Failed to get user administrations');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  /**
   * Get one level of the organization tree for an administration.
   *
   * Returns a paginated list of entities at one level of the hierarchy.
   * When no parent params are provided, returns all direct assignees of
   * the administration (districts, schools, classes, and groups).
   * Districts expand to child schools, schools to child classes.
   * Classes and groups are leaf nodes.
   *
   * Authorization behavior:
   * - Super admin: sees all entities assigned to the administration
   * - Other users: must have access to the administration, and results are
   *   scoped to entities the user can see via FGA
   *
   * @param authContext - User's auth context
   * @param administrationId - The administration ID
   * @param options - Query options (pagination, parent, embed)
   * @returns Paginated tree nodes with optional stats
   * @throws {ApiError} NOT_FOUND if administration doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access
   * @throws {ApiError} BAD_REQUEST if parentEntityId/parentEntityType provided without the other
   * @throws {ApiError} NOT_FOUND if parent entity doesn't exist
   */
  async function getTree(
    authContext: AuthContext,
    administrationId: string,
    options: GetTreeOptions,
  ): Promise<PaginatedResult<TreeNode & { stats?: TreeNodeStats }>> {
    const { userId, isSuperAdmin } = authContext;
    const { page, perPage, parentEntityType, parentEntityId, embed } = options;

    // Validate: parentEntityId and parentEntityType must be provided together
    if (parentEntityId && !parentEntityType) {
      throw new ApiError('parentEntityId requires parentEntityType', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { userId, administrationId, parentEntityId },
      });
    }
    if (parentEntityType && !parentEntityId) {
      throw new ApiError('parentEntityType requires parentEntityId', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        context: { userId, administrationId, parentEntityType },
      });
    }

    try {
      // Verify administration exists and user has access (404 before 403)
      await verifyAdministrationAccess(authContext, administrationId);

      // Build FGA-scoped accessible IDs (undefined = no filter for super admins)
      let accessibleIds: AccessibleIds | undefined;

      if (!isSuperAdmin) {
        // Fetch accessible entity IDs for each type the user can read
        const [districtObjects, schoolObjects, classObjects, groupObjects] = await Promise.all([
          authorizationService.listAccessibleObjects(userId, FgaRelation.CAN_READ, FgaType.DISTRICT).catch((err) => {
            throw new ApiError('Failed to resolve district access', {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.DATABASE_QUERY_FAILED,
              context: { userId, administrationId, fgaType: FgaType.DISTRICT },
              cause: err,
            });
          }),
          authorizationService.listAccessibleObjects(userId, FgaRelation.CAN_READ, FgaType.SCHOOL).catch((err) => {
            throw new ApiError('Failed to resolve school access', {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.DATABASE_QUERY_FAILED,
              context: { userId, administrationId, fgaType: FgaType.SCHOOL },
              cause: err,
            });
          }),
          authorizationService.listAccessibleObjects(userId, FgaRelation.CAN_READ, FgaType.CLASS).catch((err) => {
            throw new ApiError('Failed to resolve class access', {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.DATABASE_QUERY_FAILED,
              context: { userId, administrationId, fgaType: FgaType.CLASS },
              cause: err,
            });
          }),
          authorizationService.listAccessibleObjects(userId, FgaRelation.CAN_READ, FgaType.GROUP).catch((err) => {
            throw new ApiError('Failed to resolve group access', {
              statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
              code: ApiErrorCode.DATABASE_QUERY_FAILED,
              context: { userId, administrationId, fgaType: FgaType.GROUP },
              cause: err,
            });
          }),
        ]);

        accessibleIds = {
          districtIds: districtObjects.map(extractFgaObjectId),
          schoolIds: schoolObjects.map(extractFgaObjectId),
          classIds: classObjects.map(extractFgaObjectId),
          groupIds: groupObjects.map(extractFgaObjectId),
        };
      }

      // Fetch tree nodes from repository
      const result = await administrationRepository.getTreeNodes(
        administrationId,
        parentEntityType,
        parentEntityId,
        { page, perPage },
        accessibleIds,
      );

      // If no stats embed requested, return as-is
      const embedOptions = embed ?? [];
      if (!embedOptions.includes(TreeEmbedOption.STATS) || result.items.length === 0) {
        return result;
      }

      // Resolve real assignment stats per node via bulk progress overview counts.
      // 1. Fetch task metadata for the administration
      const taskMetas = await reportRepository.getTaskMetadata(administrationId);

      const zeroedStats: TreeNodeStats = {
        assignment: {
          studentsWithRequiredTasks: 0,
          studentsAssigned: 0,
          studentsStarted: 0,
          studentsCompleted: 0,
        },
      };

      if (taskMetas.length === 0) {
        // No tasks configured — return zeroed stats
        const itemsWithStats = result.items.map((node) => ({ ...node, stats: zeroedStats }));
        return { items: itemsWithStats, totalItems: result.totalItems };
      }

      // 2. Build scopes from tree nodes (entityType maps directly to ScopeType)
      const scopes: ReportScope[] = result.items.map((node) => ({
        scopeType: node.entityType,
        scopeId: node.id,
      }));

      // 3. Fetch bulk stats for all nodes in one query
      const statsMap = await reportRepository.getProgressOverviewCountsBulk(administrationId, scopes, taskMetas);

      // 4. Extract per-student assignment-level counts per node
      const itemsWithStats = result.items.map((node) => {
        const scopeResult = statsMap.get(node.id);
        if (!scopeResult) {
          return { ...node, stats: zeroedStats };
        }

        return {
          ...node,
          stats: {
            assignment: {
              studentsWithRequiredTasks: scopeResult.studentCounts.studentsWithRequiredTasks,
              studentsAssigned: scopeResult.studentCounts.studentsAssigned,
              studentsStarted: scopeResult.studentCounts.studentsStarted,
              studentsCompleted: scopeResult.studentCounts.studentsCompleted,
            },
          },
        };
      });

      return { items: itemsWithStats, totalItems: result.totalItems };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, administrationId, options } }, 'Failed to get administration tree');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId, options },
        cause: error,
      });
    }
  }

  /**
   * Get a specific administration for a user. Both requester and target user must have access to the administration.
   * @param authContext - The authentication context of the requester.
   * @param userId - The ID of the user to get the administration for.
   * @param administrationId - The ID of the administration to get.
   * @returns The administration with the specified ID.
   * @throws {ApiError} NOT_FOUND if target user or administration doesn't exist
   * @throws {ApiError} FORBIDDEN if requester lacks access to target user's administrations
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database operation fails
   */
  async function getUserAdministration(
    authContext: AuthContext,
    userId: string,
    administrationId: string,
  ): Promise<Administration> {
    const { userId: requesterUserId, isSuperAdmin } = authContext;

    try {
      const targetUser = await userRepository.getById({ id: userId });

      if (!targetUser) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId },
        });
      }

      const administration = await verifyAdministrationAccess(
        { userId, isSuperAdmin: targetUser.isSuperAdmin },
        administrationId,
      );

      if (isSuperAdmin || requesterUserId === userId) {
        return administration;
      }

      await authorizationService.requirePermission(
        requesterUserId,
        FgaRelation.CAN_READ,
        `${FgaType.ADMINISTRATION}:${administrationId}`,
      );

      return administration;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { requesterUserId, userId, administrationId } },
        'Failed to get user administration',
      );

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, administrationId },
      });
    }
  }

  /**
   * Create a new administration with task variants and entity assignments.
   *
   * Validates:
   * - dateEnd must be after dateStart
   * - At least one task variant must be provided (enforced by schema)
   * - If isOrdered is true, task variant orderIndex values must be unique
   * - At least one org, class, or group must be assigned
   * - Name must be unique (case-insensitive)
   * - All referenced entities (orgs, classes, groups, task variants, agreements) must exist
   *
   * @param authContext - User's authentication context
   * @param request - The create administration request body
   * @returns The created administration
   * @throws {ApiError} FORBIDDEN if user is not a super admin
   * @throws {ApiError} UNPROCESSABLE_ENTITY if validation fails (date range, duplicate orderIndex, missing assignments)
   * @throws {ApiError} CONFLICT if an administration with the same name already exists
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database operation fails
   */
  async function create(authContext: AuthContext, request: CreateAdministrationRequest): Promise<Administration> {
    const { userId, isSuperAdmin } = authContext;

    if (!isSuperAdmin) {
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, isSuperAdmin },
      });
    }

    try {
      // Parse dates
      const dateStart = new Date(request.dateStart);
      const dateEnd = new Date(request.dateEnd);

      // Validate date range: dateEnd must be after dateStart
      if (dateEnd <= dateStart) {
        throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { userId, reason: 'dateEnd must be after dateStart' },
        });
      }

      // Validate unique orderIndex values when isOrdered is true
      if (request.isOrdered) {
        const orderIndices = request.taskVariants.map((tv) => tv.orderIndex);
        const uniqueIndices = new Set(orderIndices);
        if (uniqueIndices.size !== orderIndices.length) {
          throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
            context: { userId, reason: 'Task variant orderIndex values must be unique when isOrdered is true' },
          });
        }
      }

      // Validate there is at least one org, class, or group assigned
      if (request.orgs.length === 0 && request.classes.length === 0 && request.groups.length === 0) {
        throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { userId, reason: 'At least one org, class, or group must be assigned' },
        });
      }

      // Validate name is unique
      const nameExists = await administrationRepository.existsByName(request.name);
      if (nameExists) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, name: request.name, reason: 'An administration with this name already exists' },
        });
      }

      // Validate that all referenced entities exist
      // Use parallel fetches for efficiency
      const orgIds = request.orgs;
      const classIds = request.classes;
      const groupIds = request.groups;
      const taskVariantIds = request.taskVariants.map((tv) => tv.taskVariantId);
      const agreementIds = request.agreements;

      // Verify orgs exist (districts and schools)
      // N.B. Orgs where rostering has ended are not returned and as such will cause a validation error.
      // Track district and school IDs separately for FGA tuple creation
      let districtIds: string[] = [];
      let schoolIds: string[] = [];
      if (orgIds.length > 0) {
        const { items: existingDistricts } = await districtRepository.listByIds(orgIds, {
          page: 1,
          perPage: orgIds.length,
        });
        const { items: existingSchools } = await schoolRepository.listByIds(orgIds, {
          page: 1,
          perPage: orgIds.length,
        });
        districtIds = existingDistricts.map((d) => d.id);
        schoolIds = existingSchools.map((s) => s.id);
        const existingOrgsIdSet = new Set([...districtIds, ...schoolIds]);
        const missingOrgs = orgIds.filter((orgId) => !existingOrgsIdSet.has(orgId));
        if (missingOrgs.length > 0) {
          throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
            context: { userId, missingOrgs },
          });
        }
      }

      // Verify classes exist
      // N.B. Classes where rostering has ended are not returned and as such will cause a validation error.
      if (classIds.length > 0) {
        const { items: existingClasses } = await classRepository.getByIds(classIds, {
          page: 1,
          perPage: classIds.length,
        });
        const existingClassIdSet = new Set(existingClasses.map((c) => c.id));
        const missingClasses = classIds.filter((id) => !existingClassIdSet.has(id));
        if (missingClasses.length > 0) {
          throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
            context: { userId, missingClasses },
          });
        }
      }

      // Verify groups exist
      // N.B. Groups where rostering has ended are not returned and as such will cause a validation error.
      if (groupIds.length > 0) {
        const { items: existingGroups } = await groupRepository.getByIds(groupIds, {
          page: 1,
          perPage: groupIds.length,
        });
        const existingGroupIdSet = new Set(existingGroups.map((g) => g.id));
        const missingGroups = groupIds.filter((id) => !existingGroupIdSet.has(id));
        if (missingGroups.length > 0) {
          throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
            context: { userId, missingGroups },
          });
        }
      }

      // Verify task variants exist
      const { items: existingTaskVariants } = await taskVariantRepository.getByIds(taskVariantIds, {
        page: 1,
        perPage: taskVariantIds.length,
      });
      const existingTaskVariantIdSet = new Set(existingTaskVariants.map((tv) => tv.id));
      const missingTaskVariants = taskVariantIds.filter((id) => !existingTaskVariantIdSet.has(id));
      if (missingTaskVariants.length > 0) {
        throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { userId, missingTaskVariants },
        });
      }

      // Verify all task variants are published (not draft or deprecated)
      const unpublishedTaskVariants = existingTaskVariants
        .filter((tv) => tv.status !== TaskVariantStatus.PUBLISHED)
        .map((tv) => tv.id);
      if (unpublishedTaskVariants.length > 0) {
        throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { userId, unpublishedTaskVariants },
        });
      }

      // Verify agreements exist
      if (agreementIds.length > 0) {
        const { items: existingAgreements } = await agreementRepository.getByIds(agreementIds, {
          page: 1,
          perPage: agreementIds.length,
        });
        const existingAgreementIdSet = new Set(existingAgreements.map((a) => a.id));
        const missingAgreements = agreementIds.filter((id) => !existingAgreementIdSet.has(id));
        if (missingAgreements.length > 0) {
          throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
            context: { userId, missingAgreements },
          });
        }
      }

      // Build the input for the repository
      // createdBy is set to the authenticated user's ID
      const createInput: CreateAdministrationInput = {
        administration: {
          name: request.name,
          namePublic: request.namePublic,
          description: request.description ?? '',
          dateStart,
          dateEnd,
          isOrdered: request.isOrdered ?? false,
          createdBy: userId,
        },
        orgIds,
        classIds,
        groupIds,
        taskVariants: request.taskVariants.map((tv) => ({
          taskVariantId: tv.taskVariantId,
          orderIndex: tv.orderIndex,
          conditionsAssignment: tv.conditionsEligibility ?? null,
          conditionsRequirements: tv.conditionsRequirement ?? null,
        })),
        agreementIds,
      };

      // Create the administration with all related entities in a single transaction
      const created = await administrationRepository.createWithAssignments(createInput);

      // Build FGA tuples for the administration assignments
      // These tuples enable FGA to resolve which users can access this administration
      const fgaTuples = [
        ...districtIds.map((districtId) => administrationDistrictTuple(created.id, districtId)),
        ...schoolIds.map((schoolId) => administrationSchoolTuple(created.id, schoolId)),
        ...classIds.map((classId) => administrationClassTuple(created.id, classId)),
        ...groupIds.map((groupId) => administrationGroupTuple(created.id, groupId)),
      ];

      // Write FGA tuples with compensation on failure (Saga pattern)
      // If FGA write fails, delete the DB record to maintain consistency
      try {
        await authorizationService.writeTuplesOrThrow(fgaTuples);
      } catch (fgaError) {
        logger.error(
          { err: fgaError, administrationId: created.id, tupleCount: fgaTuples.length },
          'FGA tuple write failed, compensating by deleting administration',
        );

        // Compensate: delete the administration record
        // Junction tables have ON DELETE CASCADE, so they'll be cleaned up automatically
        try {
          await administrationRepository.delete({ id: created.id });
          logger.info({ administrationId: created.id }, 'Compensation successful: administration deleted');
        } catch (deleteError) {
          // Compensation failed - log for manual intervention
          logger.error(
            { err: deleteError, administrationId: created.id },
            'Compensation failed: administration exists without FGA tuples. Manual intervention required.',
          );
        }

        // Re-throw the original FGA error
        throw new ApiError(ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          context: { userId, administrationId: created.id },
          cause: fgaError,
        });
      }

      logger.info({ userId, administrationId: created.id }, 'Administration created successfully');

      return created;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to create administration');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  return {
    verifyAdministrationAccess,
    list,
    getById,
    getAssignees,
    listTaskVariants,
    listAgreements,
    deleteById,
    getUserAdministrations,
    getTree,
    create,
    getUserAdministration,
  };
}
