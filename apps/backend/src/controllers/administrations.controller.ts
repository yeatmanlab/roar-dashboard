import { StatusCodes } from 'http-status-codes';
import {
  AdministrationService,
  type AdministrationWithEmbeds,
} from '../services/administration/administration.service';
import type {
  AdministrationsListQuery,
  AdministrationDistrictsListQuery,
  AdministrationSchoolsListQuery,
  AdministrationClassesListQuery,
  AdministrationGroupsListQuery,
  AdministrationTaskVariantsListQuery,
  Administration as ContractAdministration,
  AdministrationBase as ContractAdministrationBase,
  AdministrationDistrict,
  AdministrationSchool,
  AdministrationClass,
  AdministrationGroup,
  AdministrationTaskVariantItem,
} from '@roar-dashboard/api-contract';
import type { Administration, Org, Class, Group } from '../db/schema';
import type { TaskVariantWithAssignment, AssignmentWithOptional } from '../repositories/administration.repository';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';

const administrationService = AdministrationService();

/**
 * Type guard to check if an assignment has the pre-evaluated optional flag.
 * Used to distinguish supervised role responses (with optional boolean) from
 * supervisory role responses (with raw conditions).
 */
function hasOptionalFlag(assignment: TaskVariantWithAssignment['assignment']): assignment is AssignmentWithOptional {
  return 'optional' in assignment && typeof (assignment as AssignmentWithOptional).optional === 'boolean';
}

/**
 * Maps a database Administration entity to the base API schema.
 * Converts Date fields to ISO strings and renames fields to match the contract.
 *
 * @param admin - The database Administration entity
 * @returns The API-formatted administration base object
 */
function transformAdministrationBase(admin: Administration): ContractAdministrationBase {
  return {
    id: admin.id,
    name: admin.name,
    publicName: admin.namePublic,
    dates: {
      start: admin.dateStart.toISOString(),
      end: admin.dateEnd.toISOString(),
      created: admin.createdAt.toISOString(),
    },
    isOrdered: admin.isOrdered,
  };
}

/**
 * Maps a database Administration entity to the full API schema, attaching
 * optional embed data (stats, tasks) when present.
 *
 * @param admin - The database Administration entity with optional embeds
 * @returns The API-formatted administration object with embedded data
 */
function transformAdministration(admin: AdministrationWithEmbeds): ContractAdministration {
  const result: ContractAdministration = transformAdministrationBase(admin);

  // Include stats if embedded
  if (admin.stats) {
    result.stats = admin.stats;
  }

  // Include tasks if embedded
  if (admin.tasks) {
    result.tasks = admin.tasks;
  }

  return result;
}

/**
 * Maps a database entity with id and name to the API schema.
 * Used for districts, schools, classes, and groups which share the same contract shape.
 *
 * @param entity - The database entity (Org, Class, or Group)
 * @returns The API-formatted object with id and name
 */
function toIdName(
  entity: Org | Class | Group,
): AdministrationDistrict | AdministrationSchool | AdministrationClass | AdministrationGroup {
  return {
    id: entity.id,
    name: entity.name,
  };
}

/**
 * Maps a TaskVariantWithAssignment (raw repository data) to the API response schema.
 *
 * Transforms the flat joined data from the repository into the nested structure
 * expected by the API contract (task and conditions as nested objects).
 *
 * For supervisory roles: conditions contains assigned_if and optional_if (raw conditions)
 * For supervised roles: conditions contains only optional (pre-evaluated boolean)
 *
 * @param item - The raw task variant data from the repository (variant, task, assignment)
 * @returns The API-formatted task variant item with nested task and conditions objects
 */
function toTaskVariantItem(item: TaskVariantWithAssignment): AdministrationTaskVariantItem {
  // Service guarantees: for supervised roles, assignment.optional is set;
  // for supervisory roles, assignment.optional is undefined
  if (hasOptionalFlag(item.assignment)) {
    // For supervised roles: return simplified conditions with pre-evaluated optional flag
    return {
      id: item.variant.id,
      name: item.variant.name,
      description: item.variant.description,
      orderIndex: item.assignment.orderIndex,
      task: {
        id: item.task.id,
        name: item.task.name,
        description: item.task.description,
        image: item.task.image,
        tutorialVideo: item.task.tutorialVideo,
      },
      conditions: {
        optional: item.assignment.optional,
      },
    };
  }

  // For supervisory roles: return full conditions for client-side evaluation
  return {
    id: item.variant.id,
    name: item.variant.name,
    description: item.variant.description,
    orderIndex: item.assignment.orderIndex,
    task: {
      id: item.task.id,
      name: item.task.name,
      description: item.task.description,
      image: item.task.image,
      tutorialVideo: item.task.tutorialVideo,
    },
    conditions: {
      assigned_if: item.assignment.conditionsAssignment as Record<string, unknown> | null,
      optional_if: item.assignment.conditionsRequirements as Record<string, unknown> | null,
    },
  };
}

