import { StatusCodes } from 'http-status-codes';
import { InvitationCodeService } from '../services/invitation-code/invitation-code.service';
import type {
  CreateGroupRequest,
  GroupDetail as ApiGroup,
  GroupsListQuery,
  InvitationCode as ApiInvitationCode,
  EnrolledUsersQuery,
} from '@roar-platform/api-contract';
import type { InvitationCode } from '../db/schema';
import type { Group } from '../repositories/group.repository';
import type { CreateGroupServiceInput } from '../services/group/group.service';
import { GroupService } from '../services/group/group.service';
import type { AuthContext } from '../types/auth-context';
import { ApiError } from '../errors/api-error';
import { handleUserSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';
import { isPresentString } from './utils/is-present';
import { toErrorResponse } from '../utils/to-error-response.util';

const invitationCodeService = InvitationCodeService();
const groupService = GroupService();

/**
 * Maps a database InvitationCode entity to the API schema.
 * Converts Date fields to ISO strings.
 */
function transformInvitationCode(invitationCode: InvitationCode): ApiInvitationCode {
  return {
    id: invitationCode.id,
    groupId: invitationCode.groupId,
    code: invitationCode.code,
    validFrom: invitationCode.validFrom.toISOString(),
    validTo: invitationCode.validTo?.toISOString() ?? null,
    dates: {
      created: invitationCode.createdAt.toISOString(),
      updated: invitationCode.updatedAt?.toISOString() ?? invitationCode.createdAt.toISOString(),
    },
  };
}

/**
 * Maps a database Group entity to the API schema.
 *
 * Converts Date fields to ISO strings and assembles the location object,
 * surfacing the persisted point as GeoJSON coordinates. Every field maps 1:1
 * to a `groups` table column — groups have no orgType, parentOrgId, or
 * identifiers.
 */
function transformGroup(group: Group): ApiGroup {
  // Transform PostgreSQL point to GeoJSON format if present.
  // The groups.locationLatLong column uses Drizzle's default point mode, which
  // surfaces the value as a [x, y] = [longitude, latitude] tuple — already the
  // GeoJSON coordinate order, so it can be passed through directly.
  let coordinates: { type: 'Point'; coordinates: [number, number] } | undefined;
  const { locationLatLong } = group;
  if (locationLatLong) {
    coordinates = {
      type: 'Point',
      coordinates: [locationLatLong[0], locationLatLong[1]],
    };
  }

  // Build the location object from the present fields. Null and empty-string
  // columns are treated as absent and omitted (see `isPresentString`).
  const location = {
    ...(isPresentString(group.locationAddressLine1) && { addressLine1: group.locationAddressLine1 }),
    ...(isPresentString(group.locationAddressLine2) && { addressLine2: group.locationAddressLine2 }),
    ...(isPresentString(group.locationCity) && { city: group.locationCity }),
    ...(isPresentString(group.locationStateProvince) && { stateProvince: group.locationStateProvince }),
    ...(isPresentString(group.locationPostalCode) && { postalCode: group.locationPostalCode }),
    ...(isPresentString(group.locationCountry) && { country: group.locationCountry }),
    ...(coordinates && { coordinates }),
  };

  return {
    id: group.id,
    name: group.name,
    abbreviation: group.abbreviation,
    groupType: group.groupType,
    ...(Object.keys(location).length > 0 && { location }),
    ...(group.rosteringEnded && { rosteringEnded: group.rosteringEnded.toISOString() }),
  };
}

/**
 * GroupsController
 *
 * Handles HTTP concerns for the /groups endpoints.
 * Calls services for business logic and formats responses.
 */
export const GroupsController = {
  /**
   * Create a new group.
   *
   * Restricted to super admins (enforced in GroupService). Returns the new
   * group id only.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param body - Request body with group fields
   */
  create: async (authContext: AuthContext, body: CreateGroupRequest) => {
    try {
      const serviceInput: CreateGroupServiceInput = {
        name: body.name,
        abbreviation: body.abbreviation,
        groupType: body.groupType,
        location: body.location,
      };

      const { id } = await groupService.create(authContext, serviceInput);

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
   * List groups with pagination and sorting.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param query - Query parameters including pagination and sorting
   * @returns Paginated list of groups transformed to API response format
   */
  list: async (authContext: AuthContext, query: GroupsListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, includeEnded } = query;

      const result = await groupService.list(authContext, {
        page,
        perPage,
        sortBy,
        sortOrder,
        ...(includeEnded !== undefined && { includeEnded }),
      });

      const items = result.items.map(transformGroup);

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
   * Get a single group by ID.
   *
   * Delegates to GroupService for authorization and retrieval.
   *
   * @param authContext - User's authentication context
   * @param groupId - UUID of the group to retrieve
   */
  getById: async (authContext: AuthContext, groupId: string) => {
    try {
      const group = await groupService.getById(authContext, groupId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformGroup(group),
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
   * Get the latest valid invitation code for a group.
   *
   * @param authContext - User's authentication context containing userId and super admin flag
   * @param groupId - Group UUID
   * @returns Invitation code transformed to API response format
   */
  getInvitationCode: async (authContext: AuthContext, groupId: string) => {
    try {
      const invitationCode = await invitationCodeService.getLatestValidByGroupId(authContext, groupId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformInvitationCode(invitationCode),
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
   * Lists users in a group with pagination and filtering.
   * @param authContext The authentication context.
   * @param groupId The ID of the group.
   * @param query The query parameters for listing users.
   * @returns The list of users in the group.
   */
  listUsers: async (authContext: AuthContext, groupId: string, query: EnrolledUsersQuery) => {
    try {
      const result = await groupService.listUsers(authContext, groupId, query);
      return handleUserSubResourceResponse(result, query.page, query.perPage);
    } catch (error) {
      return handleSubResourceError(error);
    }
  },
};
