import { describe, it, expect } from 'vitest';
import { mapParentFormToCreateFamily } from './mapParentFormToCreateFamily';

describe('mapParentFormToCreateFamily', () => {
  it('maps the parent form to the CreateFamily body, trimming names', () => {
    const result = mapParentFormToCreateFamily({
      email: '  parent@example.com  ',
      password: 'super-secret',
      firstName: '  Pat ',
      lastName: ' Guardian ',
      canContactForFutureStudies: false,
    });

    expect(result).toEqual({
      email: 'parent@example.com',
      password: 'super-secret',
      name: { first: 'Pat', last: 'Guardian' },
      optIns: { researchContact: false },
    });
  });

  it('maps the research-contact checkbox and drops unrelated legacy fields', () => {
    const result = mapParentFormToCreateFamily({
      email: 'parent@example.com',
      password: 'super-secret',
      firstName: 'Pat',
      lastName: 'Guardian',
      canContactForFutureStudies: true,
      invitationCodes: ['ABC'],
    });

    expect(result.optIns).toEqual({ researchContact: true });
    expect(result).not.toHaveProperty('invitationCodes');
    expect(Object.keys(result).sort()).toEqual(['email', 'name', 'optIns', 'password']);
  });

  it('throws when email is missing', () => {
    expect(() =>
      mapParentFormToCreateFamily({
        email: '',
        password: 'super-secret',
        firstName: 'Pat',
        lastName: 'Guardian',
        canContactForFutureStudies: false,
      }),
    ).toThrow(/email/i);
  });

  it('throws when password is missing', () => {
    expect(() =>
      mapParentFormToCreateFamily({
        email: 'parent@example.com',
        password: '',
        firstName: 'Pat',
        lastName: 'Guardian',
        canContactForFutureStudies: false,
      }),
    ).toThrow(/password/i);
  });

  it('throws when first or last name is missing', () => {
    expect(() =>
      mapParentFormToCreateFamily({
        email: 'parent@example.com',
        password: 'super-secret',
        firstName: '',
        lastName: 'Guardian',
        canContactForFutureStudies: false,
      }),
    ).toThrow(/first and last name/i);
  });

  it('throws when the research-contact preference is missing', () => {
    expect(() =>
      mapParentFormToCreateFamily({
        email: 'parent@example.com',
        password: 'super-secret',
        firstName: 'Pat',
        lastName: 'Guardian',
      }),
    ).toThrow(/research contact preference/i);
  });
});
