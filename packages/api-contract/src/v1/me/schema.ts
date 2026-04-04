import { z } from 'zod';
import { UserTypeSchema } from '../common/user';
import { LocaleSchema } from '../agreements/schema';

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
 * Schema for the authenticated user's profile returned by /me endpoint.
 *
 * Includes unsignedAgreements array for TOS agreements the user has not yet signed.
 * An empty array means the user has signed all current TOS agreements.
 */
export const MeSchema = z.object({
  id: z.string().uuid(),
  userType: UserTypeSchema,
  nameFirst: z.string().nullable(),
  nameLast: z.string().nullable(),
  unsignedAgreements: z.array(UnsignedAgreementSchema),
});

export type Me = z.infer<typeof MeSchema>;
