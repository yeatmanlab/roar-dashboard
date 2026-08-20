import { randomUUID } from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import type { UserImportRecord, UserImportResult } from 'firebase-admin/auth';
import type { TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import type { User } from '../../db/schema';
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
import { FgaType, FgaRelation, FGA_CLASS_VALID_ROLES } from '../authorization/fga-constants';
import {
  districtMembershipTuple,
  schoolMembershipTuple,
  classMembershipTuple,
  groupMembershipTuple,
  familyMembershipTuple,
} from '../authorization/helpers/fga-tuples';
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
 * **Unenroll bin** (implemented): ends all of a user's enrollments and archives them
 * (`rosteringEnded`) in one transaction, then best-effort deletes their FGA membership tuples.
 *
 * **Update bin** (implemented): updates an existing user's profile fields, reconciles their
 * memberships (replace-semantics per the legacy, with FGA tuple add/delete sync), and syncs Firebase
 * Auth (displayName / password) when they changed.
 *
 * Authorization mirrors single-create and is applied per row: super admin, or `can_create_users` on
 * every membership target (the legacy uses the same coarse permission for all three bins). Create
 * rows are checked against the memberships they declare; update and unenroll rows against the
 * target user's current memberships, since the row's declared set says nothing about the
 * requester's rights over an existing user.
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

/**
 * The subset of membership fields `authorizeRow` actually needs. Loose enough to accept both a
 * declared row's memberships and `getActiveMembershipsWithRoles`' DB-sourced shape, since unenroll
 * rows authorize against the latter rather than the former (see `authorizeUnenrollRow`).
 */
type MembershipForAuthCheck = { entityType: EntityType; entityId: string; role: string };

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
    // error.code is technically never undefined, but fall back to INTERNAL to satisfy the schema
    return failed(index, classification, error.code ?? ApiErrorCode.INTERNAL, error.message);
  }
  return failed(index, classification, ApiErrorCode.INTERNAL, ApiErrorMessage.INTERNAL_SERVER_ERROR);
}

/** Best-effort classification for a row that fails before bin routing (e.g. authorization). */
function preRoutingClassification(row: ImportUserRowInput): Classification {
  return row.unenroll ? CLASSIFICATION.UNENROLLED : CLASSIFICATION.CREATED;
}

/** Resolved parentage for the schools and classes declared across a batch. */
type OrgHierarchyParents = Awaited<ReturnType<UserRepository['getOrgHierarchyParents']>>;

/**
 * Per-request memo for the repeated lookups in `authorizeRow`. Created per `bulkImport` call, never
 * at module or service scope — a permission revoked between requests must not read as still granted.
 */
type AuthorizeCaches = {
  permissions: Map<string, Promise<void>>;
  classParents: Map<string, Promise<string | null>>;
};

/** Collect the entity IDs a row declares for one entity type. */
function declaredIds(row: ImportUserRowInput, entityType: EntityType): Set<string> {
  const ids = new Set<string>();
  for (const membership of row.memberships) {
    if (membership.entityType === entityType) ids.add(membership.entityId);
  }
  return ids;
}

/** A row declared an org that doesn't exist, is the wrong type, or is rostered out. */
function unresolvedEntity(context: Record<string, unknown>): ApiError {
  return new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
    statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
    code: ApiErrorCode.RESOURCE_NOT_FOUND,
    context,
  });
}

