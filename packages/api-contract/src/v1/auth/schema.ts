import { z } from 'zod';
import { CreateUserNameSchema } from '../common/user';
import { AgreementTypeSchema, LocaleSchema } from '../agreements/schema';
import { FamilyLocationSchema } from '../families/schema';

export const RegistrationAgreementsQuerySchema = z.object({
  locale: LocaleSchema.default('en-US'),
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
    email: z.string().email().max(255),
    password: z.string().min(8),
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
      .min(1),
    optIns: z
      .object({
        researchContact: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;
