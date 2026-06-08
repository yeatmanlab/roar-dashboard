import { StatusCodes } from 'http-status-codes';
import type {
  AddFamilyChildrenRequest,
  CreateFamilyRequest,
  EnrolledFamilyUsersQuery,
} from '@roar-platform/api-contract';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import type { AuthContext } from '../types/auth-context';
import type { AddFamilyChildrenServiceInput, CreateFamilyServiceInput } from '../services/family/family.service';
import { FamilyService } from '../services/family/family.service';
import { handleUserSubResourceResponse, handleSubResourceError } from './utils/enrolled-users.transform';

const familyService = FamilyService();

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
