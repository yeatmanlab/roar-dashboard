import type { AuthContext } from '../../types/auth-context';
import type { User, NewUserAgreement } from '../../db/schema';
import type { UserType } from '../../enums/user-type.enum';
import type { Grade } from '../../enums/grade.enum';
import type { FreeReducedLunchStatus } from '../../enums/frl-status.enum';
import { StatusCodes } from 'http-status-codes';
import { AgreementType } from '../../enums/agreement-type.enum';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';
import { isUniqueViolation, unwrapDrizzleError } from '../../errors';
import { logger } from '../../logger';
import { UserRepository } from '../../repositories/user.repository';
import { UserAgreementRepository } from '../../repositories/user-agreement.repository';
import { AgreementVersionRepository } from '../../repositories/agreement-version.repository';
import { AgreementRepository } from '../../repositories/agreement.repository';
import { isMajorityAge } from '../../utils/is-majority-age.util';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';

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
  authorizationService = AuthorizationService(),
}: {
  userRepository?: UserRepository;
  userAgreementRepository?: UserAgreementRepository;
  agreementVersionRepository?: AgreementVersionRepository;
  agreementRepository?: AgreementRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /** Map repository entity types to FGA object type prefixes. */
  const ENTITY_TYPE_TO_FGA_TYPE: Record<string, FgaType> = {
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
   * The FGA model defines `can_list_users: supervisory_tier_group` on district, school,
   * class, and group types, and `can_list_users: parent` on the family type. This
   * replaces the old SQL UNION query across 5 access paths (org hierarchy, org→class,
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
          .filter((m) => m.entityType === 'family')
          .map((m) => `${FgaType.FAMILY}:${m.entityId}`);

        const canConsent =
          familyObjects.length > 0 &&
          (await authorizationService.hasAnyPermission(
            requestingUserId,
            FgaRelation.CAN_CONSENT_FOR_CHILD,
            familyObjects,
          ));

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

  return { findByAuthId, getById, update, recordUserAgreement, getUnsignedTosAgreements };
}
