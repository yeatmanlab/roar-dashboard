import { StatusCodes } from 'http-status-codes';
import type { PaginatedResult } from '@roar-dashboard/api-contract';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import type { CreateClassInput } from '../../repositories/class.repository';
import { ClassRepository } from '../../repositories/class.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import type { AuthContext } from '../../types/auth-context';
import type { EnrolledUserEntity, EnrolledUsersQuery, ListEnrolledUsersOptions } from '../../types/user';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { OrgType } from '../../enums/org-type.enum';
import type { ClassType } from '../../enums/class-type.enum';
import type { Grade } from '../../enums/grade.enum';

/**
 * Service-layer input for creating a class.
 *
 * Mirrors the API contract's CreateClassRequest shape. The service derives
 * `districtId` (from the parent school's `parentOrgId`) and `orgPath` (handled
 * by a DB trigger) before delegating to the repository. Defined here rather
 * than imported from the api-contract so the service stays decoupled from
 * transport concerns (see backend-service-pattern.md "Service Type Independence").
 */
export interface CreateClassServiceInput {
  schoolId: string;
  name: string;
  classType: ClassType;
  number?: string;
  period?: string;
  termId?: string;
  courseId?: string;
  subjects?: string[];
  grades?: Grade[];
  location?: string;
}

export function ClassService({
  classRepository = new ClassRepository(),
  authorizationService = AuthorizationService(),
  schoolRepository = new SchoolRepository(),
}: {
  classRepository?: ClassRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
  schoolRepository?: SchoolRepository;
} = {}) {
  /**
   * Performs authorization checks for sub-resource listing.
   * Verifies class exists and user has can_list_users permission via FGA.
   *
   * FGA's can_list_users on class requires supervisory_tier_group, which encodes
   * both the access check and the supervisory role requirement in a single call.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param classId - The class ID to verify access for
   * @throws {ApiError} NOT_FOUND if class doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks can_list_users permission
   */
  async function authorizeSubResourceAccess(authContext: AuthContext, classId: string): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    // Verify class exists (404 before 403)
    const classEntity = await classRepository.getById({ id: classId });
    if (!classEntity) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, classId },
      });
    }

    if (isSuperAdmin) return;

    // FGA checks both access and supervisory role in one call
    await authorizationService.requirePermission(userId, FgaRelation.CAN_LIST_USERS, `${FgaType.CLASS}:${classId}`);
  }

  /**
   * List users assigned to a class with access control.
   *
   * Authorization behavior:
   * - Super admin: sees all users assigned to the class
   * - Users with can_list_users on class (supervisory_tier_group): sees all users in the class
   * - All other roles: returns 403 Forbidden
   *
   * @param authContext - User's auth context (id and type)
   * @param classId - The class ID to get users for
   * @param options - Pagination and sorting options
   * @returns Paginated result with users
   * @throws {ApiError} NOT_FOUND if class doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the class or has supervised role
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listUsers(
    authContext: AuthContext,
    classId: string,
    options: EnrolledUsersQuery,
  ): Promise<PaginatedResult<EnrolledUserEntity>> {
    const { userId } = authContext;

    try {
      await authorizeSubResourceAccess(authContext, classId);

      const queryParams: ListEnrolledUsersOptions = {
        page: options.page,
        perPage: options.perPage,
        orderBy: {
          field: options.sortBy,
          direction: options.sortOrder,
        },
        ...(options.role && { role: options.role }),
        ...(options.grade && { grade: options.grade }),
      };

      // FGA already verified permission — use unrestricted query for all authorized users
      return await classRepository.getUsersByClassId(classId, queryParams);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, classId, options } }, 'Failed to list class users');

      throw new ApiError('Failed to retrieve class users', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, classId },
        cause: error,
      });
    }
  }

  /**
   * Create a new class under an existing school.
   *
   * Restricted to super admins. Verifies the parent school exists, has
   * `orgType='school'`, and is not rostered-ended; otherwise returns 422.
   *
   * Derives `districtId` from the parent school's `parentOrgId` (which is
   * always set for a school per the org hierarchy invariants). The
   * class's `orgPath` is computed by the BEFORE INSERT trigger from the
   * parent school's path, and `schoolLevels` is computed by the
   * `generatedAlwaysAs` clause from the supplied `grades`.
   *
   * No FGA tuples are written by this endpoint. FGA tuples are user-to-class
   * relationships and are written when users are assigned to the class via
   * memberships.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param input - Class fields the caller is allowed to set, including the
   *   parent schoolId
   * @returns The new class id
   * @throws {ApiError} 403 if the caller is not a super admin
   * @throws {ApiError} 422 if schoolId does not resolve to an active school
   * @throws {ApiError} 500 if the database insert fails or the school has no parent
   */
  async function create(authContext: AuthContext, input: CreateClassServiceInput): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;

    if (!isSuperAdmin) {
      logger.warn({ userId }, 'Non-super admin attempted to create a class');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId },
      });
    }

    try {
      const parent = await schoolRepository.getUnrestrictedById(input.schoolId);

      // 422 covers three failure modes for the body-referenced parent: the
      // row doesn't exist; the row exists but isn't a school; the row exists
      // and is a school but its rostering ended in the past (treated as
      // nonexistent for create purposes — we don't want to attach new
      // classes to retired schools).
      const schoolIsActive =
        parent !== null &&
        parent.orgType === OrgType.SCHOOL &&
        (parent.rosteringEnded === null || parent.rosteringEnded > new Date());

      if (!schoolIsActive) {
        logger.warn(
          {
            userId,
            schoolId: input.schoolId,
            parentExists: parent !== null,
            parentOrgType: parent?.orgType ?? null,
            rosteringEnded: parent?.rosteringEnded ?? null,
          },
          'Class create rejected: parent school did not resolve to an active school',
        );
        throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
          context: { userId, schoolId: input.schoolId },
        });
      }

      // The school's parentOrgId is the districtId. A school always has a
      // parent district per the org hierarchy invariants (the
      // validate_org_hierarchy_fn trigger enforces non-roots have a
      // parent_org_id). If this somehow ends up null at runtime, that's a
      // data-integrity bug the integration test would catch — the catch
      // block below wraps it as a 500.
      if (parent.parentOrgId === null) {
        logger.error(
          { userId, schoolId: input.schoolId },
          'Class create: parent school has null parentOrgId — org hierarchy invariant violated',
        );
        throw new ApiError('Failed to create class', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, schoolId: input.schoolId },
        });
      }

      const repoInput: CreateClassInput = {
        schoolId: input.schoolId,
        districtId: parent.parentOrgId,
        name: input.name,
        classType: input.classType,
        ...(input.number !== undefined && { number: input.number }),
        ...(input.period !== undefined && { period: input.period }),
        ...(input.termId !== undefined && { termId: input.termId }),
        ...(input.courseId !== undefined && { courseId: input.courseId }),
        ...(input.subjects !== undefined && { subjects: input.subjects }),
        ...(input.grades !== undefined && { grades: input.grades }),
        ...(input.location !== undefined && { location: input.location }),
      };

      return await classRepository.createClass(repoInput);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, schoolId: input.schoolId } }, 'Failed to create class');

      throw new ApiError('Failed to create class', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, schoolId: input.schoolId },
        cause: error,
      });
    }
  }

  return {
    create,
    listUsers,
  };
}
