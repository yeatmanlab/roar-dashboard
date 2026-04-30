import { StatusCodes } from 'http-status-codes';
import type { CreateDistrictServiceInput, DistrictWithEmbeds } from '../services/district/district.service';
import type { SchoolWithCounts } from '../repositories/school.repository';
import { DistrictService } from '../services/district/district.service';
import type {
  CreateDistrictRequest,
  DistrictsListQuery,
  DistrictDetail as ApiDistrict,
  DistrictSchoolsListQuery,
  DistrictSchoolsListResponse,
  EnrolledUsersQuery,
} from '@roar-dashboard/api-contract';
import { DistrictEmbedOption, DistrictSchoolEmbedOption } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';
import { handleUserSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';
import { OrgType } from '../enums/org-type.enum';
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
    orgType: OrgType.DISTRICT,
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
   * Create a new district.
   *
   * Restricted to super admins (enforced in DistrictService).
   * Returns the new district id only — clients that need the full entity
   * should follow up with GET /districts/:id.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param body - Request body with district fields
   */
  create: async (authContext: AuthContext, body: CreateDistrictRequest) => {
    try {
      // Map api-contract body to the service input shape:
      //   - drop `location.coordinates` (not in scope for create; only address fields)
      //   - field-by-field rather than spread to satisfy exactOptionalPropertyTypes
      //     (Zod's inferred optional fields are T | undefined; the service interface
      //     uses ?: T)
      const serviceInput: CreateDistrictServiceInput = {
        name: body.name,
        abbreviation: body.abbreviation,
        ...(body.location && {
          location: {
            ...(body.location.addressLine1 !== undefined && { addressLine1: body.location.addressLine1 }),
            ...(body.location.addressLine2 !== undefined && { addressLine2: body.location.addressLine2 }),
            ...(body.location.city !== undefined && { city: body.location.city }),
            ...(body.location.stateProvince !== undefined && { stateProvince: body.location.stateProvince }),
            ...(body.location.postalCode !== undefined && { postalCode: body.location.postalCode }),
            ...(body.location.country !== undefined && { country: body.location.country }),
          },
        }),
        ...(body.identifiers && {
          identifiers: {
            ...(body.identifiers.mdrNumber !== undefined && { mdrNumber: body.identifiers.mdrNumber }),
            ...(body.identifiers.ncesId !== undefined && { ncesId: body.identifiers.ncesId }),
            ...(body.identifiers.stateId !== undefined && { stateId: body.identifiers.stateId }),
            ...(body.identifiers.schoolNumber !== undefined && { schoolNumber: body.identifiers.schoolNumber }),
          },
        }),
      };

      const { id } = await districtService.create(authContext, serviceInput);

      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: { id },
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
   * List schools within a district with pagination and sorting.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param districtId - UUID of the district
   * @param query - Query parameters including pagination and sorting
   * @returns Paginated list of schools transformed to API response format
   */
  listSchools: async (authContext: AuthContext, districtId: string, query: DistrictSchoolsListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, includeEnded, embed } = query;

      // Check if counts embed is requested
      const embedCounts = embed?.includes(DistrictSchoolEmbedOption.COUNTS) ?? false;

      const result = await districtService.listDistrictSchools(authContext, districtId, {
        page,
        perPage,
        sortBy,
        sortOrder,
        ...(includeEnded !== undefined && { includeEnded }),
        ...(embedCounts && { embedCounts }),
      });

      // Transform to API response format
      const items = result.items.map(transformSchool);

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
      const { page, perPage } = query;

      const result = await districtService.listUsers(authContext, districtId, query);
      return handleUserSubResourceResponse(result, page, perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};

/** Single school item type from the paginated response. */
type ApiDistrictSchool = DistrictSchoolsListResponse['items'][number];

/**
 * Maps a database School entity to the API schema.
 * Converts Date fields to ISO strings and transforms location data to match the contract.
 */
function transformSchool(school: SchoolWithCounts): ApiDistrictSchool {
  // Transform PostgreSQL point to GeoJSON format if present
  let coordinates: { type: 'Point'; coordinates: [number, number] } | undefined;
  if (school.locationLatLong) {
    // PostgreSQL point type: { x: longitude, y: latitude }
    coordinates = {
      type: 'Point',
      coordinates: [school.locationLatLong.x, school.locationLatLong.y],
    };
  }

  // Build location object only if at least one field is present
  const location = {
    ...(school.locationAddressLine1 && { addressLine1: school.locationAddressLine1 }),
    ...(school.locationAddressLine2 && { addressLine2: school.locationAddressLine2 }),
    ...(school.locationCity && { city: school.locationCity }),
    ...(school.locationStateProvince && { stateProvince: school.locationStateProvince }),
    ...(school.locationPostalCode && { postalCode: school.locationPostalCode }),
    ...(school.locationCountry && { country: school.locationCountry }),
    ...(coordinates && { coordinates }),
  };

  // Build identifiers object only if at least one field is present
  const identifiers = {
    ...(school.mdrNumber && { mdrNumber: school.mdrNumber }),
    ...(school.ncesId && { ncesId: school.ncesId }),
    ...(school.stateId && { stateId: school.stateId }),
    ...(school.schoolNumber && { schoolNumber: school.schoolNumber }),
  };

  const result: ApiDistrictSchool = {
    id: school.id,
    name: school.name,
    abbreviation: school.abbreviation,
    orgType: OrgType.SCHOOL,
    parentOrgId: school.parentOrgId,
    ...(Object.keys(location).length > 0 && { location }),
    ...(Object.keys(identifiers).length > 0 && { identifiers }),
    ...(school.rosteringEnded && { rosteringEnded: school.rosteringEnded.toISOString() }),
    ...(school.counts && { counts: school.counts }),
  };

  return result;
}
