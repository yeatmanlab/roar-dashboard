import { describe, expect, it } from 'vitest';
import { RegistrationAgreementsQuerySchema, RegistrationRequestSchema } from './schema';

const validRegistration = {
  email: 'parent@example.com',
  password: 'password123',
  name: { first: 'Pat', last: 'Parent' },
  agreements: [{ agreementVersionId: '00000000-0000-4000-8000-000000000001' }],
  optIns: { researchContact: false },
};

describe('registration schemas', () => {
  it('defaults the agreements locale to en-US', () => {
    expect(RegistrationAgreementsQuerySchema.parse({})).toEqual({ locale: 'en-US' });
  });

  it('accepts the complete registration request', () => {
    expect(RegistrationRequestSchema.parse(validRegistration)).toEqual(validRegistration);
  });

  it('rejects client-supplied agreement timestamps', () => {
    expect(() =>
      RegistrationRequestSchema.parse({
        ...validRegistration,
        agreements: [{ ...validRegistration.agreements[0], confirmedAt: new Date().toISOString() }],
      }),
    ).toThrow();
  });

  it('requires at least one accepted agreement', () => {
    expect(() => RegistrationRequestSchema.parse({ ...validRegistration, agreements: [] })).toThrow();
  });

  it('rejects unknown top-level and opt-in fields', () => {
    expect(() =>
      RegistrationRequestSchema.parse({ ...validRegistration, verificationToken: 'not-yet-supported' }),
    ).toThrow();
    expect(() =>
      RegistrationRequestSchema.parse({
        ...validRegistration,
        optIns: { researchContact: false, marketing: true },
      }),
    ).toThrow();
  });
});
