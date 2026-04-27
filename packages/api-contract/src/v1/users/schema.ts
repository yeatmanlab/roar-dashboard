import { z } from 'zod';
import { EntityTypeSchema } from '../common/entity';
import {
  UserTypeSchema,
  UserGradeSchema,
  UserRoleSchema,
  SchoolLevelSchema,
  AuthProviderSchema,
  FreeReducedLunchStatusSchema,
} from '../common/user';
import { IDENTIFIER_WITH_SPACES } from '../common/regex';

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

export const UserMembershipSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().uuid(),
  role: UserRoleSchema,
  enrollmentStart: z.string().datetime().nullable().optional(),
  enrollmentEnd: z.string().datetime().nullable().optional(),
});

const CreateUserNameSchema = z.object({
  first: z.string().regex(IDENTIFIER_WITH_SPACES),
  // TODO: Determine if middle name should be required or optional, and if it can be null (does frontend client set it to null if not provided?)
  middle: z.string().regex(IDENTIFIER_WITH_SPACES).nullable().optional(),
  last: z.string().regex(IDENTIFIER_WITH_SPACES),
});

const CreateUserDemographicsSchema = z.object({
  gender: z.string().nullable().optional(),
  race: z.string().nullable().optional(),
  statusEll: z.string().nullable().optional(),
  statusFrl: FreeReducedLunchStatusSchema.nullable().optional(),
  statusIep: z.string().nullable().optional(),
  hispanicEthnicity: z.boolean().nullable().optional(),
  homeLanguage: z.string().nullable().optional(),
});

const CreateUserIdentifiersSchema = z.object({
  stateId: z.string().nullable().optional(),
  pid: z.string().nullable().optional(),
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
 * Unknown fields in the request body will be rejected with a validation error.
 */
export const CreateUserRequestBodySchema = z
  .object({
    email: z.string().email(),
    // TODO: Determine password requirements (length, complexity) and enforce them here
    password: z.string().min(8), // Assuming a password field is required for user creation
    name: CreateUserNameSchema,
    dob: z.string().date().nullable(),
    grade: UserGradeSchema.nullable(),
    demographics: CreateUserDemographicsSchema.nullable().optional(),
    identifiers: CreateUserIdentifiersSchema.nullable().optional(),
    memberships: z.array(UserMembershipSchema).min(1),
  })
  .strict();

export type CreateUserRequestBody = z.infer<typeof CreateUserRequestBodySchema>;

export const CreateUserResponseSchema = z.object({
  id: z.string().uuid(),
});

export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;

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
