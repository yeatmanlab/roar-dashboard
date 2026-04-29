import type { AuthContext } from '../../types/auth-context';
import type { User, NewUserAgreement, NewUserOrg, NewUserClass, NewUserGroup, NewUserFamily } from '../../db/schema';
import type { Grade } from '../../enums/grade.enum';
import type { FreeReducedLunchStatus } from '../../enums/frl-status.enum';
import type { TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import { UserRole } from '../../enums/user-role.enum';
import { UserFamilyRole } from '../../enums/user-family-role.enum';
import { EntityType } from '../../types/entity-type';
import { StatusCodes } from 'http-status-codes';
import { AgreementType } from '../../enums/agreement-type.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { isUniqueViolation, isForeignKeyViolation, unwrapDrizzleError } from '../../errors';
import { logger } from '../../logger';
import { UserRepository } from '../../repositories/user.repository';
import { UserAgreementRepository } from '../../repositories/user-agreement.repository';
import { AgreementVersionRepository } from '../../repositories/agreement-version.repository';
import { AgreementRepository } from '../../repositories/agreement.repository';
import { DistrictRepository } from '../../repositories/district.repository';
import { SchoolRepository } from '../../repositories/school.repository';
import { GroupRepository } from '../../repositories/group.repository';
import { FamilyRepository } from '../../repositories/family.repository';
import { isMajorityAge } from '../../utils/is-majority-age.util';
import { generateAssessmentPid } from '../../utils/assessment-pid.util';
import { FirebaseAuthClient } from '../../clients/firebase-auth.clients';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation, FGA_CLASS_VALID_ROLES } from '../authorization/fga-constants';
import {
  districtMembershipTuple,
  schoolMembershipTuple,
  classMembershipTuple,
  groupMembershipTuple,
  familyMembershipTuple,
} from '../authorization/helpers/fga-tuples';
import { UserType } from '../../enums/user-type.enum';
import { AuthProvider } from '../../enums/auth-provider.enum';
import { isFirebaseError } from '../../types/firebase';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';

// Types for the unsigned TOS agreements response
interface TosAgreementVersion {
  versionId: string;
  locale: string;
}

interface UnsignedTosAgreement {
  agreementId: string;
  agreementName: string;
  versions: TosAgreementVersion[];
}

// Age category for type-safe age classification in agreement consent logic
const AgeCategory = {
  ADULT: 'ADULT',
  MINOR: 'MINOR',
  UNKNOWN: 'UNKNOWN',
} as const;
type AgeCategory = (typeof AgeCategory)[keyof typeof AgeCategory];

/** Interface for user name fields in the create user payload. */
interface CreateUserName {
  first: string;
  middle?: string | undefined;
  last: string;
}

/** Interface for user demographic fields in the create user payload. */
interface CreateUserDemographics {
  gender?: string | null | undefined;
  race?: string | null | undefined;
  statusEll?: string | null | undefined;
  statusFrl?: FreeReducedLunchStatus | null | undefined;
  statusIep?: string | null | undefined;
  hispanicEthnicity?: boolean | null | undefined;
  homeLanguage?: string | null | undefined;
}

/** Interface for user identifier fields in the create user payload. */
interface CreateUserIdentifiers {
  stateId?: string | undefined;
  pid?: string | undefined;
}

/** Interface for user membership fields in the create user payload. */
interface CreateUserMemberships {
  entityType: EntityType;
  entityId: string;
  role: UserRole | UserFamilyRole;
  enrollmentStart?: string | undefined;
  enrollmentEnd?: string | undefined;
}

/**
 * Narrowed membership types used only in the create function for type-safe mapping.
 * The flat CreateUserMemberships interface is kept for controller compatibility —
 * Zod's z.union() inference flattens the discriminated union before it reaches the service.
 */
type OrgMembership = CreateUserMemberships & {
  entityType: Exclude<EntityType, 'family'>;
  role: UserRole;
};
type FamilyMembership = CreateUserMemberships & {
  entityType: 'family';
  role: UserFamilyRole;
};

/**
 * Fields for creating a single user.
 *
 * System manages id, assessmentPid, authId, authProvider, isSuperAdmin, schoolLevel, createdAt, and updatedAt — these are intentionally excluded
 * from the create payload.
 */
interface CreateUserData {
  email: string;
  password: string;
  name: CreateUserName;
  userType: UserType;
  dob?: string | null | undefined;
  grade?: Grade | null | undefined;
  demographics?: CreateUserDemographics | undefined;
  identifiers?: CreateUserIdentifiers | undefined;
  memberships: CreateUserMemberships[];
}

/**
 * The subset of user fields that may be updated via PATCH /users/:id.
 *
 * System-managed fields (id, assessmentPid, authId, authProvider, isSuperAdmin,
 * schoolLevel, createdAt, updatedAt) are intentionally excluded.
 *
 * All fields are optional — only those present in the request body are applied.
 * Nullable fields may be set to null to clear their stored value.
 */
