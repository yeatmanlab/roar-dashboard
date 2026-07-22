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

/**
 * Response membership shapes for `GET /users/:userId/memberships`.
 *
 * Distinct from the create-body `UserMembershipSchema` above: this read shape
 * carries the member's `role`, and class rows can additionally carry the parent
 * `schoolId` / `districtId` so a consumer can resolve a student's current
 * school(s) without a separate lookup (a student has no school-level membership
 * row of their own — their school is the parent of their class).
 *
 * The parent `schoolId` / `districtId` are **optional**: they are returned only on
 * full-access reads (self, super admin, or a guardian of the user), which is where
 * the homepage use case lives. A scoped supervisory requester (administrator or
 * educator) may hold `can_list_users` on a class without `can_read` on its parent
 * school, so the parent IDs are omitted on that path to avoid disclosing org
 * identifiers they cannot otherwise read.
 *
 * v1 returns **active (current) memberships only**; enrollment dates are omitted.
 * A future `?status=active|all` toggle would reintroduce them.
 */
const OrgGroupMembershipResponseSchema = z.object({
  entityType: z.enum(['district', 'school', 'group']),
  entityId: z.string().uuid(),
  role: UserRoleSchema,
});

const ClassMembershipResponseSchema = z.object({
  entityType: z.literal('class'),
  entityId: z.string().uuid(),
  role: UserRoleSchema,
  schoolId: z.string().uuid().optional(),
  districtId: z.string().uuid().optional(),
});

const FamilyMembershipResponseSchema = z.object({
  entityType: z.literal('family'),
  entityId: z.string().uuid(),
  role: UserFamilyRoleSchema,
});

export const UserMembershipResponseSchema = z.union([
  OrgGroupMembershipResponseSchema,
  ClassMembershipResponseSchema,
  FamilyMembershipResponseSchema,
]);
export type UserMembershipResponse = z.infer<typeof UserMembershipResponseSchema>;

/**
 * Response body payload for `GET /users/:userId/memberships`.
 *
 * Unpaginated: a user's active membership set is small and bounded (students sit
 * at the leaves of the org hierarchy, admins at the top), so there is nothing to
 * page through.
 */
export const UserMembershipsResponseSchema = z.object({
  items: z.array(UserMembershipResponseSchema),
});
export type UserMembershipsResponse = z.infer<typeof UserMembershipsResponseSchema>;

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
 * Request body schema for PATCH /users/:id
 *
 * All fields are optional — only provided fields are updated (partial update semantics).
 * Nullable fields may be explicitly set to null to clear the value.
 * At least one field must be present in the request body.
 *
 * Profile fields are persisted to the database. The `password` field is the one
 * exception: it is not stored in the database — when provided, it updates the
 * target user's Firebase Auth credential instead. Minimum length (8) matches
 * `CreateUserRequestBodySchema`.
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
    password: z.string().min(8).optional(),
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