/**
 * Builds a paginated response for sub-resource listing endpoints.
 * Defaults to toIdName mapper for orgs/classes/groups; requires explicit mapper for other types.
 */
function handleSubResourceResponse<T extends Org | Class | Group>(
  result: { items: T[]; totalItems: number },
  page: number,
  perPage: number,
): {
  status: typeof StatusCodes.OK;
  body: {
    data: {
      items: ReturnType<typeof toIdName>[];
      pagination: { page: number; perPage: number; totalItems: number; totalPages: number };
    };
  };
};
function handleSubResourceResponse<T, R>(
  result: { items: T[]; totalItems: number },
  page: number,
  perPage: number,
  mapItem: (item: T) => R,
): {
  status: typeof StatusCodes.OK;
  body: { data: { items: R[]; pagination: { page: number; perPage: number; totalItems: number; totalPages: number } } };
};
function handleSubResourceResponse<T, R>(
  result: { items: T[]; totalItems: number },
  page: number,
  perPage: number,
  mapItem?: (item: T) => R,
) {
  const mapper = mapItem ?? (toIdName as unknown as (item: T) => R);
  const items = result.items.map(mapper);
  const totalPages = Math.ceil(result.totalItems / perPage);

  return {
    status: StatusCodes.OK as const,
    body: {
      data: {
        items,
        pagination: {
          page,
          perPage,
          totalItems: result.totalItems,
          totalPages,
        },
      },
    },
  };
}

/**
 * Handles errors for sub-resource listing endpoints.
 * Converts ApiError to typed error response or re-throws unknown errors.
 */
function handleSubResourceError(error: unknown) {
  if (error instanceof ApiError) {
    return toErrorResponse(error, [StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
  }
  throw error;
}

/**
 * Handles HTTP concerns for the /administrations endpoints.
 *
 * Responsible for transforming service results into ts-rest responses
 * and mapping known ApiError status codes to typed error responses.
 * Business logic and authorization live in AdministrationService.
 */
export const AdministrationsController = {
  /**
   * Get a single administration by ID.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Returns the base administration representation (no embeds).
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration to retrieve
   */
  get: async (authContext: AuthContext, administrationId: string) => {
    try {
      const administration = await administrationService.getById(authContext, administrationId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformAdministrationBase(administration),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * List administrations with pagination, sorting, optional status filter, and embeds.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param query - Query parameters (pagination, sorting, status filter, embed options)
   */
  list: async (authContext: AuthContext, query: AdministrationsListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, embed, status } = query;

      const result = await administrationService.list(authContext, {
        page,
        perPage,
        sortBy,
        sortOrder,
        embed,
        ...(status && { status }),
      });

      // Transform to API response format
      const items = result.items.map(transformAdministration);

      const totalPages = Math.ceil(result.totalItems / perPage);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items,
            pagination: {
              page,
              perPage,
              totalItems: result.totalItems,
              totalPages,
            },
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * List districts assigned to an administration.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   * @param query - Query parameters (pagination, sorting)
   */
  listDistricts: async (
    authContext: AuthContext,
    administrationId: string,
    query: AdministrationDistrictsListQuery,
  ) => {
    try {
      const result = await administrationService.listDistricts(authContext, administrationId, query);
      return handleSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },

  /**
   * List schools assigned to an administration.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   * @param query - Query parameters (pagination, sorting)
   */
  listSchools: async (authContext: AuthContext, administrationId: string, query: AdministrationSchoolsListQuery) => {
    try {
      const result = await administrationService.listSchools(authContext, administrationId, query);
      return handleSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },

  /**
   * List classes assigned to an administration.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   * @param query - Query parameters (pagination, sorting)
   */
  listClasses: async (authContext: AuthContext, administrationId: string, query: AdministrationClassesListQuery) => {
    try {
      const result = await administrationService.listClasses(authContext, administrationId, query);
      return handleSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },

  /**
   * List groups assigned to an administration.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   * @param query - Query parameters (pagination, sorting)
   */
  listGroups: async (authContext: AuthContext, administrationId: string, query: AdministrationGroupsListQuery) => {
    try {
      const result = await administrationService.listGroups(authContext, administrationId, query);
      return handleSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },

  /**
   * List task variants assigned to an administration.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param administrationId - UUID of the administration
   * @param query - Query parameters (pagination, sorting)
   */
  listTaskVariants: async (
    authContext: AuthContext,
    administrationId: string,
    query: AdministrationTaskVariantsListQuery,
  ) => {
    try {
      const result = await administrationService.listTaskVariants(authContext, administrationId, query);
      return handleSubResourceResponse(result, query.page, query.perPage, toTaskVariantItem);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
