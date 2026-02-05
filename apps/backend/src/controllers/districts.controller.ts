import { StatusCodes } from 'http-status-codes';
import { DistrictService, type DistrictWithEmbeds } from '../services/district/district.service';
import type {
  DistrictsListQuery,
  District as ApiDistrict,
  DistrictBase as ApiDistrictBase,
} from '@roar-dashboard/api-contract';

const districtService = DistrictService();

/**
 * Auth context passed from middleware.
 */
interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * Maps a database District entity to the base API schema.
 * Converts Date fields to ISO strings and transforms location data to match the contract.
 */
function transformDistrictBase(district: DistrictWithEmbeds): ApiDistrictBase {
  // Transform PostgreSQL point to GeoJSON format if present
  let coordinates: { type: 'Point'; coordinates: [number, number] } | undefined;
  if (district.locationLatLong) {
    const point = district.locationLatLong as unknown as { x: number; y: number };
    coordinates = {
      type: 'Point',
      coordinates: [point.x, point.y], // [longitude, latitude]
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
    orgType: district.orgType,
    parentOrgId: district.parentOrgId,
    ...(Object.keys(location).length > 0 && { location }),
    ...(Object.keys(identifiers).length > 0 && { identifiers }),
    dates: {
      created: district.createdAt.toISOString(),
      updated: district.updatedAt?.toISOString() ?? district.createdAt.toISOString(),
    },
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
  },
};
