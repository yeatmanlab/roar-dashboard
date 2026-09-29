import { describe, expect, it } from 'vitest';
import { CreateFamilyRequestSchema } from './schema';

const validBody = {
  email: 'parent@example.com',
  password: 'password123',
  name: { first: 'Pat', last: 'Parent' },
  optIns: { researchContact: true },
};

describe('CreateFamilyRequestSchema.optIns', () => {
  it.each([true, false])('accepts researchContact=%s', (researchContact) => {
    expect(
      CreateFamilyRequestSchema.safeParse({
        ...validBody,
        optIns: { researchContact },
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown opt-in key', () => {
    expect(
      CreateFamilyRequestSchema.safeParse({
        ...validBody,
        optIns: { researchContact: true, productUpdates: true },
      }).success,
    ).toBe(false);
  });

  it('accepts a missing optIns object for backward compatibility', () => {
    const bodyWithoutOptIns: Record<string, unknown> = { ...validBody };
    delete bodyWithoutOptIns.optIns;

    expect(CreateFamilyRequestSchema.safeParse(bodyWithoutOptIns).success).toBe(true);
  });
});
