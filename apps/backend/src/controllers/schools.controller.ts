import { StatusCodes } from 'http-status-codes';
import { SchoolService, type SchoolWithEmbeds } from '../services/school/school.service';
import type { SchoolsListQuery, SchoolDetail as ApiSchool } from '@roar-dashboard/api-contract';
import { SchoolEmbedOption } from '@roar-dashboard/api-contract';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';
import type { PostgreSQLPoint } from '../types/postgres';

const schoolService = SchoolService();

/**
 * Maps a database School entity to the base API schema.
 * Converts Date fields to ISO strings and transforms location data to match the contract.
 */
function transformSchoolBase(school: SchoolWithEmbeds): ApiSchool {
  // Transform PostgreSQL point to GeoJSON format if present
  let coordinates: { type: 'Point'; coordinates: [number, number] } | undefined;
  if (school.locationLatLong) {
    const point = school.locationLatLong as unknown as PostgreSQLPoint;
    coordinates = {
      type: 'Point',
      coordinates: [point.x, point.y], // [longitude, latitude]
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

  return {
    id: school.id,
    name: school.name,
    abbreviation: school.abbreviation,
    orgType: 'school' as const,
    parentOrgId: school.parentOrgId,
    ...(Object.keys(location).length > 0 && { location }),
    ...(Object.keys(identifiers).length > 0 && { identifiers }),
    isRosteringRootOrg: school.isRosteringRootOrg,
  };
}

/**
 * Maps a database School entity to the full API schema, attaching
 * optional embed data (counts) when present.
 */
function transformSchool(school: SchoolWithEmbeds): ApiSchool {
  const result: ApiSchool = transformSchoolBase(school);

  // Include counts if embedded
  if (school.counts) {
    result.counts = school.counts;
  }

  return result;
}

/**
 * SchoolsController
 *
 * Handles HTTP concerns for the /schools endpoints.
 * Calls SchoolService for business logic and formats responses.
 */
export const SchoolsController = {
  /**
   * List schools with pagination and sorting.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param query - Query parameters including pagination and sorting
   * @returns Paginated list of schools transformed to API response format
   */
  list: async (authContext: AuthContext, query: SchoolsListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, includeEnded, embed } = query;

      // Check if counts embed is requested
      const embedCounts = embed?.includes(SchoolEmbedOption.COUNTS) ?? false;

      const result = await schoolService.list(authContext, {
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
        return toErrorResponse(error, [StatusCodes.FORBIDDEN, StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  /**
   * Get a single school by ID.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param schoolId - UUID of the school to retrieve
   * @param query - Query parameters including embed options
   * @returns School data transformed to API response format
   */
  getById: async (authContext: AuthContext, schoolId: string, query?: { embed?: string[] }) => {
    try {
      // Check if children embed is requested
      const embedChildren = query?.embed?.includes(SchoolEmbedOption.CHILDREN) ?? false;

      const school = await schoolService.getById(authContext, schoolId, { embedChildren });

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformSchool(school),
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
