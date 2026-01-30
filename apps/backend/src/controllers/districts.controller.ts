import { StatusCodes } from 'http-status-codes';
import { DistrictService, type DistrictWithEmbeds } from '../services/district/district.service';

const districtService = DistrictService();

/**
 * Auth context passed from middleware.
 */
interface AuthContext {
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * Query parameters for districts list endpoint
 */
export interface DistrictsListQuery {
  page: number;
  perPage: number;
  sortBy: 'name' | 'abbreviation' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  includeEnded?: boolean;
}

/**
 * API response format for a district
 */
export interface ApiDistrict {
  id: string;
  name: string;
  abbreviation: string;
  orgType: string;
  parentOrgId: string | null;
  location?: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number]; // [longitude, latitude]
    };
  };
  identifiers?: {
    mdrNumber?: string;
    ncesId?: string;
    stateId?: string;
    schoolNumber?: string;
  };
  dates: {
    created: string;
    updated: string;
  };
  isRosteringRootOrg: boolean;
  rosteringEnded?: string;
  children?: ApiDistrict[];
}

/**
 * Transform a database district to the API response format.
 */
function transformDistrict(district: DistrictWithEmbeds): ApiDistrict {
  const result: ApiDistrict = {
    id: district.id,
    name: district.name,
    abbreviation: district.abbreviation,
    orgType: district.orgType,
    parentOrgId: district.parentOrgId,
    dates: {
      created: district.createdAt.toISOString(),
      updated: district.updatedAt.toISOString(),
    },
    isRosteringRootOrg: district.isRosteringRootOrg,
  };

  // Include location if any location field is present
  if (
    district.locationAddressLine1 ||
    district.locationCity ||
    district.locationStateProvince ||
    district.locationLatLong
  ) {
    result.location = {
      ...(district.locationAddressLine1 && { addressLine1: district.locationAddressLine1 }),
      ...(district.locationAddressLine2 && { addressLine2: district.locationAddressLine2 }),
      ...(district.locationCity && { city: district.locationCity }),
      ...(district.locationStateProvince && { stateProvince: district.locationStateProvince }),
      ...(district.locationPostalCode && { postalCode: district.locationPostalCode }),
      ...(district.locationCountry && { country: district.locationCountry }),
    };

    // Transform PostgreSQL point to GeoJSON format
    if (district.locationLatLong) {
      const { x, y } = district.locationLatLong;
      result.location.coordinates = {
        type: 'Point',
        coordinates: [x, y], // [longitude, latitude]
      };
    }
  }

  // Include identifiers if any are present
  if (district.mdrNumber || district.ncesId || district.stateId || district.schoolNumber) {
    result.identifiers = {
      ...(district.mdrNumber && { mdrNumber: district.mdrNumber }),
      ...(district.ncesId && { ncesId: district.ncesId }),
      ...(district.stateId && { stateId: district.stateId }),
      ...(district.schoolNumber && { schoolNumber: district.schoolNumber }),
    };
  }

  // Include rosteringEnded if set
  if (district.rosteringEnded) {
    result.rosteringEnded = district.rosteringEnded.toISOString();
  }

  // Include children if embedded
  if (district.children) {
    result.children = district.children.map(transformDistrict);
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
    const { page, perPage, sortBy, sortOrder, includeEnded } = query;

    const result = await districtService.list(authContext, {
      page,
      perPage,
      sortBy,
      sortOrder,
      ...(includeEnded !== undefined && { includeEnded }),
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
