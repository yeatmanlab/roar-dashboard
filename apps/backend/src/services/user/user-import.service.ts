import { randomUUID } from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import type { UserImportRecord, UserImportResult } from 'firebase-admin/auth';
import type { AuthContext } from '../../types/auth-context';
import type { UserType } from '../../enums/user-type.enum';
import type { Grade } from '../../enums/grade.enum';
import type { FreeReducedLunchStatus } from '../../enums/frl-status.enum';
import { UserRole } from '../../enums/user-role.enum';
import type { UserFamilyRole } from '../../enums/user-family-role.enum';
import { EntityType } from '../../types/entity-type';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { logger } from '../../logger';
import { UserRepository } from '../../repositories/user.repository';
import { FirebaseAuthClient } from '../../clients/firebase-auth.clients';
import { isFirebaseError } from '../../types/firebase';
import { FIREBASE_ERROR_CODES } from '../../constants/firebase-error-codes';
import { generateAssessmentPid } from '../../utils/assessment-pid.util';
import { AuthorizationService } from '../authorization/authorization.service';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { UserService } from './user.service';
import {
  hashPasswordForImport,
  getFirebaseScryptParamsFromEnv,
  type FirebaseScryptParams,
} from './utils/firebase-password-hash';

/**
 * UserImportService
 *
 * Bulk create / update / unenroll users from a single request, the backend replacement for the
 * legacy `batchImportUpdate` cloud function that backs the dashboard's CSV upload. Each row is
 * classified by email into one of three bins and processed against Firebase Auth, Postgres, and
 * OpenFGA with per-row atomicity — a failure on one row never affects the others, and every row's
 * outcome is reported individually.
 *
 * **Create bin** (implemented): all rows' Firebase accounts are created in a single `importUsers`
 * call (one round-trip, no per-account rate limit — the reason this endpoint exists), then each is
 * persisted via {@link UserService.createWithImportedAuth}, which runs the same DB+FGA saga and
 * compensation as single-create. Passwords are SCRYPT-hashed for `importUsers`.
 *
 * **Update / unenroll bins**: tracked as the next increment — they require new repository support
 * for enrollment-ending, `rosteringEnded` archiving, and membership reconciliation. Until then, such
 * rows are reported as a per-row failure rather than silently mishandled.
 *
 * Authorization mirrors single-create and is applied per row: super admin, or `can_create_users` on
 * every membership target (the legacy uses the same coarse permission for all three bins).
 */

const CLASSIFICATION = {
  CREATED: 'created',
  UPDATED: 'updated',
  UNENROLLED: 'unenrolled',
} as const;

type Classification = (typeof CLASSIFICATION)[keyof typeof CLASSIFICATION];

interface ImportRowMembership {
  entityType: EntityType;
  entityId: string;
  // Org roles use UserRole; family memberships use UserFamilyRole (parent/child). The flat union
  // mirrors how the contract's discriminated membership union is inferred at the service boundary.
  role: UserRole | UserFamilyRole;
  enrollmentStart?: string | undefined;
  enrollmentEnd?: string | undefined;
}

/** A single import row. Mirrors the single-create payload plus `unenroll` and an optional password. */
export interface ImportUserRowInput {
  email: string;
  password?: string | undefined;
  name: { first: string; middle?: string | null | undefined; last: string };
  userType: UserType;
  dob?: string | null | undefined;
  grade?: Grade | null | undefined;
  demographics?:
    | {
        statusEll?: string | null | undefined;
        statusFrl?: FreeReducedLunchStatus | null | undefined;
        statusIep?: string | null | undefined;
        gender?: string | null | undefined;
        race?: string | null | undefined;
        hispanicEthnicity?: boolean | null | undefined;
        homeLanguage?: string | null | undefined;
      }
    | undefined;
  identifiers?: { stateId?: string | undefined; pid?: string | undefined } | undefined;
  unenroll?: boolean | undefined;
  memberships: ImportRowMembership[];
}

/** Per-row outcome. Successful rows carry the resulting user id; failed rows carry a safe code/message. */
export type ImportRowOutcome =
  | { index: number; classification: Classification; status: 'ok'; id: string }
  | { index: number; classification: Classification; status: 'failed'; error: { code: string; message: string } };

