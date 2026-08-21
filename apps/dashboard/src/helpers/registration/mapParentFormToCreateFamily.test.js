import { describe, it, expect } from 'vitest';
import { mapParentFormToCreateFamily } from './mapParentFormToCreateFamily';

describe('mapParentFormToCreateFamily', () => {
  it('maps the parent form to the CreateFamily body, trimming names', () => {
    const result = mapParentFormToCreateFamily({
      email: '  parent@example.com  ',
      password: 'super-secret',
      firstName: '  Pat ',
      lastName: ' Guardian ',
    });

    expect(result).toEqual({
      email: 'parent@example.com',
      password: 'super-secret',
      name: { first: 'Pat', last: 'Guardian' },
    });
  });

  it('drops legacy fields the strict create-family body rejects', () => {
    const result = mapParentFormToCreateFamily({
      email: 'parent@example.com',
      password: 'super-secret',
      firstName: 'Pat',
      lastName: 'Guardian',
      canContactForFutureStudies: true,
      invitationCodes: ['ABC'],
    });

    expect(result).not.toHaveProperty('canContactForFutureStudies');
    expect(result).not.toHaveProperty('invitationCodes');
    expect(Object.keys(result).sort()).toEqual(['email', 'name', 'password']);
  });

  it('throws when email is missing', () => {
    expect(() =>
      mapParentFormToCreateFamily({ email: '', password: 'super-secret', firstName: 'Pat', lastName: 'Guardian' }),
    ).toThrow(/email/i);
  });

  it('throws when password is missing', () => {
    expect(() =>
      mapParentFormToCreateFamily({
        email: 'parent@example.com',
        password: '',
        firstName: 'Pat',
        lastName: 'Guardian',
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
      }),
    ).toThrow(/first and last name/i);
  });
});
