import { z } from 'zod';
import { IDENTIFIER_WITH_SPACES } from '../common/regex';
import { createPaginatedResponseSchema } from '../common/query';
import { UserSchema, EnrolledUsersBaseQuerySchema } from '../common/user';

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
 * at create time. Country uses 2-letter ISO 3166-1 alpha-2 codes to match the
 * underlying `varchar(2)` column constraint.
 */
export const FamilyLocationSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  stateProvince: z.string().optional(),
  postalCode: z.string().optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, 'country must be a 2-letter ISO 3166-1 alpha-2 code')
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
