import { StatusCodes } from 'http-status-codes';
import type {
  AddFamilyChildrenRequest,
  CreateFamilyRequest,
  EnrolledFamilyUsersQuery,
  FamilyDetail as ApiFamily,
} from '@roar-platform/api-contract';
import type { Family } from '../db/schema';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';
import type { AddFamilyChildrenServiceInput, CreateFamilyServiceInput } from '../services/family/family.service';
import { FamilyService } from '../services/family/family.service';
import { handleUserSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';

const familyService = FamilyService();

/**
 * Maps a database Family entity to the API schema.
 *
 * Converts Date fields to ISO strings and assembles the location object,
 * surfacing the persisted point as GeoJSON coordinates. Families have no
 * name/abbreviation/groupType — they are identified by UUID. `createdBy` and
 * the timestamps columns are intentionally not surfaced. Nullable fields
 * (`location`, `rosteringEnded`) are omitted from the response when absent.
 */
function transformFamily(family: Family): ApiFamily {
  // Transform PostgreSQL point to GeoJSON format if present.
  // The families.locationLatLong column uses Drizzle's default point mode, which
  // surfaces the value as a [x, y] = [longitude, latitude] tuple — already the
  // GeoJSON coordinate order, so it can be passed through directly.
  let coordinates: { type: 'Point'; coordinates: [number, number] } | undefined;
  const { locationLatLong } = family;
  if (locationLatLong) {
    coordinates = {
      type: 'Point',
      coordinates: [locationLatLong[0], locationLatLong[1]],
    };
  }

  // Build location object only if at least one field is present
  const location = {
    ...(family.locationAddressLine1 && { addressLine1: family.locationAddressLine1 }),
    ...(family.locationAddressLine2 && { addressLine2: family.locationAddressLine2 }),
    ...(family.locationCity && { city: family.locationCity }),
    ...(family.locationStateProvince && { stateProvince: family.locationStateProvince }),
    ...(family.locationPostalCode && { postalCode: family.locationPostalCode }),
    ...(family.locationCountry && { country: family.locationCountry }),
    ...(coordinates && { coordinates }),
  };

  return {
    id: family.id,
    ...(Object.keys(location).length > 0 && { location }),
    ...(family.rosteringEnded && { rosteringEnded: family.rosteringEnded.toISOString() }),
  };
}

/**
 * FamiliesController
 *
 * Handles HTTP concerns for the /families endpoints.
 * Calls services for business logic and formats responses.
 */
export const FamiliesController = {
  /**
   * Register a new caretaker and create their family (ROAR@Home self-signup).
   *
   * Public endpoint — no `AuthContext` is required or available since the caretaker has no
   * identity yet at the point of this call. The service layer enforces the only safety
   * guarantees that matter for this endpoint (email uniqueness, one-family-per-caretaker).
   *
   * @param body Caretaker credentials + name + optional family location
   */
  create: async (body: CreateFamilyRequest) => {
    try {
      const serviceInput: CreateFamilyServiceInput = {
        email: body.email,
        password: body.password,
        name: body.name,
        location: body.location,
      };

      const { id } = await familyService.create(serviceInput);

      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: { id },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.CONFLICT,
          StatusCodes.UNPROCESSABLE_ENTITY,
          StatusCodes.TOO_MANY_REQUESTS,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Get a single family by ID.
   *
   * Delegates to FamilyService for authorization and retrieval. Access is
   * caretaker-only — only the family's parent (caretaker) or a super admin may
   * read it; everyone else receives 403.
   *
   * @param authContext - User's authentication context
   * @param familyId - UUID of the family to retrieve
   */
  getById: async (authContext: AuthContext, familyId: string) => {
    try {
      const family = await familyService.getById(authContext, familyId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformFamily(family),
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
   * Add one or more children to an existing family.
   *
   * Authenticated endpoint — the caller must be a parent of `:familyId` or a super admin.
   * Authorization is enforced in the service layer.
   *
   * @param authContext Requesting user's auth context (parent or super admin)
   * @param familyId Target family id (from the URL path)
   * @param body Children to add
   */
  addChildren: async (authContext: AuthContext, familyId: string, body: AddFamilyChildrenRequest) => {
    try {
      const serviceInput: AddFamilyChildrenServiceInput = {
        children: body.children,
      };

      const { ids } = await familyService.addChildren(authContext, familyId, serviceInput);

      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: { ids },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.CONFLICT,
          StatusCodes.UNPROCESSABLE_ENTITY,
          StatusCodes.TOO_MANY_REQUESTS,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Lists users in a family with pagination and filtering.
   * @param authContext The authentication context.
   * @param familyId The ID of the family.
   * @param query The query parameters for listing users.
   * @returns The list of users in the family.
   */
  listUsers: async (authContext: AuthContext, familyId: string, query: EnrolledFamilyUsersQuery) => {
    try {
      const { page, perPage } = query;

      const result = await familyService.listUsers(authContext, familyId, query);
      return handleUserSubResourceResponse(result, page, perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
