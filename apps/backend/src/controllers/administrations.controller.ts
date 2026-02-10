import { StatusCodes } from 'http-status-codes';
import {
  AdministrationService,
  type AdministrationWithEmbeds,
} from '../services/administration/administration.service';
import type {
  AdministrationsListQuery,
  AdministrationDistrictsListQuery,
  Administration as ApiAdministration,
  AdministrationBase as ApiAdministrationBase,
  District as ApiDistrict,
} from '@roar-dashboard/api-contract';
import type { Administration, Org } from '../db/schema';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';

const administrationService = AdministrationService();

/**
 * Maps a database Administration entity to the base API schema.
 * Converts Date fields to ISO strings and renames fields to match the contract.
 *
 * @param admin - The database Administration entity
 * @returns The API-formatted administration base object
 */
function transformAdministrationBase(admin: Administration): ApiAdministrationBase {
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
function transformAdministration(admin: AdministrationWithEmbeds): ApiAdministration {
  const result: ApiAdministration = transformAdministrationBase(admin);

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
 * Maps a database Org entity to the District API schema.
 *
 * @param org - The database Org entity (must be orgType='district')
 * @returns The API-formatted district object
 */
function transformDistrict(org: Org): ApiDistrict {
  return {
    id: org.id,
    name: org.name,
  };
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
      const { page, perPage, sortBy, sortOrder } = query;

      const result = await administrationService.listDistricts(authContext, administrationId, {
        page,
        perPage,
        sortBy,
        sortOrder,
      });

      // Transform to API response format
      const items = result.items.map(transformDistrict);

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
        return toErrorResponse(error, [
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
