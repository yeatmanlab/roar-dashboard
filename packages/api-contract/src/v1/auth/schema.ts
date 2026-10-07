import { z } from 'zod';
import { CreateUserNameSchema } from '../common/user';
import { AgreementTypeSchema, LocaleSchema } from '../agreements/schema';
import { FamilyLocationSchema, RegistrationOptInsSchema } from '../families/schema';

export const DEFAULT_REGISTRATION_LOCALE = 'en-US';

const MAX_REGISTRATION_EMAIL_LENGTH = 255;
const MIN_REGISTRATION_PASSWORD_LENGTH = 8;
const MAX_REGISTRATION_PASSWORD_LENGTH = 128;
const MAX_REGISTRATION_AGREEMENTS = 2;

export const RegistrationAgreementsQuerySchema = z.object({
  locale: LocaleSchema.default(DEFAULT_REGISTRATION_LOCALE),
});

export type RegistrationAgreementsQuery = z.infer<typeof RegistrationAgreementsQuerySchema>;

export const RegistrationAgreementSchema = z.object({
  agreementId: z.string().uuid(),
  agreementVersionId: z.string().uuid(),
  agreementType: AgreementTypeSchema,
  name: z.string(),
  locale: LocaleSchema,
  content: z.string(),
});

export type RegistrationAgreement = z.infer<typeof RegistrationAgreementSchema>;

export const RegistrationAgreementsResponseSchema = z.object({
  items: z.array(RegistrationAgreementSchema),
});

export type RegistrationAgreementsResponse = z.infer<typeof RegistrationAgreementsResponseSchema>;

export const RegistrationRequestSchema = z
  .object({
    email: z.string().email().max(MAX_REGISTRATION_EMAIL_LENGTH),
    password: z.string().min(MIN_REGISTRATION_PASSWORD_LENGTH).max(MAX_REGISTRATION_PASSWORD_LENGTH),
    name: CreateUserNameSchema,
    location: FamilyLocationSchema.optional(),
    agreements: z
      .array(
        z
          .object({
            agreementVersionId: z.string().uuid(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_REGISTRATION_AGREEMENTS),
    optIns: RegistrationOptInsSchema,
  })
  .strict();

export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;
