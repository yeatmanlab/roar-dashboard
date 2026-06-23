import { z } from 'zod';
import {
  UserTypeSchema,
  UserGradeSchema,
  UserRoleSchema,
  SchoolLevelSchema,
  AuthProviderSchema,
  FreeReducedLunchStatusSchema,
  CreateUserNameSchema,
  CreateUserDemographicsSchema,
} from '../common/user';
import { UserFamilyRoleSchema } from '../families/schema';

/**
 * Response schema for GET /users/:userId
 * Returns user profile information
 *
 * Security note: isSuperAdmin is only included when the requesting user is a super admin.
 * Non-super admins will not see this field for security reasons.
 *
 * TODO: Consider scoping PII fields based on the user's permissions
 * ISSUE: https://github.com/yeatmanlab/roar-project-management/issues/1706
 */
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  assessmentPid: z.string().nullable(),
  authProvider: z.array(AuthProviderSchema),
  nameFirst: z.string().nullable(),
  nameMiddle: z.string().nullable(),
  nameLast: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().email().nullable(),
  userType: UserTypeSchema,
  dob: z.string().date().nullable(),
  grade: UserGradeSchema.nullable(),
  schoolLevel: SchoolLevelSchema.nullable(),
  statusEll: z.string().nullable(),
  statusFrl: FreeReducedLunchStatusSchema.nullable(),
  statusIep: z.string().nullable(),
  studentId: z.string().nullable(),
  sisId: z.string().nullable(),
  stateId: z.string().nullable(),
  localId: z.string().nullable(),
  gender: z.string().nullable(),
  race: z.string().nullable(),
  hispanicEthnicity: z.boolean().nullable(),
  homeLanguage: z.string().nullable(),
  isSuperAdmin: z.boolean().optional(), // Only visible to super admins
  rosteringEnded: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

const membershipBase = {
  entityId: z.string().uuid(),
  enrollmentStart: z.string().datetime().optional(),
  enrollmentEnd: z.string().datetime().optional(),
};

/**
 * Membership schema for org/class/group entities.
 * Uses the full OneRoster user role set — 'child' is not a valid org role.
 */
const OrgMembershipSchema = z.object({
  ...membershipBase,
  entityType: z.enum(['district', 'school', 'class', 'group']),
  role: UserRoleSchema,
});

/**
 * Membership schema for family entities.
 * Only 'parent' and 'child' are valid family roles.
 */
const FamilyMembershipSchema = z.object({
  ...membershipBase,
  entityType: z.literal('family'),
  role: UserFamilyRoleSchema,
});

export const UserMembershipSchema = z.union([OrgMembershipSchema, FamilyMembershipSchema]);
export type UserMembership = z.infer<typeof UserMembershipSchema>;

const CreateUserIdentifiersSchema = z.object({
  stateId: z.string().optional(),
  pid: z.string().optional(),
});

/**
 * Request body schema for POST /users
 *
 * This endpoint should be used when creating a single user with specific profile information and memberships.
 * For bulk user creation, consider implementing a separate bulk endpoint (e.g., POST /users/bulk) that accepts an array of user objects.
 *
 * Excluded from this schema (system-managed, not settable via API):
 * - id, assessmentPid, authId, authProvider — identity/rostering fields
 * - isSuperAdmin — security-sensitive, not user-updatable
 * - schoolLevel — DB-generated from grade
 * - createdAt, updatedAt — managed by DB triggers
 *
 * userType defaults to 'student' when omitted. Pass an explicit value when
 * creating admin or staff accounts.
 *
 * Unknown fields in the request body will be rejected with a validation error.
 */
export const CreateUserRequestBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    name: CreateUserNameSchema,
    userType: UserTypeSchema.default('student'),
    dob: z.string().date().nullable().optional(),
    grade: UserGradeSchema.nullable().optional(),
    demographics: CreateUserDemographicsSchema.optional(),
    identifiers: CreateUserIdentifiersSchema.optional(),
    memberships: z.array(UserMembershipSchema).min(1),
  })
  .strict();

export type CreateUserRequestBody = z.infer<typeof CreateUserRequestBodySchema>;

export const CreateUserResponseSchema = z.object({
  id: z.string().uuid(),
});

export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;

/**
 * Per-row body for POST /users/import (bulk create / update / unenroll).
 *
 * Intentionally the single-create row shape (`CreateUserRequestBodySchema`) with two changes:
 * - `password` is optional here and validated per-bin during processing (required for create
 *   rows, optional for update rows, ignored for unenroll rows). The client cannot know which bin
 *   a row lands in until the server matches it by email, so the schema cannot require it.
 * - `unenroll: true` routes an existing user to the unenroll bin.
 *
 * The server classifies create / update / unenroll by matching `email` against existing users —
 * the client never declares the bin.
 *
 * @NOTE Parity gap to verify against the legacy `batchImportUpdate` cloud function before merge:
 *   the single-create schema requires `email` and has no `username`. If the cloud function imports
 *   username-only students (synthesizing an email), this schema must grow `username` and thread it
 *   through the create path. Tracked as part of the batchImportUpdate parity review.
 */
