import { StatusCodes } from 'http-status-codes';
import { DistrictService, type DistrictWithEmbeds } from '../services/district/district.service';
import type {
  DistrictsListQuery,
  DistrictGetQuery,
  DistrictDetail as ApiDistrictDetail,
  Organization as ApiOrganization,
} from '@roar-dashboard/api-contract';
import type { Org } from '../db/schema';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';

const districtService = DistrictService();

/**
 * Maps a database Org entity to the Organization API schema.
 *
 * @param org - The database Org entity
 * @returns The API-formatted organization object
 */
function transformOrganization(org: Org): ApiOrganization {
  return {
    id: org.id,
    name: org.name,
    abbreviation: org.abbreviation,
    orgType: org.orgType,
    parentOrgId: org.parentOrgId,
    location:
      org.locationAddressLine1 || org.locationCity || org.locationLatLong
        ? {
            addressLine1: org.locationAddressLine1 ?? undefined,
            addressLine2: org.locationAddressLine2 ?? undefined,
            city: org.locationCity ?? undefined,
            stateProvince: org.locationStateProvince ?? undefined,
            postalCode: org.locationPostalCode ?? undefined,
            country: org.locationCountry ?? undefined,
            coordinates: org.locationLatLong
              ? {
                  type: 'Point' as const,
                  coordinates: org.locationLatLong, // [longitude, latitude]
                }
              : undefined,
          }
        : undefined,
    identifiers:
      org.mdrNumber || org.ncesId || org.stateId || org.schoolNumber
        ? {
            mdrNumber: org.mdrNumber ?? undefined,
            ncesId: org.ncesId ?? undefined,
            stateId: org.stateId ?? undefined,
            schoolNumber: org.schoolNumber ?? undefined,
          }
        : undefined,
    dates: {
      created: org.createdAt.toISOString(),
      updated: (org.updatedAt ?? org.createdAt).toISOString(),
    },
    isRosteringRootOrg: org.isRosteringRootOrg,
    rosteringEnded: org.rosteringEnded?.toISOString(),
  };
}

/**
 * Maps a database District entity with embeds to the full API schema.
 *
 * @param district - The database District entity with optional embeds
 * @returns The API-formatted district detail object
 */
function transformDistrictDetail(district: DistrictWithEmbeds): ApiDistrictDetail {
  const result: ApiDistrictDetail = transformOrganization(district);

  // Include counts if embedded
  if (district.counts) {
    result.counts = district.counts;
  }

  // Include children if embedded
  if (district.children) {
    result.children = district.children.map(transformOrganization);
  }

  return result;
}

/**
 * Handles HTTP concerns for the /districts endpoints.
 *
 * Responsible for transforming service results into ts-rest responses
 * and mapping known ApiError status codes to typed error responses.
 * Business logic and authorization live in DistrictService.
 */
export const DistrictsController = {
  /**
   * List districts with pagination and sorting.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param query - Query parameters including pagination and sorting
   * @returns Paginated list of districts transformed to API response format
   */
  list: async (authContext: AuthContext, query: DistrictsListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, includeEnded, embed } = query;

      // Check if counts embed is requested
      const embedCounts = embed?.includes('counts') ?? false;

      const result = await districtService.list(authContext, {
        page,
        perPage,
        sortBy,
        sortOrder,
        ...(includeEnded !== undefined && { includeEnded }),
        ...(embedCounts && { embedCounts }),
      });

      // Transform to API response format
      const items = result.items.map(transformDistrictDetail);

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
        return toErrorResponse(error, [StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * Get a single district by ID with optional embeds.
   *
   * Delegates to DistrictService for authorization and retrieval.
   *
   * @param authContext - User's authentication context
   * @param districtId - UUID of the district to retrieve
   * @param query - Query parameters (embed options)
   */
  getById: async (authContext: AuthContext, districtId: string, query: DistrictGetQuery) => {
    try {
      const embedChildren = query.embed?.includes('children') ?? false;

      const district = await districtService.getById(districtId, authContext, {
        embedChildren,
      });

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformDistrictDetail(district),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