/**
 * Verify that a row's declared orgs are mutually consistent: each declared school sits under a
 * declared district, and each declared class sits under a declared school and district. FGA
 * authorizes each membership independently, so this validation is required. Unresolved IDs (missing, wrong
 * org type, rostered out) fail here too, since they're absent from `parents`.
 *
 * Only pairs the row actually declares are compared, and declared orgs act as an allowlist — so a
 * class-only row passes, as does a row naming two schools and a class in either one.
 *
 * Which combinations are *required* is not enforced. The dashboard's CSV upload
 * (`RegisterStudents.vue`) requires district+school[+class], group, or family because it resolves
 * org names in that order — a name-resolution constraint, not a data invariant. Tightening it here
 * would also have to handle non-student users: a district-only row is legitimate for a
 * `platform_admin` (see the `district` type in `packages/authz/authorization-model.fga`).
 *
 * @param row - The import row to validate.
 * @param parents - Batch-resolved parentage from `getOrgHierarchyParents`.
 * @throws {ApiError} UNPROCESSABLE_ENTITY if a declared org is unresolved or inconsistent.
 * @throws {ApiError} INTERNAL_SERVER_ERROR if a resolved school has no parent district.
 */
function validateRowHierarchy(row: ImportUserRowInput, parents: OrgHierarchyParents): void {
  const districts = declaredIds(row, EntityType.DISTRICT);
  const schools = declaredIds(row, EntityType.SCHOOL);

  for (const schoolId of schools) {
    const school = parents.schools.get(schoolId);
    if (!school) throw unresolvedEntity({ schoolId });

    // Every school is created with a parent district (school.service.ts), but `orgs.parentOrgId`
    // is nullable with no CHECK backing it — so a parentless school is corrupt data, not a bad
    // row. Reporting 422 here would send the operator hunting for a typo that doesn't exist.
    if (school.districtId === null) {
      logger.error({ schoolId }, 'School has no parent district — orgs hierarchy invariant violated');
      throw new ApiError('Failed to validate organization hierarchy', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { schoolId },
      });
    }

    if (districts.size > 0 && !districts.has(school.districtId)) {
      throw unresolvedEntity({ schoolId, parentDistrictId: school.districtId });
    }
  }

  for (const classId of declaredIds(row, EntityType.CLASS)) {
    const declaredClass = parents.classes.get(classId);
    if (!declaredClass) throw unresolvedEntity({ classId });

    if (schools.size > 0 && !schools.has(declaredClass.schoolId)) {
      throw unresolvedEntity({ classId, parentSchoolId: declaredClass.schoolId });
    }
    if (districts.size > 0 && !districts.has(declaredClass.districtId)) {
      throw unresolvedEntity({ classId, parentDistrictId: declaredClass.districtId });
    }
  }
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
   * Authorize a set of memberships, mirroring single-create's authorization. Super admins bypass FGA;
   * non-super-admins must hold `can_create_users` on every membership target (class memberships are
   * checked against the parent school). Throws `ApiError` (FORBIDDEN / UNPROCESSABLE_ENTITY) on deny.
   *
   * The same permission gates create, update, and unenroll — matching the legacy cloud function,
   * which validates the requester's org coverage identically for all three. For create/update rows
   * this is called with the row's declared `memberships` (what's about to be granted). For unenroll
   * rows it's called with the target user's actual current memberships fetched from the DB (see
   * processUnenrollBin), since that — not whatever the row declares — is what unenrolling affects.
   */
  async function authorizeRow(
    authContext: AuthContext,
    memberships: MembershipForAuthCheck[],
    caches: AuthorizeCaches,
  ): Promise<void> {
    const { userId, isSuperAdmin } = authContext;

    if (isSuperAdmin) return;

    // No memberships to check means nothing to authorize against — fail closed rather than fall
    // through both loops and return as if authorized. Reachable via processUnenrollBin, where
    // memberships come from the target's actual (possibly empty) current enrollments, not a
    // schema-validated row.
    if (memberships.length === 0) {
      logger.warn({ userId }, 'Non-super-admin attempted to authorize a row with no checkable memberships');
      throw new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId },
      });
    }

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

    // Both lookups are memoized per request: a batch names the same few orgs on every row, so the
    // distinct set is O(1) in the row count. Promises are cached rather than values, so rows share
    // one in-flight call. Cached rejections are safe to replay — the key covers everything the
    // resulting ApiError reports.
    //
    // Class parents are resolved here rather than reused from Phase 0's `getOrgHierarchyParents`
    // map, so a declared class is looked up twice per batch (once each). Kept separate on purpose:
    // the update and unenroll bins authorize against the target's *current* memberships, which can
    // include classes no row declared and the map therefore doesn't cover.
    for (const membership of memberships) {
      // FAMILY memberships intentionally skip the FGA check, matching single-create's outstanding
      // authorization gap (roar-project-management#1774).
      if (membership.entityType === EntityType.FAMILY) continue;

      let object: string;

      if (membership.entityType === EntityType.CLASS) {
        let parent = caches.classParents.get(membership.entityId);
        if (!parent) {
          parent = userRepository.findClassParentSchool(membership.entityId);
          caches.classParents.set(membership.entityId, parent);
        }

        const schoolId = await parent;
        if (!schoolId) {
          throw new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            code: ApiErrorCode.RESOURCE_NOT_FOUND,
            context: { userId, classId: membership.entityId },
          });
        }

        object = `${FgaType.SCHOOL}:${schoolId}`;
      } else {
        object = `${ENTITY_TYPE_TO_FGA_TYPE[membership.entityType]}:${membership.entityId}`;
      }

      const key = `${userId}|${object}`;
      let check = caches.permissions.get(key);
      if (!check) {
        check = authorizationService.requirePermission(userId, FgaRelation.CAN_CREATE_USERS, object);
        caches.permissions.set(key, check);
      }

      await check;
    }
  }

  /**
   * Batch-check which of the given emails already have a Firebase Auth account. Uses the Admin SDK's
   * `getUsers` (one call for up to 100 identifiers — the batch cap) instead of a per-row
   * `getUserByEmail`, keeping Firebase round-trips to one regardless of batch size
   * (performance-avoid-quadratic).
   *
   * @returns A set of the lowercased emails that already exist in Firebase Auth.
   */
  async function getExistingFirebaseEmails(emails: string[]): Promise<Set<string>> {
    if (emails.length === 0) return new Set();
    const { users } = await firebaseAuth.getUsers(emails.map((email) => ({ email })));
    return new Set(users.map((user) => user.email?.toLowerCase()).filter((email): email is string => Boolean(email)));
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

    // Config, not a per-row concern — but it must not throw past this function. An unhandled
    // throw here would propagate out of processCreateBin and abort bulkImport entirely, taking
    // down the unenroll/update bins with it even though their rows already passed authorization
    // and classification. Scoping the failure to the create bin's own rows instead.
    let params: FirebaseScryptParams;
    try {
      params = getScryptParams();
    } catch (error) {
      logger.error(
        { err: error, context: { count: candidates.length } },
        'Missing/invalid Firebase scrypt configuration',
      );
      for (const candidate of candidates) {
        outcomes[candidate.index] = failed(
          candidate.index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.INTERNAL,
          ApiErrorMessage.INTERNAL_SERVER_ERROR,
        );
      }
      return;
    }

    // Batch Firebase existence check — one getUsers call for the whole batch (≤100). importUsers
    // bypasses uniqueness validation, so we must pre-check; batching avoids per-row round-trips.
    let firebaseExistingEmails: Set<string>;
    try {
      firebaseExistingEmails = await getExistingFirebaseEmails(candidates.map((candidate) => candidate.row.email));
    } catch (error) {
      logger.error({ err: error, context: { count: candidates.length } }, 'Firebase getUsers pre-check failed');
      for (const candidate of candidates) {
        outcomes[candidate.index] = failed(
          candidate.index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          ApiErrorMessage.INTERNAL_SERVER_ERROR,
        );
      }
      return;
    }

    // Pre-flight each candidate: password required, within-batch PID + Postgres/Firebase uniqueness,
    // then hash. Note: super admins skip the explicit membership-existence pre-flight that
    // single-create performs; an invalid entity instead fails at the FK constraint inside
    // createWithImportedAuth, which compensates by deleting the just-imported Firebase account
    // (no orphan, just slightly more create+delete churn for that row).
    const seenPids = new Set<string>();
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
          ApiErrorMessage.REQUEST_VALIDATION_FAILED,
        );
        continue;
      }

      const assessmentPid = row.identifiers?.pid ?? generateAssessmentPid({ userId: row.email });

      // Within-batch PID uniqueness (email is already deduped above; importUsers validates neither).
      if (seenPids.has(assessmentPid)) {
        outcomes[index] = failed(
          index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.RESOURCE_CONFLICT,
          ApiErrorMessage.CONFLICT,
        );
        continue;
      }
      seenPids.add(assessmentPid);

      if (firebaseExistingEmails.has(row.email.toLowerCase())) {
        outcomes[index] = failed(
          index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.RESOURCE_CONFLICT,
          ApiErrorMessage.CONFLICT,
        );
        continue;
      }

      try {
        if (await userRepository.existsByUniqueFields({ email: row.email, assessmentPid })) {
          outcomes[index] = failed(
            index,
            CLASSIFICATION.CREATED,
            ApiErrorCode.RESOURCE_CONFLICT,
            ApiErrorMessage.CONFLICT,
          );
          continue;
        }
      } catch (error) {
        logger.error(
          { err: error, context: { email: row.email } },
          'Postgres uniqueness pre-check failed during import',
        );
        outcomes[index] = failed(
          index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          ApiErrorMessage.INTERNAL_SERVER_ERROR,
        );
        continue;
      }

      let passwordHash: Buffer;
      let passwordSalt: Buffer;
      try {
        ({ passwordHash, passwordSalt } = await hashPasswordForImport(row.password, params));
      } catch (error) {
        logger.error({ err: error, context: { email: row.email } }, 'Password hashing failed during import');
        outcomes[index] = failed(
          index,
          CLASSIFICATION.CREATED,
          ApiErrorCode.INTERNAL,
          ApiErrorMessage.INTERNAL_SERVER_ERROR,
        );
        continue;
      }
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
    for (const failure of result.errors) {
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
   * Build the FGA membership tuples to delete when unenrolling a user. Mirrors the relations
   * single-create wrote — a `user:<id>` → `<role>` → `<type>:<id>` tuple per membership — skipping
   * class memberships whose role isn't FGA-valid (those cascade via the org hierarchy and were never
   * written to the class type). Conditions are omitted: FGA deletes by tuple key.
   */
  function buildMembershipDeletionTuples(
    userId: string,
    memberships: { entityType: EntityType; entityId: string; role: string }[],
  ): TupleKeyWithoutCondition[] {
    const validClassRoles = FGA_CLASS_VALID_ROLES as ReadonlySet<string>;
    const tuples: TupleKeyWithoutCondition[] = [];
    for (const m of memberships) {
      if (m.entityType === EntityType.CLASS && !validClassRoles.has(m.role)) continue;
      tuples.push({
        user: `user:${userId}`,
        relation: m.role,
        object: `${ENTITY_TYPE_TO_FGA_TYPE[m.entityType]}:${m.entityId}`,
      });
    }
    return tuples;
  }

  /**
   * Build the FGA membership tuples to write for newly-added memberships, carrying the
   * `active_membership` condition (grant window starting now). Mirrors single-create's
   * buildMembershipTuples — class tuples are only written for FGA-valid roles.
   */
  function buildMembershipAdditionTuples(
    userId: string,
    memberships: { entityType: EntityType; entityId: string; role: string }[],
  ): TupleKey[] {
    const validClassRoles = FGA_CLASS_VALID_ROLES as ReadonlySet<string>;
    const tuples: TupleKey[] = [];
    const start = new Date();
    for (const m of memberships) {
      switch (m.entityType) {
        case EntityType.DISTRICT:
          tuples.push(districtMembershipTuple(userId, m.entityId, m.role as UserRole, start, null));
          break;
        case EntityType.SCHOOL:
          tuples.push(schoolMembershipTuple(userId, m.entityId, m.role as UserRole, start, null));
          break;
        case EntityType.CLASS:
          if (validClassRoles.has(m.role)) {
            tuples.push(classMembershipTuple(userId, m.entityId, m.role as UserRole, start, null));
          }
          break;
        case EntityType.GROUP:
          tuples.push(groupMembershipTuple(userId, m.entityId, m.role as UserRole, start, null));
          break;
        case EntityType.FAMILY:
          tuples.push(familyMembershipTuple(userId, m.entityId, m.role as UserFamilyRole, start, null));
          break;
      }
    }
    return tuples;
  }

  /**
   * Process the unenroll bin: per row, end ALL of the user's enrollments and archive them
   * (`rosteringEnded`) in one transaction, then best-effort delete their FGA membership tuples.
   *
   * Ending the DB enrollment does not expire the FGA tuple's stored grant window, so explicit cleanup
   * is required for the user to actually lose access. Matches the legacy `batchImportUpdate`, which
   * unenrolls a user from every org and archives them regardless of which memberships the row names.
   *
   * Authorization happens here rather than in `bulkImport`'s Phase 1: since unenrolling acts on the
   * user's actual current memberships and not on anything the row declares, permission is checked
   * against that same DB-fetched list, immediately before it's used to end the enrollments — reusing
   * the lookup rather than issuing a second query.
   */
  async function processUnenrollBin(
    authContext: AuthContext,
    rows: { index: number; user: User }[],
    outcomes: ImportRowOutcome[],
    caches: AuthorizeCaches,
  ): Promise<void> {
    for (const { index, user } of rows) {
      try {
        // Capture the tuples to delete before ending the enrollments (afterward they read inactive).
        const memberships = await userRepository.getActiveMembershipsWithRoles(user.id);

        await authorizeRow(authContext, memberships, caches);

        await userRepository.runTransaction({
          fn: async (tx) => {
            await userRepository.endAllEnrollments(user.id, tx);
            await userRepository.archiveUser(user.id, tx);
          },
        });

        // Best-effort: deleteTuples is fire-and-forget (logs on failure, never throws), so a stale
        // tuple can't fail the row after the DB state has already committed.
        const tuples = buildMembershipDeletionTuples(user.id, memberships);
        if (tuples.length > 0) {
          await authorizationService.deleteTuples(tuples);
        }

        outcomes[index] = ok(index, CLASSIFICATION.UNENROLLED, user.id);
      } catch (error) {
        logger.error({ err: error, context: { userId: user.id } }, 'Unenroll failed during import');
        outcomes[index] = toFailedOutcome(index, CLASSIFICATION.UNENROLLED, error);
      }
    }
  }

  /**
   * Map an import row to the user-table fields an update writes. Import rows always carry the full
   * name; other profile fields are written only when provided (an omitted field is left unchanged).
   */
  function toUpdateUserFields(row: ImportUserRowInput) {
    return {
      nameFirst: row.name.first,
      nameLast: row.name.last,
      // Middle name is optional — only write it when the row carries it, so an omitted middle
      // doesn't clobber an existing stored value.
      ...(row.name.middle !== undefined && { nameMiddle: row.name.middle }),
      ...(row.dob !== undefined && { dob: row.dob ?? null }),
      ...(row.grade !== undefined && { grade: row.grade ?? null }),
      ...(row.demographics && {
        statusEll: row.demographics.statusEll ?? null,
        statusFrl: row.demographics.statusFrl ?? null,
        statusIep: row.demographics.statusIep ?? null,
        gender: row.demographics.gender ?? null,
        race: row.demographics.race ?? null,
        hispanicEthnicity: row.demographics.hispanicEthnicity ?? null,
        homeLanguage: row.demographics.homeLanguage ?? null,
      }),
      ...(row.identifiers?.stateId !== undefined && { stateId: row.identifiers.stateId }),
    };
  }

  /**
   * Build the Firebase Auth update for an update row, or null if nothing auth-related changed.
   * `displayName` is synced only when the name actually changed; the password is set when provided.
   * This keeps update-bin Firebase writes off the per-row path for pure profile/demographic updates.
   */
  function buildAuthUpdate(row: ImportUserRowInput, user: User): { displayName?: string; password?: string } | null {
    const update: { displayName?: string; password?: string } = {};

    const nameChanged =
      row.name.first !== user.nameFirst ||
      row.name.last !== user.nameLast ||
      (row.name.middle ?? null) !== (user.nameMiddle ?? null);
    if (nameChanged) {
      update.displayName = [row.name.first, row.name.last].filter(Boolean).join(' ');
    }
    if (row.password) {
      update.password = row.password;
    }

    return Object.keys(update).length > 0 ? update : null;
  }

  /**
   * Process the update bin: update each existing user's profile fields, reconcile their memberships
   * (replace-semantics per provided entity type — end removed, add/reactivate new, leave unchanged),
   * and sync Firebase Auth (displayName / password) only when those actually changed.
   *
   * Profile fields and membership reconciliation run in one transaction; FGA tuples are then synced
   * (written for added memberships, best-effort deleted for removed). Rostering-ended (archived) users
   * are rejected (not-found), matching the canonical single-update.
   *
   * Authorizes each row against the target's current memberships (like the unenroll bin), since
   * Phase 1's check covers only the orgs the row declares.
   */
  async function processUpdateBin(
    authContext: AuthContext,
    rows: { index: number; row: ImportUserRowInput; user: User }[],
    outcomes: ImportRowOutcome[],
    caches: AuthorizeCaches,
  ): Promise<void> {
    for (const { index, row, user } of rows) {
      try {
        // Rostering-ended (archived) users are not-found for updates, matching the canonical
        // single-update (404). Never resurrect profile/auth state on an archived account.
        if (user.rosteringEnded) {
          outcomes[index] = failed(
            index,
            CLASSIFICATION.UPDATED,
            ApiErrorCode.RESOURCE_NOT_FOUND,
            ApiErrorMessage.NOT_FOUND,
          );
          continue;
        }

        // No Firebase account to attach a password to — matches single-update's 422. Checked
        // before any DB write so a rejection can't leave a partial update.
        // TODO: once rostering sync + SSO login exist, an SSO-only user could have a non-null
        // authId with authProvider never including 'password' — this check should key off
        // authProvider, not authId, or it'll accept password resets for SSO-only accounts.
        if (row.password && !user.authId) {
          logger.warn({ userId: user.id }, 'Password update requested for user with no Firebase account (import)');
          outcomes[index] = failed(
            index,
            CLASSIFICATION.UPDATED,
            ApiErrorCode.RESOURCE_UNPROCESSABLE,
            ApiErrorMessage.UNPROCESSABLE_ENTITY,
          );
          continue;
        }

        // Reconcile memberships with replace-semantics per provided entity type. Read the current
        // set first (snapshot), then update profile fields + reconcile in one transaction.
        const currentMemberships = await userRepository.getActiveMembershipsWithRoles(user.id);

        // Authorize against the target's actual orgs, not the row's declared ones — the target is
        // named by email, so Phase 1 proves nothing about the requester's rights over this user.
        // Covers the pending removals too (a subset of these), and runs before the transaction.
        await authorizeRow(authContext, currentMemberships, caches);
        const desiredMemberships = row.memberships.map((m) => ({
          entityType: m.entityType,
          entityId: m.entityId,
          role: String(m.role),
        }));

        let reconciled: {
          added: { entityType: EntityType; entityId: string; role: string }[];
          removed: { entityType: EntityType; entityId: string; role: string }[];
        } = { added: [], removed: [] };

        await userRepository.runTransaction({
          fn: async (tx) => {
            await userRepository.update({ id: user.id, data: toUpdateUserFields(row), transaction: tx });
            reconciled = await userRepository.reconcileMemberships(user.id, desiredMemberships, currentMemberships, tx);
          },
        });

        // Sync FGA after the DB commit. Revoke first, then grant: deleteTuples is best-effort (never
        // throws), while writeTuplesOrThrow throws on failure. Running the revocation first means a
        // failed grant-write can only ever leave the user under-granted (the DB membership exists but
        // FGA hasn't caught up yet), never over-granted with a stale tuple for a membership that was
        // just removed. Added tuples carry the active_membership condition, identical to single-create.
        // Build first, then guard on the tuple count: an admin-tier class membership reconciles in the
        // DB but maps to zero FGA tuples (it cascades via the org hierarchy), so add and delete stay
        // symmetric — neither touches FGA.
        //
        // TODO: the DB write above is not rolled back if writeTuplesOrThrow fails below — the row is
        // reported `failed`, but a retry won't re-attempt the missing tuple (the diff against fresh
        // DB state shows no delta). deleteTuples never throws, so a failed deletion is reported `ok`
        // with no way to currently detect it. Both rely on manually running the syncFga backfill.
        const removalTuples = buildMembershipDeletionTuples(user.id, reconciled.removed);
        if (removalTuples.length > 0) {
          await authorizationService.deleteTuples(removalTuples);
        }
        const additionTuples = buildMembershipAdditionTuples(user.id, reconciled.added);
        if (additionTuples.length > 0) {
          await authorizationService.writeTuplesOrThrow(additionTuples);
        }

        // The DB writes commit before the Firebase auth sync. If the auth call fails the row is
        // reported failed even though the DB writes persisted — no orphan, just a stale
        // displayName/password the operator can fix by retrying the row. Acceptable for an update
        // (unlike create, there's no account to compensate).
        const authUpdate = buildAuthUpdate(row, user);
        if (authUpdate && user.authId) {
          await firebaseAuth.updateUser(user.authId, authUpdate);
        }

        logger.info(
          { userId: user.id, added: reconciled.added.length, removed: reconciled.removed.length },
          'Updated user (import)',
        );
        outcomes[index] = ok(index, CLASSIFICATION.UPDATED, user.id);
      } catch (error) {
        logger.error({ err: error, context: { userId: user.id } }, 'Update failed during import');
        outcomes[index] = toFailedOutcome(index, CLASSIFICATION.UPDATED, error);
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
    const caches: AuthorizeCaches = { permissions: new Map(), classParents: new Map() };

    // ── Phase 0: batch-resolve declared org parentage (one round-trip) ───────────
    // A CSV batch typically names the same district/school on every row, so the distinct ID set is
    // O(1) where the row count is O(100). Resolving it once here keeps Phase 1 free of per-row
    // queries (performance-avoid-quadratic). Unenroll rows are excluded: they act on the target's
    // actual memberships, not whatever the row declares.
    const declaredSchoolIds = new Set<string>();
    const declaredClassIds = new Set<string>();
    for (const row of rows) {
      if (row.unenroll) continue;
      for (const id of declaredIds(row, EntityType.SCHOOL)) declaredSchoolIds.add(id);
      for (const id of declaredIds(row, EntityType.CLASS)) declaredClassIds.add(id);
    }

    let hierarchyParents: OrgHierarchyParents;
    try {
      hierarchyParents = await userRepository.getOrgHierarchyParents([...declaredSchoolIds], [...declaredClassIds]);
    } catch (error) {
      // Without the parentage map no row can be validated. Failing every row is the safe response —
      // skipping validation would silently persist the inconsistent memberships this guards against.
      logger.error(
        { err: error, context: { schools: declaredSchoolIds.size, classes: declaredClassIds.size } },
        'Failed to resolve declared org hierarchy during import',
      );
      for (let index = 0; index < rows.length; index++) {
        outcomes[index] = failed(
          index,
          preRoutingClassification(rows[index]!),
          ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          ApiErrorMessage.INTERNAL_SERVER_ERROR,
        );
      }
      return outcomes;
    }

    // ── Phase 1: per-row hierarchy validation + authorization (before any external writes) ──────
    // Hierarchy runs first: it's the cheaper check, and an inconsistent row is a 422 the operator
    // can act on rather than a 403 that reads as a permissions problem.
    // Unenroll rows are authorized later, against the target user's actual current memberships
    // (see processUnenrollBin) — `row.memberships` isn't what an unenroll acts on, and may be empty.
    const authorized: { index: number; row: ImportUserRowInput }[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]!;
      try {
        if (!row.unenroll) {
          validateRowHierarchy(row, hierarchyParents);
          await authorizeRow(authContext, row.memberships, caches);
        }
        authorized.push({ index, row });
      } catch (error) {
        outcomes[index] = toFailedOutcome(index, preRoutingClassification(row), error);
      }
    }

    if (authorized.length === 0) return outcomes;

    // ── Phase 2: classify by email existence (single batched lookup) ─────────────
    let existing: Awaited<ReturnType<typeof userRepository.findByEmails>>;
    try {
      existing = await userRepository.findByEmails(authorized.map((a) => a.row.email));
    } catch (error) {
      // Without knowing which emails already exist, none of Phase 2's classification can safely
      // proceed — an unhandled throw here would otherwise abort bulkImport for every already-
      // authorized row, not just fail this lookup's own row.
      logger.error(
        { err: error, context: { count: authorized.length } },
        'Failed to look up existing users during import',
      );
      for (const { index, row } of authorized) {
        outcomes[index] = failed(
          index,
          preRoutingClassification(row),
          ApiErrorCode.EXTERNAL_SERVICE_FAILED,
          ApiErrorMessage.INTERNAL_SERVER_ERROR,
        );
      }
      return outcomes;
    }
    const existingByEmail = new Map<string, (typeof existing)[number]>();
    for (const user of existing) {
      if (user.email) existingByEmail.set(user.email.toLowerCase(), user);
    }

    const createRows: { index: number; row: ImportUserRowInput }[] = [];
    const updateRows: { index: number; row: ImportUserRowInput; user: User }[] = [];
    const unenrollRows: { index: number; row: ImportUserRowInput; user: User }[] = [];

    for (const entry of authorized) {
      const user = existingByEmail.get(entry.row.email.toLowerCase());
      const unenroll = Boolean(entry.row.unenroll);

      if (user && unenroll) {
        unenrollRows.push({ ...entry, user });
      } else if (user) {
        updateRows.push({ ...entry, user });
      } else if (unenroll) {
        // Unenroll requested for a user that does not exist.
        // NOTE: the legacy cloud function routes this to the unenroll bin as a no-op rather than
        // rejecting. We reject per the ticket spec; revisit if strict parity is preferred.
        outcomes[entry.index] = failed(
          entry.index,
          CLASSIFICATION.UNENROLLED,
          ApiErrorCode.RESOURCE_NOT_FOUND,
          ApiErrorMessage.NOT_FOUND,
        );
      } else {
        createRows.push(entry);
      }
    }

    // ── Phase 3: create bin ──────────────────────────────────────────────────────
    await processCreateBin(authContext, createRows, outcomes);

    // ── Phase 4: unenroll bin ────────────────────────────────────────────────────
    await processUnenrollBin(authContext, unenrollRows, outcomes, caches);

    // ── Phase 5: update bin ──────────────────────────────────────────────────────
    // Updates profile + auth fields. Membership reconciliation is deferred (see processUpdateBin).
    await processUpdateBin(authContext, updateRows, outcomes, caches);

    return outcomes;
  }

  return { bulkImport };
}
