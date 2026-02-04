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
  embed?: string; // Comma-separated embeds (e.g., 'counts')
}

/**
 * Aggregated counts for a district
 */
export interface ApiDistrictCounts {
  users: number;
  schools: number;
  classes: number;
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
  counts?: ApiDistrictCounts;
  children?: ApiDistrict[];
}

/**
 * Transform a database district to the API response format.
 */
function transformDistrict(district: DistrictWithEmbeds): ApiDistrict {
  // Transform PostgreSQL point to GeoJSON format if present
  let coordinates: { type: 'Point'; coordinates: [number, number] } | undefined;
  if (district.locationLatLong) {
    const point = district.locationLatLong as unknown as { x: number; y: number };
    coordinates = {
      type: 'Point',
      coordinates: [point.x, point.y], // [longitude, latitude]
    };
  }

  const result: ApiDistrict = {
    id: district.id,
    name: district.name,
    abbreviation: district.abbreviation,
    orgType: district.orgType,
    parentOrgId: district.parentOrgId,
    location: {
      ...(district.locationAddressLine1 && { addressLine1: district.locationAddressLine1 }),
      ...(district.locationAddressLine2 && { addressLine2: district.locationAddressLine2 }),
      ...(district.locationCity && { city: district.locationCity }),
      ...(district.locationStateProvince && { stateProvince: district.locationStateProvince }),
      ...(district.locationPostalCode && { postalCode: district.locationPostalCode }),
      ...(district.locationCountry && { country: district.locationCountry }),
      ...(coordinates && { coordinates }),
    },
    identifiers: {
      ...(district.mdrNumber && { mdrNumber: district.mdrNumber }),
      ...(district.ncesId && { ncesId: district.ncesId }),
      ...(district.stateId && { stateId: district.stateId }),
      ...(district.schoolNumber && { schoolNumber: district.schoolNumber }),
    },
    dates: {
      created: district.createdAt.toISOString(),
      updated: district.updatedAt?.toISOString() ?? district.createdAt.toISOString(),
    },
    isRosteringRootOrg: district.isRosteringRootOrg,
  };

  if (district.rosteringEnded) {
    result.rosteringEnded = district.rosteringEnded.toISOString();
  }

  if (district.counts) {
    result.counts = district.counts;
  }

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
    const { page, perPage, sortBy, sortOrder, includeEnded, embed } = query;

    // Parse embed parameter
    const embeds = embed ? embed.split(',').map((e) => e.trim()) : [];
    const embedCounts = embeds.includes('counts');

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

  /**
   * Get a single district by ID.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param id - District ID (UUID)
   * @param query - Query parameters for embeds
   * @returns Single district transformed to API response format
   */
  getById: async (authContext: AuthContext, id: string, query: { embed?: string }) => {
    const { embed } = query;

    // Parse embed parameter
    const embeds = embed ? embed.split(',').map((e) => e.trim()) : [];
    const embedChildren = embeds.includes('children');

    const district = await districtService.getById(authContext, id, { embedChildren });

    if (!district) {
      return {
        status: StatusCodes.NOT_FOUND as const,
        body: {
          error: {
            message: 'District not found or access denied',
            code: 'DISTRICT_NOT_FOUND',
          },
        },
      };
    }

    return {
      status: StatusCodes.OK as const,
      body: {
        data: transformDistrict(district),
      },
    };
  },
};
