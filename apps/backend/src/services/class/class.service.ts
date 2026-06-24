import { StatusCodes } from 'http-status-codes';
import type { PaginatedResult } from '@roar-platform/api-contract';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { logger } from '../../logger';
import type { Class } from '../../db/schema';
import type { CreateClassInput, UpdateClassInput } from '../../repositories/class.repository';
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
  number?: string | undefined;
  period?: string | undefined;
  termId?: string | undefined;
  courseId?: string | undefined;
  subjects?: string[] | undefined;
  grades?: Grade[] | undefined;
  location?: string | undefined;
}

/**
 * Service-layer input for updating a class.
 *
 * Mirrors the API contract's UpdateClassRequest shape — a partial of the mutable
 * class fields. `schoolId`/`districtId`/`orgPath` are NOT part of this shape: a
 * class cannot be re-parented after creation. `schoolLevels` is a generated
 * column and is never set directly — updating `grades` recomputes it. Defined
 * here rather than imported from the api-contract so the service stays decoupled
 * from transport concerns (see backend-service-pattern.md "Service Type Independence").
 */
export interface UpdateClassServiceInput {
  name?: string | undefined;
  classType?: ClassType | undefined;
  subjects?: string[] | undefined;
  grades?: Grade[] | undefined;
  location?: string | undefined;
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
   * Verifies a user can read a specific class and returns it.
   *
   * Authorization flow (see backend-authorization-pattern.md):
   *   1. Existence check first — a missing class is a 404, not a 403.
   *   2. Super admins bypass the FGA call.
   *   3. A single can_read FGA check. On class, can_read requires
   *      supervisory_tier_group, and the class roles inherit `from parent_org`,
   *      so this passes for supervisory members of the class itself *and* for
   *      admins/principals of the ancestor school or district (hierarchy
   *      inheritance is resolved entirely inside FGA). Students and caregivers
   *      are rejected with 403.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param classId - The class ID to verify access for
   * @returns The class entity if found and authorized
   * @throws {ApiError} NOT_FOUND if the class doesn't exist
   * @throws {ApiError} FORBIDDEN if the user lacks can_read permission
   */
  async function verifyClassAccess(authContext: AuthContext, classId: string): Promise<Class> {
    const { userId, isSuperAdmin } = authContext;

    // 1. Existence check — distinguishes 404 from 403
    const classEntity = await classRepository.getById({ id: classId });
    if (!classEntity) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, classId },
      });
    }

    // 2. Super admins bypass access checks
    if (isSuperAdmin) return classEntity;

    // 3. Single FGA permission check — can_read on class requires
    //    supervisory_tier_group; admin/principal roles inherit from the
    //    ancestor org, so the model composes the hierarchy for us.
    await authorizationService.requirePermission(userId, FgaRelation.CAN_READ, `${FgaType.CLASS}:${classId}`);

    return classEntity;
  }

  /**
   * Get a single class by ID.
   *
   * Authorization behavior:
   * - Super admin: can read any class.
   * - Supervisory members of the class, and admins/principals of the ancestor
   *   school or district (via FGA hierarchy inheritance): can read the class.
   * - Students and caregivers: 403 Forbidden.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param classId - UUID of the class to retrieve
   * @returns The class if found and authorized
   * @throws {ApiError} 404 if not found, 403 if unauthorized, 500 on database errors
   */
  async function getById(authContext: AuthContext, classId: string): Promise<Class> {
    const { userId } = authContext;

    try {
      return await verifyClassAccess(authContext, classId);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, classId } }, 'Failed to retrieve class');

      throw new ApiError('Failed to retrieve class', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, classId },
        cause: error,
      });
    }
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

      // 422 covers three failure modes for the body-referenced parent. The
      // first two checks are defense-in-depth (the repository's
      // getUnrestrictedById already filters by orgType='school' and would
      // return null if the row is a district), but the rosteringEnded check
      // is *primary enforcement at the service layer* — the repository does
      // not filter by rosteringEnded on the parent lookup, so this is the
      // only place that bars new classes from being attached to retired
      // schools:
      //   1. row doesn't exist                                  → 422
      //   2. row exists but isn't a school (defense-in-depth)   → 422
      //   3. row exists and is a school but rostering ended     → 422
      //      (treated as nonexistent for create purposes — primary check)
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
        throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
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

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, schoolId: input.schoolId },
        cause: error,
      });
    }
  }

  /**
   * Update an existing class.
   *
   * Authorization (super-admin-only — matches create):
   * 1. Existence check first — a missing class is a 404, not a 403.
   * 2. Super-admin gate — non-super-admins are rejected with 403. The FGA model
   *    defines `can_update: no_one` for classes, so no role grants update; the
   *    super-admin bypass IS the policy. No FGA `requirePermission` call is made.
   *
   * Only the mutable fields present in the input are applied; identity and
   * hierarchy columns (schoolId, districtId, orgPath) are not accepted and never
   * touched. Updating `grades` recomputes the generated `schoolLevels` column.
   *
   * @param authContext - Authentication context with userId and isSuperAdmin
   * @param classId - UUID of the class to update
   * @param input - The mutable class fields the caller is allowed to set
   * @returns The updated class id
   * @throws {ApiError} 404 if the class does not exist
   * @throws {ApiError} 403 if the caller is not a super admin
   * @throws {ApiError} 400 if no recognized mutable fields are present
   * @throws {ApiError} 500 if the database update fails
   */
  async function update(
    authContext: AuthContext,
    classId: string,
    input: UpdateClassServiceInput,
  ): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;

    try {
      // 1. Existence check first (404 before 403)
      const existing = await classRepository.getById({ id: classId });
      if (!existing) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, classId },
        });
      }

      // 2. Super-admin gate (can_update = no_one — the bypass is the policy)
      if (!isSuperAdmin) {
        logger.warn({ userId, classId }, 'Non-super admin attempted to update a class');
        throw new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId, classId },
        });
      }

      // Map the service input to the column-shaped repository partial. Class
      // columns map directly (no nested location/identifiers). Only keys
      // explicitly present in the input are included.
      const updates: UpdateClassInput = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.classType !== undefined && { classType: input.classType }),
        ...(input.subjects !== undefined && { subjects: input.subjects }),
        ...(input.grades !== undefined && { grades: input.grades }),
        ...(input.location !== undefined && { location: input.location }),
      };

      // 400 when no recognized mutable fields are present (matches administrations'
      // empty-body handling)
      if (Object.keys(updates).length === 0) {
        throw new ApiError(ApiErrorMessage.REQUEST_VALIDATION_FAILED, {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
          context: { userId, classId, reason: 'No updatable fields provided' },
        });
      }

      await classRepository.updateClass(classId, updates);

      logger.info({ userId, classId }, 'Class updated successfully');

      return { id: classId };
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId, classId } }, 'Failed to update class');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, classId },
        cause: error,
      });
    }
  }

  return {
    create,
    getById,
    listUsers,
    update,
  };
}