export const ImportUserRowSchema = CreateUserRequestBodySchema.omit({ password: true })
  .extend({
    password: z.string().min(8).optional(),
    unenroll: z.boolean().optional(),
  })
  .strict();

export type ImportUserRow = z.infer<typeof ImportUserRowSchema>;

/**
 * Request body for POST /users/import. Capped at 100 rows — the dashboard chunks at 50 and
 * Firebase `importUsers` accepts up to 1,000, so 100 sits comfortably between the two.
 */
export const ImportUsersRequestSchema = z.object({
  users: z.array(ImportUserRowSchema).min(1).max(100),
});

export type ImportUsersRequest = z.infer<typeof ImportUsersRequestSchema>;

/** The bin the server routed a row to (past tense — reflects the outcome). */
export const ImportClassificationSchema = z.enum(['created', 'updated', 'unenrolled']);

export type ImportClassification = z.infer<typeof ImportClassificationSchema>;

/**
 * Per-row result, discriminated on `status`. Successful rows carry the resulting user `id`;
 * failed rows carry a safe `{ code, message }` (from the `ApiErrorCode` / `ApiErrorMessage`
 * enums on the server). `classification` is the bin the row was routed to, even on failure, so
 * the operator can see which path went wrong.
 */
export const ImportUserResultSchema = z.discriminatedUnion('status', [
  z.object({
    index: z.number().int().nonnegative(),
    classification: ImportClassificationSchema,
    status: z.literal('ok'),
    id: z.string().uuid(),
  }),
  z.object({
    index: z.number().int().nonnegative(),
    classification: ImportClassificationSchema,
    status: z.literal('failed'),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
]);

export type ImportUserResult = z.infer<typeof ImportUserResultSchema>;

export const ImportUsersSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unenrolled: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export type ImportUsersSummary = z.infer<typeof ImportUsersSummarySchema>;

/**
 * Multi-status response for POST /users/import. The endpoint returns 200 for any well-formed,
 * authenticated request; per-row outcomes live in `results`, and `summary` totals each bin.
 */
export const ImportUsersResponseSchema = z.object({
  results: z.array(ImportUserResultSchema),
  summary: ImportUsersSummarySchema,
});

export type ImportUsersResponse = z.infer<typeof ImportUsersResponseSchema>;

/**
 * Request body schema for PATCH /users/:id
 *
 * All fields are optional — only provided fields are updated (partial update semantics).
 * Nullable fields may be explicitly set to null to clear the value.
 * At least one field must be present in the request body.
 *
 * Excluded from this schema (system-managed, not updatable via API):
 * - id, assessmentPid, authId, authProvider — identity/rostering fields
 * - isSuperAdmin — security-sensitive, not user-updatable
 * - schoolLevel — DB-generated from grade
 * - createdAt, updatedAt — managed by DB triggers
 *
 * Unknown fields in the request body will be rejected with a validation error.
 */
export const UpdateUserRequestBodySchema = z
  .object({
    nameFirst: z.string().nullable().optional(),
    nameMiddle: z.string().nullable().optional(),
    nameLast: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    userType: UserTypeSchema.optional(),
    dob: z.string().date().nullable().optional(),
    grade: UserGradeSchema.nullable().optional(),
    statusEll: z.string().nullable().optional(),
    statusFrl: FreeReducedLunchStatusSchema.nullable().optional(),
    statusIep: z.string().nullable().optional(),
    studentId: z.string().nullable().optional(),
    sisId: z.string().nullable().optional(),
    stateId: z.string().nullable().optional(),
    localId: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    race: z.string().nullable().optional(),
    hispanicEthnicity: z.boolean().nullable().optional(),
    homeLanguage: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (Object.keys(payload).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided.',
      });
    }
  });

export type UpdateUserRequestBody = z.infer<typeof UpdateUserRequestBodySchema>;

/**
 * Request body for POST /users/:userId/agreements
 *
 * Records a user's consent to a specific agreement version.
 * Supports two modes:
 * - **Self-consent:** User consents for themselves (authenticated user = target user)
 * - **Parent consent:** Parent consents for their child (authenticated user = parent, target = child via family relationship)
 */
export const RecordUserAgreementRequestBodySchema = z.object({
  agreementVersionId: z.string().uuid(),
});

export type RecordUserAgreementRequestBody = z.infer<typeof RecordUserAgreementRequestBodySchema>;

/**
 * Response payload for POST /users/:userId/agreements
 *
 * Returns the created user agreement ID.
 */
export const RecordUserAgreementResponseSchema = z.object({
  id: z.string().uuid(),
});

export type RecordUserAgreementResponse = z.infer<typeof RecordUserAgreementResponseSchema>;
