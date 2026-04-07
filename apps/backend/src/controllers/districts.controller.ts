import { StatusCodes } from 'http-status-codes';
import type { DistrictWithEmbeds } from '../services/district/district.service';
import { DistrictService } from '../services/district/district.service';
import type { DistrictsListQuery, DistrictDetail as ApiDistrict, EnrolledUsersQuery } from '@roar-dashboard/api-contract';
import { DistrictEmbedOption } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';
import { handleSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';
const districtService = DistrictService();

/**
 * Maps a database District entity to the base API schema.
 * Converts Date fields to ISO strings and transforms location data to match the contract.
 */
function transformDistrictBase(district: DistrictWithEmbeds): ApiDistrict {
  // Transform PostgreSQL point to GeoJSON format if present
  let coordinates: { type: 'Point'; coordinates: [number, number] } | undefined;
  const { locationLatLong } = district;
  if (locationLatLong) {
    // PostgreSQL point type: { x: longitude, y: latitude }
    coordinates = {
      type: 'Point',
      coordinates: [locationLatLong.x, locationLatLong.y],
    };
  }

  // Build location object only if at least one field is present
  const location = {
    ...(district.locationAddressLine1 && { addressLine1: district.locationAddressLine1 }),
    ...(district.locationAddressLine2 && { addressLine2: district.locationAddressLine2 }),
    ...(district.locationCity && { city: district.locationCity }),
    ...(district.locationStateProvince && { stateProvince: district.locationStateProvince }),
    ...(district.locationPostalCode && { postalCode: district.locationPostalCode }),
    ...(district.locationCountry && { country: district.locationCountry }),
    ...(coordinates && { coordinates }),
  };

  // Build identifiers object only if at least one field is present
  const identifiers = {
    ...(district.mdrNumber && { mdrNumber: district.mdrNumber }),
    ...(district.ncesId && { ncesId: district.ncesId }),
    ...(district.stateId && { stateId: district.stateId }),
    ...(district.schoolNumber && { schoolNumber: district.schoolNumber }),
  };

  return {
    id: district.id,
    name: district.name,
    abbreviation: district.abbreviation,
    orgType: 'district' as const,
    parentOrgId: district.parentOrgId,
    ...(Object.keys(location).length > 0 && { location }),
    ...(Object.keys(identifiers).length > 0 && { identifiers }),
    isRosteringRootOrg: district.isRosteringRootOrg,
    ...(district.rosteringEnded && { rosteringEnded: district.rosteringEnded.toISOString() }),
  };
}

/**
 * Maps a database District entity to the full API schema, attaching
 * optional embed data (counts) when present.
 */
function transformDistrict(district: DistrictWithEmbeds): ApiDistrict {
  const result: ApiDistrict = transformDistrictBase(district);

  // Include counts if embedded
  if (district.counts) {
    result.counts = district.counts;
  }

  return result;
}

/**
 * DistrictsController
 *
 * Handles HTTP concerns for the /districts endpoints.
 * Calls DistrictService for business logic and formats responses.
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
      const embedCounts = embed?.includes(DistrictEmbedOption.COUNTS) ?? false;

      const result = await districtService.list(authContext, {
        page,
        perPage,
        sortBy,
        sortOrder,
        ...(includeEnded !== undefined && { includeEnded }),
        ...(embedCounts && { embedCounts }),
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
        return toErrorResponse(error, [StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * Get a single district by ID.
   *
   * Delegates to DistrictService for authorization and retrieval.
   *
   * @param authContext - User's authentication context
   * @param districtId - UUID of the district to retrieve
   */
  getById: async (authContext: AuthContext, districtId: string) => {
    try {
      const district = await districtService.getById(authContext, districtId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformDistrict(district),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Lists users in a district with pagination and filtering.
   * @param authContext The authentication context.
   * @param districtId The ID of the district.
   * @param query The query parameters for listing users.
   * @returns The list of users in the district.
   */
  listUsers: async (authContext: AuthContext, districtId: string, query: EnrolledUsersQuery) => {
    try {
      const result = await districtService.listUsers(authContext, districtId, query);
      return handleSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
