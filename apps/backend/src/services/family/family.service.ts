import { StatusCodes } from 'http-status-codes';
import { FamilyRepository, FAMILIES_CREATED_BY_UNIQ_IDX } from '../../repositories/family.repository';
import { UserRepository } from '../../repositories/user.repository';
import { RosterProviderIdRepository } from '../../repositories/roster-provider-id.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { isUniqueViolation, isUniqueViolationOnConstraint, unwrapDrizzleError } from '../../errors';
import { logger } from '../../logger';
import type { PaginatedResult } from '../../repositories/base.repository';
import type { AuthContext } from '../../types/auth-context';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { familyMembershipTuple } from '../authorization/helpers/fga-tuples';
import { FirebaseAuthClient } from '../../clients/firebase-auth.clients';
import { isFirebaseError } from '../../types/firebase';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';
import { AuthProvider } from '../../enums/auth-provider.enum';
import { RosteringProvider } from '../../enums/rostering-provider.enum';
import { RosteringEntityType } from '../../enums/rostering-entity-type.enum';
import { UserType } from '../../enums/user-type.enum';
import { UserFamilyRole } from '../../enums/user-family-role.enum';
import { generateAssessmentPid } from '../../utils/assessment-pid.util';
import { families, userFamilies, users } from '../../db/schema';
import { and, eq } from 'drizzle-orm';
import type {
  EnrolledFamilyUsersQuery,
  EnrolledFamilyUserEntity,
  ListEnrolledFamilyUsersOptions,
} from '../../types/user';

/**
 * Caretaker name fields supplied at family-registration time.
 */
interface CreateFamilyCaretakerName {
  first: string;
  middle?: string | undefined;
  last: string;
}

/**
 * Optional location fields supplied at family-registration time.
 * Mirrors `app.families.location_*` columns. Coordinates are not accepted
 * at create time.
 */
interface CreateFamilyLocation {
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  city?: string | undefined;
  stateProvince?: string | undefined;
  postalCode?: string | undefined;
  country?: string | undefined;
}

/**
 * Service-layer input for `POST /v1/families`.
 *
 * Mirrors `CreateFamilyRequest` from the api-contract but is defined here so
 * the service stays decoupled from transport concerns
 * (see backend-service-pattern.md "Service Type Independence").
 */
export interface CreateFamilyServiceInput {
  email: string;
  password: string;
  name: CreateFamilyCaretakerName;
  location?: CreateFamilyLocation | undefined;
}

/**
 * Family Service
 *
 * Business logic layer for family operations.
 * Handles authorization (super admin vs regular user) and delegates to repository.
 */