interface UpdateUserData {
  nameFirst?: string | null | undefined;
  nameMiddle?: string | null | undefined;
  nameLast?: string | null | undefined;
  username?: string | null | undefined;
  email?: string | null | undefined;
  userType?: UserType | undefined;
  dob?: string | null | undefined;
  grade?: Grade | null | undefined;
  statusEll?: string | null | undefined;
  statusFrl?: FreeReducedLunchStatus | null | undefined;
  statusIep?: string | null | undefined;
  studentId?: string | null | undefined;
  sisId?: string | null | undefined;
  stateId?: string | null | undefined;
  localId?: string | null | undefined;
  gender?: string | null | undefined;
  race?: string | null | undefined;
  hispanicEthnicity?: boolean | null | undefined;
  homeLanguage?: string | null | undefined;
}

/**
 * UserService
 *
 * Provides user-related business logic operations.
 * Follows the firebase-functions factory pattern with dependency injection.
 * Repository is auto-instantiated by default, but can be injected for testing.
 *
 * @param params - Configuration object containing repository instances (optional)
 * @returns UserService - An object with user service methods.
 *
 * @example
 * ```typescript
 * // Production usage (auto-instantiates repository)
 * const user = await UserService().findByAuthId('firebase-uid');
 *
 * // Testing usage (inject mock)
 * const userService = UserService({ userRepository: mockRepo });
 * ```
 */
