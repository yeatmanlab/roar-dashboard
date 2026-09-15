import { z } from 'zod';
import { UserTypeSchema } from '../common/user';
import { LocaleSchema } from '../agreements/schema';
import { UserFamilyRoleSchema } from '../families/schema';

/**
 * Schema for a single locale variant of an unsigned agreement version.
 */
export const UnsignedAgreementVersionSchema = z.object({
  versionId: z.string().uuid(),
  locale: LocaleSchema,
});

export type UnsignedAgreementVersion = z.infer<typeof UnsignedAgreementVersionSchema>;

/**
 * Schema for an unsigned TOS agreement with all its current locale variants.
 * Returned in the /me response when the user has not signed the current version.
 */
export const UnsignedAgreementSchema = z.object({
  agreementId: z.string().uuid(),
  agreementName: z.string(),
  versions: z.array(UnsignedAgreementVersionSchema),
});

export type UnsignedAgreement = z.infer<typeof UnsignedAgreementSchema>;

/**
 * Schema for a single active family membership of the authenticated user.
 *
 * `id` is the family UUID; `role` is the caller's own role in that family
 * (`parent` | `child`). The role is included so the parent dashboard can route
 * on "has a family with role `parent`" — a ROAR@Home child is also a member
 * (role `child`) and would otherwise be indistinguishable from a parent.
 */
export const MeFamilySchema = z.object({
  id: z.string().uuid(),
  role: UserFamilyRoleSchema,
});

export type MeFamily = z.infer<typeof MeFamilySchema>;

/**
 * Schema for the authenticated user's profile returned by /me endpoint.
 *
 * Includes `isSuperAdmin` so clients can determine the caller's platform-wide
 * super-admin status without a separate lookup. Reporting this to the
 * authenticated user about themselves is not an information-disclosure risk.
 *
 * Includes unsignedAgreements array for TOS agreements the user has not yet signed.
 * An empty array means the user has signed all current TOS agreements.
 *
 * Includes a families array of the caller's own active family memberships, each
 * `{ id, role }`. An empty array means the user belongs to no family (the common
 * case for teachers, admins, and org-enrolled students). Reporting the caller's
 * own memberships to themselves is not an information-disclosure risk.
 */
export const MeSchema = z.object({
  id: z.string().uuid(),
  userType: UserTypeSchema,
  isSuperAdmin: z.boolean(),
  nameFirst: z.string().nullable(),
  nameLast: z.string().nullable(),
  unsignedAgreements: z.array(UnsignedAgreementSchema),
  families: z.array(MeFamilySchema),
});

export type Me = z.infer<typeof MeSchema>;
