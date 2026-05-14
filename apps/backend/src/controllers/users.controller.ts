import type { AuthContext } from '../types/auth-context';
import type { User } from '../db/schema';
import type {
  UserResponse,
  CreateUserRequestBody,
  UpdateUserRequestBody,
  RecordUserAgreementRequestBody,
  GuardianStudentReportResponse,
  AdministrationsListQuery,
} from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { UserService } from '../services/user';
import { ReportService } from '../services/report/report.service';
import type { GuardianStudentReportResult } from '../services/report/report.types';
import { AdministrationService } from '../services/administration/administration.service';
import { ApiError } from '../errors/api-error';
import { toErrorResponse } from '../utils/to-error-response.util';
import { transformAdministration, transformAdministrationBase } from './utils/administration.transform';

const userService = UserService();
const administrationService = AdministrationService();
const reportService = ReportService();

/**
 * Transform a User database record into a UserResponse API schema.
 * Converts Date objects to ISO datetime strings as required by the API contract.
 *
 * Security: isSuperAdmin is only included when the requesting user is a super admin.
 *
 * @param user - User record from the database
 * @param authContext - Requesting user's authentication context
 * @returns UserResponse with Date fields converted to strings
 */
function toUserResponse(user: User, authContext: AuthContext): UserResponse {
  return {
    id: user.id,
    assessmentPid: user.assessmentPid,
    authProvider: user.authProvider ?? [],
    nameFirst: user.nameFirst,
    nameMiddle: user.nameMiddle,
    nameLast: user.nameLast,
    username: user.username,
    email: user.email,
    userType: user.userType,
    dob: user.dob, // Already a date string (YYYY-MM-DD) from the database
    grade: user.grade,
    schoolLevel: user.schoolLevel,
    statusEll: user.statusEll,
    statusFrl: user.statusFrl,
    statusIep: user.statusIep,
    studentId: user.studentId,
    sisId: user.sisId,
    stateId: user.stateId,
    localId: user.localId,
    gender: user.gender,
    race: user.race,
    hispanicEthnicity: user.hispanicEthnicity,
    homeLanguage: user.homeLanguage,
    ...(authContext.isSuperAdmin && { isSuperAdmin: user.isSuperAdmin }),
    rosteringEnded: user.rosteringEnded?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt?.toISOString() ?? null,
  };
}

/**
 * Handles HTTP concerns for the /users endpoints.
 *
 * Responsible for transforming service results into ts-rest responses
 * and mapping known ApiError status codes to typed error responses.
 * Business logic and authorization are delegated to the UserService.
 *
 * Error status codes shared across multiple methods are listed here for reference:
 * - 401: Unauthenticated (handled by AuthGuardMiddleware before reaching the controller)
 * - 403: Forbidden (user lacks permission)
 * - 404: User not found
 * - 500: Unexpected internal error
 */