function ok(index: number, classification: Classification, id: string): ImportRowOutcome {
  return { index, classification, status: 'ok', id };
}

function failed(index: number, classification: Classification, code: string, message: string): ImportRowOutcome {
  return { index, classification, status: 'failed', error: { code, message } };
}

/** Map an ApiError (or unknown error) to a safe per-row failure outcome. */
function toFailedOutcome(index: number, classification: Classification, error: unknown): ImportRowOutcome {
  if (error instanceof ApiError) {
    return failed(index, classification, error.code, error.message);
  }
  return failed(index, classification, ApiErrorCode.INTERNAL, ApiErrorMessage.INTERNAL_SERVER_ERROR);
}

/** Best-effort classification for a row that fails before bin routing (e.g. authorization). */
function preRoutingClassification(row: ImportUserRowInput): Classification {
  return row.unenroll ? CLASSIFICATION.UNENROLLED : CLASSIFICATION.CREATED;
}

export function UserImportService({
  userService = UserService(),
  userRepository = new UserRepository(),
  authorizationService = AuthorizationService(),
  firebaseAuth = FirebaseAuthClient,
  scryptParams,
}: {
  userService?: ReturnType<typeof UserService>;
  userRepository?: UserRepository;
  authorizationService?: ReturnType<typeof AuthorizationService>;
  firebaseAuth?: typeof FirebaseAuthClient;
  scryptParams?: FirebaseScryptParams;
} = {}) {
  const ENTITY_TYPE_TO_FGA_TYPE: Record<EntityType, FgaType> = {
    district: FgaType.DISTRICT,
    school: FgaType.SCHOOL,
    class: FgaType.CLASS,
    group: FgaType.GROUP,
    family: FgaType.FAMILY,
  };

  // Read scrypt params lazily so importing this module (or constructing the service in a test that
  // never reaches the create bin) doesn't require the secrets to be present.
  function getScryptParams(): FirebaseScryptParams {
    return scryptParams ?? getFirebaseScryptParamsFromEnv();
  }

  /**
   * Authorize a row's memberships, mirroring single-create's authorization. Super admins bypass FGA;
   * non-super-admins must hold `can_create_users` on every membership target (class memberships are
   * checked against the parent school). Throws `ApiError` (FORBIDDEN / UNPROCESSABLE_ENTITY) on deny.
   *
   * The same permission gates create, update, and unenroll — matching the legacy cloud function,
   * which validates the requester's org coverage identically for all three.
   */
  async function authorizeRow(authContext: AuthContext, memberships: ImportRowMembership[]): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    if (isSuperAdmin) return;

    // Guard against a non-super-admin creating a platform_admin.
    for (const m of memberships) {
      if (m.entityType !== EntityType.FAMILY && m.role === UserRole.PLATFORM_ADMIN) {
        logger.warn({ userId, attemptedRole: m.role }, 'Non-super-admin attempted to import a platform_admin');
        throw new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId },
        });
      }
    }

    for (const membership of memberships) {
      if (membership.entityType === EntityType.CLASS) {
        const schoolId = await userRepository.findClassParentSchool(membership.entityId);
        if (!schoolId) {
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
      // FAMILY memberships intentionally skip the FGA check here, matching single-create's
      // outstanding authorization gap (roar-project-management#1774).
    }
  }

  /** Returns true if a Firebase Auth account already exists for the email. */
  async function firebaseEmailExists(email: string): Promise<boolean> {
    try {
      await firebaseAuth.getUserByEmail(email);
      return true;
    } catch (error) {
      if (isFirebaseError(error) && error.code === FIREBASE_ERROR_CODES.AUTH.USER_NOT_FOUND) {
        return false;
      }
      throw error;
    }
  }

  /** Map a Firebase `importUsers` FailedAccount error to a safe per-row error code. */
  function mapImportError(error: unknown): string {
    if (isFirebaseError(error) && error.code === FIREBASE_ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS) {
      return ApiErrorCode.RESOURCE_CONFLICT;
    }
    return ApiErrorCode.EXTERNAL_SERVICE_FAILED;
  }

  /** Build the {@link UserService.createWithImportedAuth} payload for a create row. */
  function toCreateUserData(row: ImportUserRowInput, assessmentPid: string) {
    return {
      email: row.email,
      // Unused by createWithImportedAuth (the account is already created); kept for type shape.
      password: row.password ?? '',
      name: { first: row.name.first, middle: row.name.middle ?? undefined, last: row.name.last },
      userType: row.userType,
      dob: row.dob ?? undefined,
      grade: row.grade ?? undefined,
      demographics: row.demographics ?? undefined,
      identifiers: { ...row.identifiers, pid: assessmentPid },
      memberships: row.memberships,
    };
  }

  /**
   * Process the create bin: within-batch + Postgres + Firebase uniqueness pre-checks, then one
   * `importUsers` call, then per-row persistence with compensation. Writes each row's outcome into
   * `outcomes` by its original index.
   */
  async function processCreateBin(
    authContext: AuthContext,
    rows: { index: number; row: ImportUserRowInput }[],
    outcomes: ImportRowOutcome[],
  ): Promise<void> {
    if (rows.length === 0) return;

    // Within-batch email uniqueness — importUsers does not validate it.
    const seenEmails = new Set<string>();
    const candidates: { index: number; row: ImportUserRowInput }[] = [];
    for (const candidate of rows) {
      const key = candidate.row.email.toLowerCase();
      if (seenEmails.has(key)) {
        outcomes[candidate.index] = failed(
          candidate.index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.RESOURCE_CONFLICT,
          ApiErrorMessage.CONFLICT,
        );
        continue;
      }
      seenEmails.add(key);
      candidates.push(candidate);
    }

    const params = getScryptParams();

    // Pre-flight each candidate: password required, PID + Postgres/Firebase uniqueness, then hash.
    const prepared: {
      index: number;
      row: ImportUserRowInput;
      firebaseUid: string;
      assessmentPid: string;
      passwordHash: Buffer;
      passwordSalt: Buffer;
    }[] = [];

    for (const candidate of candidates) {
      const { index, row } = candidate;

      if (!row.password) {
        outcomes[index] = failed(
          index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.REQUEST_VALIDATION_FAILED,
          'Password is required to create a user',
        );
        continue;
      }

      const assessmentPid = row.identifiers?.pid ?? generateAssessmentPid({ userId: row.email });

      try {
        const exists = await userRepository.existsByUniqueFields({ email: row.email, assessmentPid });
        if (exists || (await firebaseEmailExists(row.email))) {
          outcomes[index] = failed(
            index,
            CLASSIFICATION.CREATED,
            ApiErrorCode.RESOURCE_CONFLICT,
            ApiErrorMessage.CONFLICT,
          );
          continue;
        }
      } catch (error) {
        logger.error({ err: error, context: { email: row.email } }, 'Uniqueness pre-check failed during import');
        outcomes[index] = failed(
          index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          ApiErrorMessage.INTERNAL_SERVER_ERROR,
        );
        continue;
      }

      const { passwordHash, passwordSalt } = await hashPasswordForImport(row.password, params);
      prepared.push({ index, row, firebaseUid: randomUUID(), assessmentPid, passwordHash, passwordSalt });
    }

    if (prepared.length === 0) return;

    // One batched importUsers call for every prepared row.
    const records: UserImportRecord[] = prepared.map((p) => ({
      uid: p.firebaseUid,
      email: p.row.email,
      displayName: [p.row.name.first, p.row.name.last].filter(Boolean).join(' '),
      passwordHash: p.passwordHash,
      passwordSalt: p.passwordSalt,
    }));

    let result: UserImportResult;
    try {
      result = await firebaseAuth.importUsers(records, {
        hash: {
          algorithm: 'SCRYPT' as const,
          key: params.signerKey,
          saltSeparator: params.saltSeparator,
          rounds: params.rounds,
          memoryCost: params.memoryCost,
        },
      });
    } catch (error) {
      // The whole importUsers call failed (e.g. Admin SDK unavailable). Fail every prepared row;
      // nothing was persisted, so there is nothing to compensate.
      logger.error({ err: error, context: { count: prepared.length } }, 'importUsers call failed');
      for (const p of prepared) {
        outcomes[p.index] = failed(
          p.index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          ApiErrorMessage.INTERNAL_SERVER_ERROR,
        );
      }
      return;
    }

    // Mark rows that Firebase rejected (by their position in the records array).
    const failedRecordIndexes = new Set<number>();
    for (const failure of result.errors ?? []) {
      failedRecordIndexes.add(failure.index);
      const p = prepared[failure.index];
      if (p) {
        outcomes[p.index] = failed(
          p.index,
          CLASSIFICATION.CREATED,
          mapImportError(failure.error),
          ApiErrorMessage.CONFLICT,
        );
      }
    }

    // Persist each successfully-imported row. createWithImportedAuth compensates (incl. deleting the
    // imported Firebase account) on any DB/FGA failure, so a failed row leaves no orphan.
    for (let i = 0; i < prepared.length; i++) {
      if (failedRecordIndexes.has(i)) continue;
      const p = prepared[i]!;
      try {
        const { id } = await userService.createWithImportedAuth(
          authContext,
          toCreateUserData(p.row, p.assessmentPid),
          p.firebaseUid,
        );
        outcomes[p.index] = ok(p.index, CLASSIFICATION.CREATED, id);
      } catch (error) {
        outcomes[p.index] = toFailedOutcome(p.index, CLASSIFICATION.CREATED, error);
      }
    }
  }

  /**
   * Classify each row into create / update / unenroll and process each bin.
   *
   * @param authContext - The requesting user's auth context.
   * @param rows - The import rows, in request order.
   * @returns Per-row outcomes, one per input row, in request order.
   */
  async function bulkImport(authContext: AuthContext, rows: ImportUserRowInput[]): Promise<ImportRowOutcome[]> {
    const outcomes: ImportRowOutcome[] = new Array(rows.length);

    // ── Phase 1: per-row authorization (before any external writes) ──────────────
    const authorized: { index: number; row: ImportUserRowInput }[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]!;
      try {
        await authorizeRow(authContext, row.memberships);
        authorized.push({ index, row });
      } catch (error) {
        outcomes[index] = toFailedOutcome(index, preRoutingClassification(row), error);
      }
    }

    if (authorized.length === 0) return outcomes;

    // ── Phase 2: classify by email existence (single batched lookup) ─────────────
    const existing = await userRepository.findByEmails(authorized.map((a) => a.row.email));
    const existingByEmail = new Map<string, (typeof existing)[number]>();
    for (const user of existing) {
      if (user.email) existingByEmail.set(user.email.toLowerCase(), user);
    }

    const createRows: { index: number; row: ImportUserRowInput }[] = [];
    const updateRows: { index: number; row: ImportUserRowInput }[] = [];
    const unenrollRows: { index: number; row: ImportUserRowInput }[] = [];

    for (const entry of authorized) {
      const found = existingByEmail.has(entry.row.email.toLowerCase());
      const unenroll = Boolean(entry.row.unenroll);

      if (found && unenroll) {
        unenrollRows.push(entry);
      } else if (found) {
        updateRows.push(entry);
      } else if (unenroll) {
        // Unenroll requested for a user that does not exist.
        // NOTE: the legacy cloud function routes this to the unenroll bin as a no-op rather than
        // rejecting. We reject per the ticket spec; revisit if strict parity is preferred.
        outcomes[entry.index] = failed(
          entry.index,
          CLASSIFICATION.UNENROLLED,
          ApiErrorCode.RESOURCE_NOT_FOUND,
          ApiErrorMessage.UNPROCESSABLE_ENTITY,
        );
      } else {
        createRows.push(entry);
      }
    }

    // ── Phase 3: create bin ──────────────────────────────────────────────────────
    await processCreateBin(authContext, createRows, outcomes);

    // ── Phases 4–5: update + unenroll bins (next increment) ──────────────────────
    // These require new repository support (enrollment-ending, rosteringEnded archiving, membership
    // reconciliation) and a per-row updateUser path for password/name. Until then, report rather
    // than silently mishandle.
    for (const entry of updateRows) {
      outcomes[entry.index] = failed(
        entry.index,
        CLASSIFICATION.UPDATED,
        ApiErrorCode.INTERNAL,
        'Update of existing users is not yet supported by this endpoint',
      );
    }
    for (const entry of unenrollRows) {
      outcomes[entry.index] = failed(
        entry.index,
        CLASSIFICATION.UNENROLLED,
        ApiErrorCode.INTERNAL,
        'Unenrollment is not yet supported by this endpoint',
      );
    }

    return outcomes;
  }

  return { bulkImport };
}