export function UserService({
  userRepository = new UserRepository(),
  userAgreementRepository = new UserAgreementRepository(),
  agreementVersionRepository = new AgreementVersionRepository(),
  agreementRepository = new AgreementRepository(),
  districtRepository = new DistrictRepository(),
  schoolRepository = new SchoolRepository(),
  groupRepository = new GroupRepository(),
  familyRepository = new FamilyRepository(),
  authorizationService = AuthorizationService(),
}: {
  userRepository?: UserRepository;
  userAgreementRepository?: UserAgreementRepository;
  agreementVersionRepository?: AgreementVersionRepository;
  agreementRepository?: AgreementRepository;
  districtRepository?: DistrictRepository;
  schoolRepository?: SchoolRepository;
  groupRepository?: GroupRepository;
  familyRepository?: FamilyRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /** Map repository entity types to FGA object type prefixes. */
  const ENTITY_TYPE_TO_FGA_TYPE: Record<EntityType, FgaType> = {
    district: FgaType.DISTRICT,
    school: FgaType.SCHOOL,
    class: FgaType.CLASS,
    group: FgaType.GROUP,
    family: FgaType.FAMILY,
  };

  /**
   * Verify that a user exists and that the requestor can access them.
   *
   * Authorization flow:
   * 1. Look up target user (404 before 403)
   * 2. Super admin bypass
   * 3. Self-access fast path (no FGA call needed)
   * 4. Look up the target user's active entity memberships (orgs, classes, groups, families)
   * 5. Batch-check `can_list_users` on each entity via FGA — access granted if any passes
   *
   * The FGA model defines`can_list_users` permission on each entity type (district, school, class, group, family) that a user can belong to. This method checks if the requestor has `can_list_users` on any of the target user's entities, which grants them access to view the target user's profile.
   *  - district: `can_list_users`: admin_tier
   *  - school: `can_list_users`: admin_tier or school_admin_tier
   *  - class: `can_list_users`: admin_tier or school_admin_tier or educator_tier (supervisory_tier_group)
   *  - group: `can_list_users`: admin_tier or school_admin_tier or educator_tier (supervisory_tier_group)
   *  - family: `can_list_users`: parent
   *
   * This replaces the old SQL UNION query across 5 access paths (org hierarchy, org→class,
   * direct class, direct group, family) with a single batch FGA check.
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param id - The target user's ID to verify
   * @returns The user record if access is granted
   * @throws {ApiError} NOT_FOUND if user doesn't exist
   * @throws {ApiError} FORBIDDEN if requestor cannot access the target user
   */
  async function verifyUserAccess(authContext: AuthContext, id: string): Promise<User> {
    const { userId, isSuperAdmin } = authContext;

    // 1. Look up the user first to distinguish between not found and permission issues
    const user = await userRepository.getById({ id });

    if (!user) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { id, userId },
      });
    }

    // 2. Super admins bypass permission checks
    if (isSuperAdmin) {
      return user;
    }

    // 3. Users can always access their own profile — no FGA call needed
    if (userId === id) {
      return user;
    }

    // 4. Look up the target user's active entity memberships
    const memberships = await userRepository.getUserEntityMemberships(id);

    if (memberships.length === 0) {
      // Target user has no active memberships — no entity to check against
      logger.warn({ userId, targetUserId: id }, 'Target user has no active entity memberships');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, targetUserId: id },
      });
    }

    // 5. Batch-check can_list_users on each entity via FGA
    const fgaObjects = memberships.map((m) => `${ENTITY_TYPE_TO_FGA_TYPE[m.entityType]}:${m.entityId}`);
    const hasAccess = await authorizationService.hasAnyPermission(userId, FgaRelation.CAN_LIST_USERS, fgaObjects);

    if (!hasAccess) {
      logger.warn({ userId, targetUserId: id }, 'User attempted to access another user without permission');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, targetUserId: id },
      });
    }

    return user;
  }

  /**
   * Find a user by their Firebase authentication ID.
   *
   * @param authId - The Firebase UID to look up.
   * @returns The user record if found, null otherwise.
   * @throws {ApiError} If the database query fails.
   */
  async function findByAuthId(authId: string): Promise<User | null> {
    try {
      return await userRepository.findByAuthId(authId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error, context: { authId } }, 'Failed to find user by auth ID');
      throw new ApiError('Failed to retrieve user', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { authId },
        cause: error,
      });
    }
  }

  /**
   * Get a user by their ID with access control.
   *
   * A user can access their own record.
   * Users with supervisory roles can access users in their district, school, or class.
   * Super admin users can access any user.
   *
   * @param authContext - Requesting user's authentication context.
   * @param id - UUID of the user to retrieve.
   * @returns The user record if access is granted.
   * @throws {ApiError} NOT_FOUND if the user does not exist.
   * @throws {ApiError} FORBIDDEN if the requestor lacks permission to access this user.
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails.
   */
  async function getById(authContext: AuthContext, id: string): Promise<User> {
    const { userId } = authContext;

    try {
      return await verifyUserAccess(authContext, id);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to get user by ID');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, requestedUserId: id },
        cause: error,
      });
    }
  }

  /**
   * Create a new user with memberships across three external systems.
   *
   * Implements a saga with explicit compensation so a failure in any system
   * rolls back the others, leaving the platform in a consistent state.
   *
   * Operation sequence: Auth → DB → FGA
   *
   * Authorization behavior:
   * - Super admin: allowed unconditionally.
   * - All others: must have `can_create_users` on every membership target.
   *   - district / school / group: checked directly.
   *   - class: checked on the parent school (the FGA model defines no `can_create_users`
   *     on the `class` type; it cascades from the parent school instead).
   *   - family: no `can_create_users` check (families are self-managed).
   *
   * @param authContext - Requesting user's auth context
   * @param body - User fields and initial memberships
   * @returns The newly created user's ID
   * @throws {ApiError} FORBIDDEN (403) if authorization fails
   * @throws {ApiError} CONFLICT (409) if email / assessmentPid already exists
   * @throws {ApiError} UNPROCESSABLE_ENTITY (422) if a membership entityId doesn't resolve
   * @throws {ApiError} TOO_MANY_REQUESTS (429) if Firebase Auth rate-limits the request
   * @throws {ApiError} INTERNAL_SERVER_ERROR (500) on unexpected failures or unrecoverable compensation
   */
  async function create(authContext: AuthContext, body: CreateUserData): Promise<{ id: string }> {
    const { userId, isSuperAdmin } = authContext;

    // ── Step 1: Authorization + entity existence pre-flight ───────────────────
    //
    // For non-super-admins, resolve the FGA object for each membership and call
    // requirePermission. For class memberships, look up the parent school first —
    // `can_create_users` is defined on school, not class.
    //
    // Entity existence for non-super-admins is checked implicitly: findClassParentSchool
    // returns null for a non-existent class, and the FGA model requires district/school/group
    // to have tuples so requirePermission throws 403 for missing entities.
    //
    // Super admins skip FGA but get explicit entity existence checks for all membership
    // types — without this, an invalid ID would only fail at the DB FK constraint after
    // Firebase has already created an account that then needs compensating deletion.

    if (!isSuperAdmin) {
      await Promise.all(
        body.memberships.map(async (membership) => {
          if (membership.entityType === EntityType.CLASS) {
            const schoolId = await userRepository.findClassParentSchool(membership.entityId);
            if (!schoolId) {
              logger.warn(
                { userId, classId: membership.entityId, totalMemberships: body.memberships.length },
                'Class not found during user create pre-flight',
              );
              throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
                statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
                code: ApiErrorCode.RESOURCE_NOT_FOUND,
                context: { userId, classId: membership.entityId },
              });
            }
            await authorizationService.requirePermission(
              userId,
              FgaRelation.CAN_CREATE_USERS,
              `${FgaType.SCHOOL}:${schoolId}`,
            );
          } else if (membership.entityType !== EntityType.FAMILY) {
            await authorizationService.requirePermission(
              userId,
              FgaRelation.CAN_CREATE_USERS,
              `${ENTITY_TYPE_TO_FGA_TYPE[membership.entityType]}:${membership.entityId}`,
            );
          }
          // TODO: Two family gaps to fix in follow-up PR (see issue #1774):
          // 1. Authorization: no can_create_child check — any authenticated user can add members to any family.
          //    Fix: call authorizationService.requirePermission(userId, CAN_CREATE_CHILD, family:entityId).
          // 2. Existence: no pre-flight existence check for family entityIds — an invalid familyId won't be caught
          //    until the DB FK constraint fires after Firebase account creation, triggering compensation deletion.
          //    Fix: call familyRepository.getById(entityId) before the FGA check, same as the super-admin path.
          // ISSUE: https://github.com/yeatmanlab/roar-project-management/issues/1774
        }),
      );
    } else {
      // Super admin: verify all membership entity IDs exist before touching Firebase.
      // Without this, an invalid entity ID would only fail at the DB FK constraint (step 4),
      // after a Firebase account has already been created and needs compensating deletion.

      await Promise.all(
        body.memberships.map(async ({ entityType, entityId }) => {
          const exists = await verifyMembershipEntityExists(entityType, entityId);
          if (!exists) {
            logger.warn({ userId, entityType, entityId }, 'Membership entity not found during user create pre-flight');
            throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
              statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
              code: ApiErrorCode.RESOURCE_NOT_FOUND,
              context: { userId, entityType, entityId },
            });
          }
        }),
      );
    }

    // ── Step 2: Pre-flight uniqueness check ───────────────────────────────────
    //
    // Best-effort guard that avoids creating an orphaned Firebase account for a
    // user that already exists in Postgres. PID is checked too when provided.
    //
    // This check is NOT race-safe: two concurrent requests with the same email
    // can both pass here, then one will fail at the DB unique constraint in
    // step 4 and trigger the Firebase compensation path. The DB constraint is
    // the true last line of defense for concurrent creates.

    const assessmentPid =
      body.identifiers?.pid ??
      generateAssessmentPid({
        userId: body.email,
        // Prefixes could be derived from the first district/school membership abbreviation;
        // omitted for now to keep this endpoint consistent with the current cloud function
        // default (checksum-only) for new single-user creation.
      });

    const alreadyExists = await userRepository.existsByUniqueFields({
      email: body.email,
      assessmentPid,
    });

    if (alreadyExists) {
      throw new ApiError(ApiErrorMessage.CONFLICT, {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
        context: { userId, email: body.email },
      });
    }

    // Also check Firebase Auth — a user might exist there without a DB row
    try {
      await FirebaseAuthClient.getUserByEmail(body.email);
      // If getUserByEmail succeeds, the account already exists
      throw new ApiError(ApiErrorMessage.CONFLICT, {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
        context: { userId, email: body.email },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // `auth/user-not-found` is the expected case — swallow and continue
      if (!isFirebaseError(error) || error.code !== FIREBASE_ERROR_CODES.AUTH.USER_NOT_FOUND) {
        logger.error(
          { err: error, context: { userId, email: body.email } },
          'Firebase getUserByEmail failed during pre-flight',
        );
        throw new ApiError('Failed to check Firebase user existence', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId, email: body.email },
          cause: error,
        });
      }
    }

    // ── Step 3: Firebase Auth createUser ─────────────────────────────────────

    let firebaseUid: string;
    try {
      const authRecord = await FirebaseAuthClient.createUser({
        email: body.email,
        password: body.password,
        displayName: [body.name.first, body.name.last].filter(Boolean).join(' '),
      });
      firebaseUid = authRecord.uid;
    } catch (error) {
      if (isFirebaseError(error) && error.code === FIREBASE_ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, email: body.email },
        });
      }

      if (isFirebaseError(error) && error.code === FIREBASE_ERROR_CODES.AUTH.TOO_MANY_REQUESTS) {
        throw new ApiError(ApiErrorMessage.RATE_LIMITED, {
          statusCode: StatusCodes.TOO_MANY_REQUESTS,
          code: ApiErrorCode.RATE_LIMITED,
          context: { userId, email: body.email },
          cause: error,
        });
      }

      logger.error({ err: error, context: { userId, email: body.email } }, 'Firebase createUser failed');
      throw new ApiError('Failed to create Firebase auth account', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, email: body.email },
        cause: error,
      });
    }

    // ── Step 4: DB transaction (user row + junction rows) ────────────────────
    //
    // On failure: compensate by deleting the Firebase auth account.

    let newUserId: string;
    try {
      const enrollmentStart = new Date();

      const orgMemberships: Omit<NewUserOrg, 'userId'>[] = body.memberships
        .filter(isOrgMembership)
        .filter((m) => m.entityType === EntityType.DISTRICT || m.entityType === EntityType.SCHOOL)
        .map((m) => ({
          orgId: m.entityId,
          role: m.role,
          enrollmentStart: m.enrollmentStart ? new Date(m.enrollmentStart) : enrollmentStart,
          enrollmentEnd: m.enrollmentEnd ? new Date(m.enrollmentEnd) : null,
        }));

      const classMemberships: Omit<NewUserClass, 'userId'>[] = body.memberships
        .filter(isOrgMembership)
        .filter((m) => m.entityType === EntityType.CLASS)
        .map((m) => ({
          classId: m.entityId,
          role: m.role,
          enrollmentStart: m.enrollmentStart ? new Date(m.enrollmentStart) : enrollmentStart,
          enrollmentEnd: m.enrollmentEnd ? new Date(m.enrollmentEnd) : null,
        }));

      const groupMemberships: Omit<NewUserGroup, 'userId'>[] = body.memberships
        .filter(isOrgMembership)
        .filter((m) => m.entityType === EntityType.GROUP)
        .map((m) => ({
          groupId: m.entityId,
          role: m.role,
          enrollmentStart: m.enrollmentStart ? new Date(m.enrollmentStart) : enrollmentStart,
          enrollmentEnd: m.enrollmentEnd ? new Date(m.enrollmentEnd) : null,
        }));

      const familyMemberships: Omit<NewUserFamily, 'userId'>[] = body.memberships
        .filter(isFamilyMembership)
        .map((m) => ({
          familyId: m.entityId,
          role: m.role,
          joinedOn: m.enrollmentStart ? new Date(m.enrollmentStart) : enrollmentStart,
          leftOn: m.enrollmentEnd ? new Date(m.enrollmentEnd) : null,
        }));

      const result = await userRepository.createWithMemberships(
        {
          authId: firebaseUid,
          authProvider: [AuthProvider.PASSWORD],
          email: body.email,
          nameFirst: body.name.first,
          nameMiddle: body.name.middle ?? null,
          nameLast: body.name.last,
          dob: body.dob ?? null,
          grade: body.grade ?? null,
          assessmentPid,
          userType: body.userType,
          statusEll: body.demographics?.statusEll ?? null,
          statusFrl: body.demographics?.statusFrl ?? null,
          statusIep: body.demographics?.statusIep ?? null,
          gender: body.demographics?.gender ?? null,
          race: body.demographics?.race ?? null,
          hispanicEthnicity: body.demographics?.hispanicEthnicity ?? null,
          homeLanguage: body.demographics?.homeLanguage ?? null,
          stateId: body.identifiers?.stateId ?? null,
          isSuperAdmin: false,
        },
        orgMemberships,
        classMemberships,
        groupMemberships,
        familyMemberships,
      );

      newUserId = result.id;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      const dbError = unwrapDrizzleError(error);

      if (isUniqueViolation(dbError)) {
        // Compensate: roll back the Firebase auth account
        await compensateDeleteFirebaseUser(firebaseUid, userId, body.email, 'DB unique violation');
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, email: body.email },
          cause: error,
        });
      }

      if (isForeignKeyViolation(dbError)) {
        // A membership entityId didn't resolve — FK constraint fired
        await compensateDeleteFirebaseUser(firebaseUid, userId, body.email, 'FK violation on membership entity');
        throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, email: body.email },
          cause: error,
        });
      }

      logger.error({ err: error, context: { userId, email: body.email } }, 'DB write failed during user create');
      await compensateDeleteFirebaseUser(firebaseUid, userId, body.email, 'DB write failure');
      throw new ApiError('Failed to create user record', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, email: body.email, firebaseUid },
        cause: error,
      });
    }

    // ── Step 5: FGA tuple writes ──────────────────────────────────────────────
    //
    // On failure: compensate by deleting FGA tuples, then the DB row, then Firebase.

    const fgaTuples = buildMembershipTuples(newUserId, body.memberships);

    try {
      await authorizationService.writeTuplesOrThrow(fgaTuples);
    } catch (error) {
      logger.error(
        { err: error, context: { userId, newUserId, email: body.email, firebaseUid } },
        'FGA write failed during user create — beginning compensation',
      );

      // Best-effort: delete any tuples that may have been partially written
      const deleteTuples: TupleKeyWithoutCondition[] = fgaTuples.map(({ user, relation, object }) => ({
        user,
        relation,
        object,
      }));
      await authorizationService.deleteTuples(deleteTuples);

      // Delete the DB row (cascade removes junction rows)
      try {
        await userRepository.delete({ id: newUserId });
      } catch (dbDeleteError) {
        logger.error(
          { err: dbDeleteError, context: { userId, newUserId, firebaseUid } },
          'DB delete compensation failed after FGA write failure — manual cleanup required',
        );
      }

      // Delete the Firebase auth account
      await compensateDeleteFirebaseUser(firebaseUid, userId, body.email, 'FGA write failure');

      throw new ApiError(ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, newUserId, email: body.email, firebaseUid },
        cause: error,
      });
    }

    logger.info({ userId, newUserId, email: body.email }, 'Created user');
    return { id: newUserId };
  }

  /**
   * Verifies that a membership entity exists for the given entity type and ID.
   * @param entityType The type of the membership entity to verify.
   * @param entityId The ID of the membership entity to verify.
   * @returns A promise that resolves to `true` if the entity exists, `false` otherwise.
   */
  async function verifyMembershipEntityExists(entityType: EntityType, entityId: string): Promise<boolean> {
    if (entityType === EntityType.DISTRICT) return (await districtRepository.getById({ id: entityId })) !== null;
    if (entityType === EntityType.SCHOOL) return (await schoolRepository.getById({ id: entityId })) !== null;
    if (entityType === EntityType.CLASS) return (await userRepository.findClassParentSchool(entityId)) !== null;
    if (entityType === EntityType.GROUP) return (await groupRepository.getById({ id: entityId })) !== null;
    return (await familyRepository.getById({ id: entityId })) !== null;
  }

  /**
   * Type guard for `OrgMembership`.
   *
   * @param m The membership to check.
   * @returns `true` if the membership is an `OrgMembership`, `false` otherwise.
   */
  function isOrgMembership(m: CreateUserMemberships): m is OrgMembership {
    return m.entityType !== EntityType.FAMILY;
  }

  /**
   * Type guard for `FamilyMembership`.
   *
   * @param m The membership to check.
   * @returns `true` if the membership is a `FamilyMembership`, `false` otherwise.
   */
  function isFamilyMembership(m: CreateUserMemberships): m is FamilyMembership {
    return m.entityType === EntityType.FAMILY;
  }

  /**
   * Delete a Firebase auth account as a saga compensation step.
   *
   * Failures are logged with full context but not re-thrown — the caller surfaces
   * a 500 to the client regardless. The structured log provides a paper trail for
   * manual reconciliation.
   */
  async function compensateDeleteFirebaseUser(
    firebaseUid: string,
    requestingUserId: string,
    email: string,
    reason: string,
  ): Promise<void> {
    try {
      await FirebaseAuthClient.deleteUser(firebaseUid);
    } catch (compensationError) {
      logger.error(
        { err: compensationError, context: { requestingUserId, firebaseUid, email, reason } },
        'Firebase deleteUser compensation failed — orphaned auth account requires manual cleanup',
      );
    }
  }

  /**
   * Build the FGA membership tuples for a newly created user.
   *
   * Class tuples are skipped for roles excluded from `FGA_CLASS_VALID_ROLES`
   * (admin-tier roles cascade via the org hierarchy and must not be written
   * directly to the class type).
   */
  function buildMembershipTuples(newUserId: string, memberships: CreateUserMemberships[]): TupleKey[] {
    const tuples: TupleKey[] = [];
    const now = new Date();

    for (const m of memberships) {
      const isOrgMember = isOrgMembership(m);
      const isFamilyMember = isFamilyMembership(m);

      const start = m.enrollmentStart ? new Date(m.enrollmentStart) : now;
      const end = m.enrollmentEnd ? new Date(m.enrollmentEnd) : null;

      if (isOrgMember && m.entityType === EntityType.DISTRICT) {
        tuples.push(districtMembershipTuple(newUserId, m.entityId, m.role, start, end));
      } else if (isOrgMember && m.entityType === EntityType.SCHOOL) {
        tuples.push(schoolMembershipTuple(newUserId, m.entityId, m.role, start, end));
      } else if (isOrgMember && m.entityType === EntityType.CLASS) {
        if (FGA_CLASS_VALID_ROLES.has(m.role)) {
          tuples.push(classMembershipTuple(newUserId, m.entityId, m.role, start, end));
        }
      } else if (isOrgMember && m.entityType === EntityType.GROUP) {
        tuples.push(groupMembershipTuple(newUserId, m.entityId, m.role, start, end));
      } else if (isFamilyMember) {
        tuples.push(familyMembershipTuple(newUserId, m.entityId, m.role, start, end));
      }
    }

    return tuples;
  }

  /**
   * Partially update a user by ID.
   *
   * Only fields present in the request body are written — omitted fields are left unchanged.
   * Nullable fields may be set to null to clear their stored value.
   *
   * Authorization: currently restricted to super admins only.
   *
   * @param authContext - Requesting user's authentication context.
   * @param id - UUID of the user to update.
   * @param data - Partial user fields to apply.
   * @throws {ApiError} FORBIDDEN if the requestor is not a super admin.
   * @throws {ApiError} NOT_FOUND if the target user does not exist.
   * @throws {ApiError} CONFLICT if a unique field (email or username) collides with an existing user.
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails.
   */
  async function update(authContext: AuthContext, id: string, data: UpdateUserData): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    // Authorization: super admins only (see JSDoc above for the expansion path)
    if (!isSuperAdmin) {
      logger.warn({ userId, id }, 'Non-super admin attempted to update user');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId, id },
      });
    }

    const {
      nameFirst,
      nameMiddle,
      nameLast,
      username,
      email,
      userType,
      dob,
      grade,
      statusEll,
      statusFrl,
      statusIep,
      studentId,
      sisId,
      stateId,
      localId,
      gender,
      race,
      hispanicEthnicity,
      homeLanguage,
    } = data;

    try {
      // Verify the target user exists.
      // Note: verifyUserAccess handles this automatically when the guard above is expanded.
      const user = await userRepository.getById({ id });
      if (!user) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId, id },
        });
      }

      await userRepository.update({
        id,
        data: {
          ...(nameFirst !== undefined && { nameFirst }),
          ...(nameMiddle !== undefined && { nameMiddle }),
          ...(nameLast !== undefined && { nameLast }),
          ...(username !== undefined && { username }),
          ...(email !== undefined && { email }),
          ...(userType !== undefined && { userType }),
          ...(dob !== undefined && { dob }),
          ...(grade !== undefined && { grade }),
          ...(statusEll !== undefined && { statusEll }),
          ...(statusFrl !== undefined && { statusFrl }),
          ...(statusIep !== undefined && { statusIep }),
          ...(studentId !== undefined && { studentId }),
          ...(sisId !== undefined && { sisId }),
          ...(stateId !== undefined && { stateId }),
          ...(localId !== undefined && { localId }),
          ...(gender !== undefined && { gender }),
          ...(race !== undefined && { race }),
          ...(hispanicEthnicity !== undefined && { hispanicEthnicity }),
          ...(homeLanguage !== undefined && { homeLanguage }),
        },
      });

      logger.info({ userId, id }, 'Updated user');
    } catch (error) {
      if (error instanceof ApiError) throw error;

      // Unwrap the Drizzle error to access the underlying PostgreSQL error with SQLSTATE codes
      const dbError = unwrapDrizzleError(error);

      // email and username both carry unique constraints — surface as 409 rather than 500
      if (isUniqueViolation(dbError)) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId, id },
          cause: error,
        });
      }

      logger.error({ err: error, context: { userId, id } }, 'Failed to update user');

      throw new ApiError('Failed to update user', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId, id },
        cause: error,
      });
    }
  }

  /**
   * Record a user agreement (consent record).
   *
   * Supports two consent modes:
   * - **Self-consent**: User consents for themselves
   * - **Parent consent**: Parent consents for their minor child (via family relationship)
   *
   * Authorization rules:
   * - Self-consent: User can consent for themselves if agreement type matches their age
   *   - Adults (majority age): Can agree to CONSENT or TOS agreements
   *   - Minors (under majority age): Can agree to ASSENT agreements only
   * - Parent consent: User can consent for their child via family relationship
   *   - Target must be a minor
   *   - Agreement type must be ASSENT
   *
   * @param authContext - Requesting user's authentication context
   * @param userId - Target user ID (who is consenting)
   * @param body - Request body (agreementVersionId)
   * @returns Object with created agreement ID
   * @throws {ApiError} NOT_FOUND if user, agreement version, or agreement doesn't exist
   * @throws {ApiError} CONFLICT if the user has already consented to the given agreement version
   * @throws {ApiError} FORBIDDEN if user lacks family relationship to consent for target user, if the agreement type is inappropriate for the user's age, or if a parent attempts to consent for a non-minor or non-assent agreement
   * @throws {ApiError} INTERNAL_SERVER_ERROR if database operation fails
   */
  async function recordUserAgreement(
    authContext: AuthContext,
    userId: string,
    body: { agreementVersionId: string },
  ): Promise<{ id: string }> {
    const { userId: requestingUserId } = authContext;
    const { agreementVersionId } = body;

    try {
      // 1. Verify target user exists
      const targetUser = await userRepository.getById({ id: userId });
      if (!targetUser) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: requestingUserId, targetUserId: userId },
        });
      }

      // 2. Verify agreement version exists and fetch agreement type
      const agreementVersion = await agreementVersionRepository.getById({ id: agreementVersionId });

      if (!agreementVersion) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: requestingUserId, agreementVersionId },
        });
      }

      // 3. Check for duplicate — user already consented to this version
      const existingAgreement = await userAgreementRepository.findByUserIdAndAgreementVersionId(
        userId,
        agreementVersionId,
      );

      if (existingAgreement) {
        logger.warn(
          { requestingUserId, targetUserId: userId, agreementVersionId },
          'User attempted to consent to an agreement version they have already signed',
        );
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { requestingUserId, targetUserId: userId, agreementVersionId },
        });
      }

      // Fetch the agreement to get the agreement type
      const agreement = await agreementRepository.getById({ id: agreementVersion.agreementId });

      if (!agreement) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: requestingUserId, agreementId: agreementVersion.agreementId },
        });
      }

      // 4. Validate agreement type is appropriate for user's age
      // Fetch requesting user to determine their age
      const requestingUser =
        requestingUserId === userId ? targetUser : await userRepository.getById({ id: requestingUserId });

      if (!requestingUser) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: requestingUserId },
        });
      }

      // Determine user's age category
      // TODO: This is necessary because we do not enforce non-null DoB in the database schema; this is a temporary measure until the issue below is resolved:
      // TODO: https://github.com/yeatmanlab/roar-project-management/issues/1732
      const ageStatus = isMajorityAge({ dob: requestingUser.dob, grade: requestingUser.grade });
      const ageCategory =
        ageStatus === true ? AgeCategory.ADULT : ageStatus === null ? AgeCategory.UNKNOWN : AgeCategory.MINOR;

      // Determine allowed agreement types based on age category
      const getAllowedAgreementTypes = (category: AgeCategory): AgreementType[] => {
        switch (category) {
          case AgeCategory.ADULT:
            return [AgreementType.CONSENT, AgreementType.TOS];
          case AgeCategory.UNKNOWN:
            // Allow all types for unknown age (with warning) to handle adults with null DOB
            return Object.values(AgreementType);
          case AgeCategory.MINOR:
            return [AgreementType.ASSENT];
        }
      };

      const allowedAgreementTypes = getAllowedAgreementTypes(ageCategory);

      // Self-consent: user is consenting for themselves
      if (requestingUserId === userId) {
        // Log warning for unknown age users
        if (ageCategory === AgeCategory.UNKNOWN) {
          logger.warn(
            { requestingUserId, agreementId: agreement.id },
            'User with unknown age (null DOB and no grade) is consenting - allowing all agreement types',
          );
        }

        // Validate agreement type is appropriate for user's age category
        if (!allowedAgreementTypes.includes(agreement.agreementType)) {
          logger.warn(
            { requestingUserId, agreementId: agreement.id, agreementType: agreement.agreementType, ageCategory },
            'User attempted to consent to an agreement type not allowed for their age category',
          );
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { requestingUserId, agreementId: agreement.id, agreementType: agreement.agreementType },
          });
        }
      }
      // Parent consent: user is consenting for their child (via family relationship)
      else {
        // Check if the requesting user has can_consent_for_child on any of the
        // target user's families. The FGA model defines can_consent_for_child: parent
        // on the family type, so only users with the parent role in a shared family pass.
        const targetFamilies = await userRepository.getUserEntityMemberships(userId);
        const familyObjects = targetFamilies
          .filter((m) => m.entityType === EntityType.FAMILY)
          .map((m) => `${FgaType.FAMILY}:${m.entityId}`);

        // Avoid unnecessary FGA call if the target user has no family memberships
        if (familyObjects.length === 0) {
          logger.warn({ requestingUserId, targetUserId: userId }, 'User attempted to consent for non-family member');
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { requestingUserId, targetUserId: userId },
          });
        }

        const canConsent = await authorizationService.hasAnyPermission(
          requestingUserId,
          FgaRelation.CAN_CONSENT_FOR_CHILD,
          familyObjects,
        );

        if (!canConsent) {
          logger.warn({ requestingUserId, targetUserId: userId }, 'User attempted to consent for non-family member');
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { requestingUserId, targetUserId: userId },
          });
        }

        // For parent consent, validate that the target user is a minor and agreement type is assent
        const targetUserAge = isMajorityAge({ dob: targetUser.dob, grade: targetUser.grade });
        const targetIsMinor = targetUserAge !== true;

        if (!targetIsMinor) {
          logger.warn(
            { requestingUserId, targetUserId: userId },
            'Parent attempted to consent for user who is not a minor',
          );
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { requestingUserId, targetUserId: userId },
          });
        }

        // Parent can only consent to assent agreements for their child
        if (agreement.agreementType !== AgreementType.ASSENT) {
          logger.warn(
            { requestingUserId, targetUserId: userId, agreementType: agreement.agreementType },
            'Parent attempted to consent to non-assent agreement for child',
          );
          throw new ApiError(ApiErrorMessage.FORBIDDEN, {
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { requestingUserId, targetUserId: userId, agreementType: agreement.agreementType },
          });
        }
      }

      // 6. Create the user agreement record
      const agreementData: NewUserAgreement = {
        userId,
        agreementVersionId,
        agreementTimestamp: new Date(),
      };

      const createdAgreement = await userAgreementRepository.create({ data: agreementData });

      return { id: createdAgreement.id };
    } catch (error) {
      // Re-throw ApiErrors as-is
      if (error instanceof ApiError) throw error;

      // Wrap unexpected errors
      logger.error(
        { err: error, context: { requestingUserId, targetUserId: userId, agreementVersionId } },
        'Failed to create user agreement',
      );
      throw new ApiError('Failed to create user agreement', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { requestingUserId, targetUserId: userId, agreementVersionId },
        cause: error,
      });
    }
  }

  /**
   * Get unsigned TOS agreements for a user.
   *
   * Returns TOS agreements where the user has not signed any current version
   * (cross-locale satisfaction: signing any locale satisfies the requirement).
   * Each agreement includes all current locale variants.
   *
   * @param userId - The user to check unsigned agreements for
   * @returns Array of unsigned agreements with their current version metadata
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function getUnsignedTosAgreements(userId: string): Promise<UnsignedTosAgreement[]> {
    try {
      const unsignedAgreements = await agreementRepository.getUnsignedTosAgreements(userId);

      return unsignedAgreements.map(({ agreement, currentVersions }) => ({
        agreementId: agreement.id,
        agreementName: agreement.name,
        versions: currentVersions.map(({ id, locale }) => ({
          versionId: id,
          locale,
        })),
      }));
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error({ err: error, context: { userId } }, 'Failed to get unsigned TOS agreements');

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId },
        cause: error,
      });
    }
  }

  return { findByAuthId, getById, create, update, recordUserAgreement, getUnsignedTosAgreements };
}