export const UsersController = {
  /**
   * Get a single user by ID.
   *
   * Delegates to the UserService for authorization and retrieval.
   *
   * @param authContext - Requesting user's authentication context.
   * @param userId - UUID of the user to retrieve.
   */
  get: async (authContext: AuthContext, userId: string) => {
    try {
      const user = await userService.getById(authContext, userId);
      return {
        status: StatusCodes.OK as const,
        body: {
          data: toUserResponse(user, authContext),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.UNAUTHORIZED,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Create a new user.
   * This endpoint should be used when creating a single user with specific profile information and memberships.
   *
   * @param authContext - Requesting user's authentication context.
   * @param body - User creation request body.
   */
  create: async (authContext: AuthContext, body: CreateUserRequestBody) => {
    try {
      const { id } = await userService.create(authContext, body);
      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: { id },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.UNAUTHORIZED,
          StatusCodes.FORBIDDEN,
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
   * Partially update a user by ID.
   *
   * Only fields present in the request body are updated.
   * Delegates to UserService for authorization and the update operation.
   * Returns 204 No Content on success — use GET if the updated resource is needed.
   *
   * @param authContext - Requesting user's authentication context.
   * @param userId - UUID of the user to update.
   * @param body - Partial user fields to apply.
   */
  update: async (authContext: AuthContext, userId: string, body: UpdateUserRequestBody) => {
    try {
      await userService.update(authContext, userId, body);
      return {
        status: StatusCodes.NO_CONTENT as const,
        body: undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.UNAUTHORIZED,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.CONFLICT,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Record a user agreement (record consent).
   *
   * Records a user's consent to a specific agreement version.
   * Supports both self-consent and guardian consent for family members.
   * Delegates to UserService for authorization and the create operation.
   *
   * @param authContext - Requesting user's authentication context.
   * @param userId - UUID of the user who is consenting.
   * @param body - Agreement version ID and optional consenting user ID.
   */
  recordUserAgreement: async (authContext: AuthContext, userId: string, body: RecordUserAgreementRequestBody) => {
    try {
      const { id } = await userService.recordUserAgreement(authContext, userId, body);

      return {
        status: StatusCodes.CREATED as const,
        body: {
          data: { id },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.UNAUTHORIZED,
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.CONFLICT,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * List specified user's administrations with pagination, sorting, optional status filter, and embeds.
   *
   * Delegates to AdministrationService for authorization and retrieval.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param userId - UUID of the user whose administrations to list
   * @param query - Query parameters (pagination, sorting, status filter, embed options)
   */
  listUserAdministrations: async (authContext: AuthContext, userId: string, query: AdministrationsListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, embed, status } = query;

      const result = await administrationService.getUserAdministrations(authContext, userId, {
        page,
        perPage,
        sortBy,
        sortOrder,
        embed,
        ...(status && { status }),
      });

      // Transform to API response format
      const items = result.items.map(transformAdministration);

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
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  /**
   * Get a specific administration for a user.
   * Transforms database entities to the API response format.
   *
   * @param authContext - User's authentication context
   * @param userId - UUID of the user
   * @param administrationId - UUID of the administration
   * @returns Administration data
   */
  getUserAdministration: async (authContext: AuthContext, userId: string, administrationId: string) => {
    try {
      const administration = await administrationService.getUserAdministration(authContext, userId, administrationId);

      return {
        status: StatusCodes.OK as const,
        body: {
          data: transformAdministrationBase(administration),
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
   * Get a longitudinal student score report for a guardian or supervisory caller.
   *
   * Authorization is delegated to ReportService.getGuardianStudentReport — the
   * controller only maps the typed `ApiError` failures back into ts-rest
   * responses. The endpoint accepts no query parameters; the response shape
   * mirrors the API contract exactly (the service already returns dates as
   * ISO strings), so transformation is a near-identity.
   *
   * @param authContext - Requesting user's authentication context
   * @param userId - UUID of the target student
   */
  getGuardianStudentReport: async (authContext: AuthContext, userId: string) => {
    try {
      const result = await reportService.getGuardianStudentReport(authContext, userId);
      return {
        status: StatusCodes.OK as const,
        body: {
          data: toGuardianStudentReportResponse(result),
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        // The 400 response in the contract is reserved for ts-rest path-param
        // validation failures, which surface before this handler runs — so
        // BAD_REQUEST is intentionally absent from the ApiError mapping list.
        return toErrorResponse(error, [
          StatusCodes.FORBIDDEN,
          StatusCodes.NOT_FOUND,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};

/**
 * Map a service-layer guardian report into the API response shape.
 *
 * The service already produces the right field names and ISO-stringifies
 * dates, so this is largely a structural pass-through. Keeping it in the
 * controller (rather than the service) preserves the boundary: services
 * deal in domain types, controllers translate to API contract types.
 */
function toGuardianStudentReportResponse(result: GuardianStudentReportResult): GuardianStudentReportResponse {
  return {
    student: result.student,
    administrations: result.administrations,
    longitudinalScores: result.longitudinalScores,
  };
}