export function FamilyService({
  familyRepository = new FamilyRepository(),
  userRepository = new UserRepository(),
  rosterProviderIdRepository = new RosterProviderIdRepository(),
  authorizationService = AuthorizationService(),
}: {
  familyRepository?: FamilyRepository;
  userRepository?: UserRepository;
  rosterProviderIdRepository?: RosterProviderIdRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
} = {}) {
  /**
   * Get users enrolled in a family.
   *
   * super_admin users can see all enrolled family members.
   * Only users with the `can_list_users` permission on the family can see other enrolled family members.
   *
   * Returns all users who have an active enrollment in the specified family.
   * Only includes users with active enrollments (joined_start <= now and
   * left_on is null or >= now).
   *
   * @param authContext - User's auth context (id and super admin flag)
   * @param familyId - The family ID to get enrolled users for
   * @param options - Pagination, sorting, and filtering options
   * @returns Paginated result with users
   * @throws {ApiError} NOT_FOUND if family doesn't exist
   * @throws {ApiError} FORBIDDEN if user lacks access to the family
   * @throws {ApiError} INTERNAL_SERVER_ERROR if the database query fails
   */
  async function listUsers(
    authContext: AuthContext,
    familyId: string,
    options: EnrolledFamilyUsersQuery,
  ): Promise<PaginatedResult<EnrolledFamilyUserEntity>> {
    const { userId, isSuperAdmin } = authContext;
    try {
      const family = await familyRepository.getById({ id: familyId });

      if (!family) {
        throw new ApiError(ApiErrorMessage.NOT_FOUND, {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: authContext.userId, familyId },
        });
      }

      const queryParams: ListEnrolledFamilyUsersOptions = {
        page: options.page,
        perPage: options.perPage,
        orderBy: { field: options.sortBy, direction: options.sortOrder },
        ...(options.role && { role: options.role }),
        ...(options.grade && { grade: options.grade }),
      };

      if (!isSuperAdmin) {
        await authorizationService.requirePermission(
          userId,
          FgaRelation.CAN_LIST_USERS,
          `${FgaType.FAMILY}:${familyId}`,
        );
      }

      return await familyRepository.getUsersByFamilyId(familyId, queryParams);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      logger.error(
        { err: error, context: { userId: authContext.userId, familyId, options } },
        'Failed to list family users',
      );

      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: authContext.userId, familyId },
        cause: error,
      });
    }
  }

  /**
   * Register a new caretaker and create their family.
   *
   * Implements the same Auth → DB → FGA saga as `POST /v1/users` with explicit compensation
   * so a failure in any system rolls back the others. The endpoint is public — there is no
   * authorization gate beyond the validators in the contract layer and the uniqueness checks
   * here.
   *
   * Operation sequence:
   * 1. Pre-flight email uniqueness (DB + Firebase Auth) — best-effort early failure to avoid
   *    creating an orphaned Firebase account.
   * 2. Firebase Auth `createUser` — produces the UID we store as `users.authId`.
   * 3. DB transaction:
   *    - Insert `users` (caretaker) → returns `caretakerId`
   *    - Insert `families` with `createdBy = caretakerId` → returns `familyId`. If the partial
   *      unique index `families_created_by_uniq_idx` fires, surface 422.
   *    - Insert `user_families` (`caretakerId`, `familyId`, role=parent)
   *    - Insert `rostering_provider_ids` (provider=dashboard, partnerId=familyId, entityId=caretakerId)
   * 4. On any DB failure: delete the Firebase Auth account (compensation).
   * 5. FGA tuple write for the caretaker's parent relation to the family. On FGA failure:
   *    delete the tuple, delete DB rows (rostering_provider_ids → user_families → families →
   *    users), then delete the Firebase account.
   *
   * @param input Caretaker credentials + name + optional family location
   * @returns The newly created family id
   * @throws {ApiError} 409 if the email is already in use (in `users` or in Firebase Auth)
   * @throws {ApiError} 422 if the caretaker already created a family (DB constraint)
   * @throws {ApiError} 429 if Firebase Auth rate-limits the create
   * @throws {ApiError} 500 on unexpected failures or unrecoverable compensation
   */
  async function create(input: CreateFamilyServiceInput): Promise<{ id: string }> {
    const { email, password, name, location } = input;

    // ── Step 1: Pre-flight email uniqueness ───────────────────────────────────
    //
    // Best-effort guard against creating an orphaned Firebase account for an email that
    // already exists in our DB. Not race-safe — concurrent registrations with the same
    // email may both pass here, in which case Firebase's `auth/email-already-exists` (step 2)
    // or the DB unique index (step 3) is the true last line of defense.

    const alreadyInDb = await userRepository.existsByUniqueFields({ email });
    if (alreadyInDb) {
      throw new ApiError(ApiErrorMessage.CONFLICT, {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
        context: { email },
      });
    }

    try {
      await FirebaseAuthClient.getUserByEmail(email);
      // If getUserByEmail succeeds, the account already exists in Firebase Auth.
      throw new ApiError(ApiErrorMessage.CONFLICT, {
        statusCode: StatusCodes.CONFLICT,
        code: ApiErrorCode.RESOURCE_CONFLICT,
        context: { email },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // `auth/user-not-found` is the expected case — swallow and continue.
      if (!isFirebaseError(error) || error.code !== FIREBASE_ERROR_CODES.AUTH.USER_NOT_FOUND) {
        logger.error({ err: error, context: { email } }, 'Firebase getUserByEmail failed during pre-flight');
        throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { email },
          cause: error,
        });
      }
    }

    // ── Step 2: Firebase Auth createUser ─────────────────────────────────────

    let firebaseUid: string;
    try {
      const authRecord = await FirebaseAuthClient.createUser({
        email,
        password,
        // Middle name is intentionally excluded from the Firebase displayName — Firebase only
        // uses this for surface UI like email templates, where "First Last" is the right shape.
        // The full name (including middle) is persisted to `users.nameMiddle` for our own use,
        // matching the convention in `POST /v1/users`.
        displayName: [name.first, name.last].filter(Boolean).join(' '),
      });
      firebaseUid = authRecord.uid;
    } catch (error) {
      if (isFirebaseError(error) && error.code === FIREBASE_ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { email },
        });
      }

      if (isFirebaseError(error) && error.code === FIREBASE_ERROR_CODES.AUTH.TOO_MANY_REQUESTS) {
        throw new ApiError(ApiErrorMessage.RATE_LIMITED, {
          statusCode: StatusCodes.TOO_MANY_REQUESTS,
          code: ApiErrorCode.RATE_LIMITED,
          context: { email },
          cause: error,
        });
      }

      logger.error({ err: error, context: { email } }, 'Firebase createUser failed');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { email },
        cause: error,
      });
    }

    // ── Step 3: DB transaction ────────────────────────────────────────────────
    //
    // All four DB writes (users, families, user_families, rostering_provider_ids) run in one
    // transaction so any failure rolls back atomically — only Firebase needs compensation.

    let caretakerId!: string;
    let familyId!: string;
    try {
      const result = await familyRepository.runTransaction({
        fn: async (tx) => {
          const created = await familyRepository.createWithCaretaker(
            {
              authId: firebaseUid,
              authProvider: [AuthProvider.PASSWORD],
              email,
              nameFirst: name.first,
              nameMiddle: name.middle ?? null,
              nameLast: name.last,
              userType: UserType.CAREGIVER,
              assessmentPid: generateAssessmentPid({ userId: email }),
              isSuperAdmin: false,
            },
            {
              locationAddressLine1: location?.addressLine1 ?? null,
              locationAddressLine2: location?.addressLine2 ?? null,
              locationCity: location?.city ?? null,
              locationStateProvince: location?.stateProvince ?? null,
              locationPostalCode: location?.postalCode ?? null,
              locationCountry: location?.country ?? null,
            },
            tx,
          );

          await rosterProviderIdRepository.create({
            data: {
              providerType: RosteringProvider.DASHBOARD,
              providerId: created.caretakerId,
              partnerId: created.familyId,
              entityType: RosteringEntityType.USER,
              entityId: created.caretakerId,
            },
            transaction: tx,
          });

          return created;
        },
      });

      caretakerId = result.caretakerId;
      familyId = result.familyId;
    } catch (error) {
      // DB rolled back atomically — only Firebase needs compensation.
      await compensateDeleteFirebaseUser(firebaseUid, email, 'step 3 failure');

      if (error instanceof ApiError) throw error;

      const dbError = unwrapDrizzleError(error);

      // The partial unique index on families.created_by maps to 422 — the caretaker has
      // already created a family. This is structurally different from email conflicts.
      if (isUniqueViolationOnConstraint(dbError, FAMILIES_CREATED_BY_UNIQ_IDX)) {
        throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
          context: { email },
          cause: error,
        });
      }

      // Any other unique violation (email index, etc.) is a 409.
      if (isUniqueViolation(dbError)) {
        throw new ApiError(ApiErrorMessage.CONFLICT, {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { email },
          cause: error,
        });
      }

      logger.error({ err: error, context: { email } }, 'DB write failed during family create');
      throw new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { email, firebaseUid },
        cause: error,
      });
    }

    // ── Step 4: FGA tuple writes ──────────────────────────────────────────────
    //
    // On failure: delete the tuple (best-effort), then DB rows (rostering_provider_ids first,
    // then user_families, families, users — to satisfy the FK / trigger ordering), then
    // Firebase. Each compensation step is wrapped in its own try/catch so a downstream
    // failure doesn't mask the original error.

    const parentTuple = familyMembershipTuple(caretakerId, familyId, UserFamilyRole.PARENT, new Date(), null);

    try {
      await authorizationService.writeTuplesOrThrow([parentTuple]);
    } catch (error) {
      logger.error(
        { err: error, context: { caretakerId, familyId, email, firebaseUid } },
        'FGA write failed during family create — beginning compensation',
      );

      await authorizationService.deleteTuples([
        { user: parentTuple.user, relation: parentTuple.relation, object: parentTuple.object },
      ]);

      try {
        await familyRepository.runTransaction({
          fn: async (tx) => {
            await rosterProviderIdRepository.deleteByEntityId(caretakerId, tx);
            await tx
              .delete(userFamilies)
              .where(and(eq(userFamilies.userId, caretakerId), eq(userFamilies.familyId, familyId)));
            await tx.delete(families).where(eq(families.id, familyId));
            await tx.delete(users).where(eq(users.id, caretakerId));
          },
        });
      } catch (dbDeleteError) {
        logger.error(
          { err: dbDeleteError, context: { caretakerId, familyId, firebaseUid } },
          'DB delete compensation failed after FGA write failure — manual cleanup required',
        );
      }

      await compensateDeleteFirebaseUser(firebaseUid, email, 'FGA write failure');

      throw new ApiError(ApiErrorMessage.EXTERNAL_SERVICE_UNAVAILABLE, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.EXTERNAL_SERVICE_FAILED,
        context: { caretakerId, familyId, email, firebaseUid },
        cause: error,
      });
    }

    logger.info({ caretakerId, familyId, email }, 'Created family via ROAR@Home registration');
    return { id: familyId };
  }

  /**
   * Delete a Firebase Auth account as a saga compensation step. Failures are logged with full
   * context but not re-thrown — the caller surfaces a 5xx to the client regardless. The
   * structured log gives a paper trail for manual reconciliation.
   */
  async function compensateDeleteFirebaseUser(firebaseUid: string, email: string, reason: string): Promise<void> {
    try {
      await FirebaseAuthClient.deleteUser(firebaseUid);
    } catch (compensationError) {
      logger.error(
        { err: compensationError, context: { firebaseUid, email, reason } },
        'Firebase deleteUser compensation failed — orphaned auth account requires manual cleanup',
      );
    }
  }

  return {
    create,
    listUsers,
  };
}
