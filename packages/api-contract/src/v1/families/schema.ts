import { z } from 'zod';
import { IDENTIFIER_WITH_SPACES } from '../common/regex';
import { createPaginatedResponseSchema } from '../common/query';
import {
  UserSchema,
  EnrolledUsersBaseQuerySchema,
  UserGradeSchema,
  FreeReducedLunchStatusSchema,
} from '../common/user';

export const UserFamilyRoleSchema = z.enum(['parent', 'child']);

export type UserFamilyRole = z.infer<typeof UserFamilyRoleSchema>;

export const EnrolledFamilyUserSchema = UserSchema.extend({
  roles: z.array(UserFamilyRoleSchema),
});

export type EnrolledFamilyUser = z.infer<typeof EnrolledFamilyUserSchema>;

export const EnrolledFamilyUsersQuerySchema = EnrolledUsersBaseQuerySchema.extend({
  role: UserFamilyRoleSchema.optional(),
});

export type EnrolledFamilyUsersQuery = z.infer<typeof EnrolledFamilyUsersQuerySchema>;

export const EnrolledFamilyUsersResponseSchema = createPaginatedResponseSchema(EnrolledFamilyUserSchema);
export type EnrolledFamilyUsersResponse = z.infer<typeof EnrolledFamilyUsersResponseSchema>;

/**
 * Family location schema.
 *
 * Matches the `app.families.location_*` columns. `coordinates` is intentionally
 * omitted from the create-request shape — the column exists but isn't accepted
 * at create time.
 *
 * Country uses 2-letter ISO 3166-1 alpha-2 codes to match the underlying
 * `varchar(2)` column constraint. The schema accepts either upper- or
 * lower-case input (e.g. both `"US"` and `"us"`) and normalizes to upper-case
 * before storage, since ISO 3166-1 alpha-2 codes are conventionally upper-case.
 */
export const FamilyLocationSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'country must be a 2-letter ISO 3166-1 alpha-2 code')
    .transform((v) => v.toUpperCase())
    .optional(),
});

export type FamilyLocation = z.infer<typeof FamilyLocationSchema>;

/**
 * Name schema for the caretaker registering a new family. Reuses the same
 * regex as POST /users to keep validation consistent across signup paths.
 */
const CreateFamilyCaretakerNameSchema = z.object({
  first: z.string().regex(IDENTIFIER_WITH_SPACES),
  middle: z.string().regex(IDENTIFIER_WITH_SPACES).optional(),
  last: z.string().regex(IDENTIFIER_WITH_SPACES),
});

/**
 * Request body for POST /families.
 *
 * This endpoint registers a new caretaker (a `users` row with
 * `userType='caregiver'` and `authProvider=['password']`) together with a new
 * family they're the parent of. The flat field shape mirrors POST /users
 * rather than wrapping caretaker fields in a `caretakerData` envelope — the
 * server already knows everything in the body belongs to the caretaker.
 *
 * Excluded from this schema:
 * - userType / authProvider — server-set to caregiver / [password]
 * - any family identity fields — families have no `name`, and the id is
 *   server-generated
 * - createdBy — server-set to the new caretaker's id, enforces "one family
 *   per caretaker" via a partial unique index
 *
 * Unknown fields in the request body will be rejected with a validation error.
 */
export const CreateFamilyRequestSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(8),
    name: CreateFamilyCaretakerNameSchema,
    location: FamilyLocationSchema.optional(),
  })
  .strict();

export type CreateFamilyRequest = z.infer<typeof CreateFamilyRequestSchema>;

/**
 * Response payload for POST /families.
 *
 * Returns only the new family id, matching POST /districts, /schools,
 * /classes, /groups, and /users. The caretaker id is intentionally not
 * surfaced — the frontend uses the familyId to call
 * `POST /families/:familyId/users` next.
 */
export const CreateFamilyResponseSchema = z.object({
  id: z.string().uuid(),
});

export type CreateFamilyResponse = z.infer<typeof CreateFamilyResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST /v1/families/:familyId/users
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum number of members (parents + children) allowed in a single family.
 *
 * Used both as an array-length cap on the request body (`children.length <= 12`)
 * and as a runtime check at the service layer (`existing members + new children <= 12`).
 */
export const FAMILY_SIZE_LIMIT = 12;

/**
 * Name schema for a child being added to a family. Same regex as the caretaker
 * (and POST /users) for consistency across signup paths.
 */
const AddChildNameSchema = z.object({
  first: z.string().regex(IDENTIFIER_WITH_SPACES),
  middle: z.string().regex(IDENTIFIER_WITH_SPACES).optional(),
  last: z.string().regex(IDENTIFIER_WITH_SPACES),
});

/**
 * Optional demographic fields for a child. Mirrors `CreateUserDemographicsSchema`
 * in the users contract; defined here to keep the families contract self-contained.
 */
const AddChildDemographicsSchema = z.object({
  gender: z.string().nullable().optional(),
  race: z.string().nullable().optional(),
  statusEll: z.string().nullable().optional(),
  statusFrl: FreeReducedLunchStatusSchema.nullable().optional(),
  statusIep: z.string().nullable().optional(),
  hispanicEthnicity: z.boolean().nullable().optional(),
  homeLanguage: z.string().nullable().optional(),
});

/**
 * Per-child input for `POST /v1/families/:familyId/users`.
 *
 * `activationCode` is required and must resolve to an active group via the
 * `invitation_codes` table at the service layer. `dob` must be a valid past
 * date (the `users_dob_in_past` DB check constraint enforces this; the
 * contract also asserts ISO-8601 shape).
 */
export const AddChildSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(8),
    name: AddChildNameSchema,
    dob: z.string().date(),
    grade: UserGradeSchema,
    activationCode: z.string().min(1),
    demographics: AddChildDemographicsSchema.optional(),
  })
  .strict();

export type AddChild = z.infer<typeof AddChildSchema>;

/**
 * Request body for `POST /v1/families/:familyId/users`.
 *
 * The authenticated parent (or super admin) is implicit in the auth token —
 * `caretakerEmail`, `caretakerData`, and `consentData` from the legacy
 * Firebase shape are intentionally dropped. Consent is a separate domain;
 * caretaker profile updates use `PATCH /v1/users/:id`.
 *
 * The `children` array is capped at FAMILY_SIZE_LIMIT (12) entries per
 * request; the service additionally enforces
 * `existing_members + children.length <= FAMILY_SIZE_LIMIT`.
 *
 * Unknown fields in the request body or in any child object will be rejected
 * with a validation error (`.strict()`).
 */
export const AddFamilyChildrenRequestSchema = z
  .object({
    children: z.array(AddChildSchema).min(1).max(FAMILY_SIZE_LIMIT),
  })
  .strict();

export type AddFamilyChildrenRequest = z.infer<typeof AddFamilyChildrenRequestSchema>;

/**
 * Response payload for `POST /v1/families/:familyId/users`.
 *
 * Returns the newly created child ids in the same order as the request — the
 * frontend doesn't otherwise know the new user ids and would have to follow
 * up with a list-users request.
 */
export const AddFamilyChildrenResponseSchema = z.object({
  ids: z.array(z.string().uuid()),
});

export type AddFamilyChildrenResponse = z.infer<typeof AddFamilyChildrenResponseSchema>;
