import { describe, it, expect } from 'vitest';
import { mapStudentFormToAddChild } from './mapStudentFormToAddChild';

/**
 * Builds a minimally-valid form student entry; override fields per test.
 */
function buildStudent(overrides = {}) {
  return {
    studentUsername: 'kiddo@roar-auth.com',
    password: 'super-secret',
    firstName: 'Kid',
    lastName: 'Guardian',
    middleName: '',
    dob: new Date(2018, 4, 4),
    grade: 'K',
    activationCode: 'CODE123',
    ell: '',
    IEPStatus: '',
    freeReducedLunch: '',
    gender: '',
    race: [],
    hispanicEthnicity: '',
    homeLanguage: [],
    // Extra form-only fields that must NOT appear in the mapped body:
    confirmPassword: 'super-secret',
    accept: true,
    orgName: '',
    ...overrides,
  };
}

describe('mapStudentFormToAddChild', () => {
  it('maps a minimal student to the AddChild shape with no demographics', () => {
    const result = mapStudentFormToAddChild(buildStudent());

    expect(result).toEqual({
      email: 'kiddo@roar-auth.com',
      password: 'super-secret',
      name: { first: 'Kid', last: 'Guardian' },
      dob: '2018-05-04',
      grade: 'Kindergarten',
      activationCode: 'CODE123',
    });
    // .strict() compliance: no demographics key when nothing is set.
    expect(result).not.toHaveProperty('demographics');
  });

  it('suffixes a bare username with @roar-auth.com', () => {
    const result = mapStudentFormToAddChild(buildStudent({ studentUsername: 'kiddo' }));
    expect(result.email).toBe('kiddo@roar-auth.com');
  });

  it('includes a middle name only when provided', () => {
    const withMiddle = mapStudentFormToAddChild(buildStudent({ middleName: 'Lee' }));
    expect(withMiddle.name).toEqual({ first: 'Kid', middle: 'Lee', last: 'Guardian' });
  });

  it('maps Y/N demographic flags and serializes list fields', () => {
    const result = mapStudentFormToAddChild(
      buildStudent({
        ell: 'Y',
        IEPStatus: 'N',
        hispanicEthnicity: 'Y',
        freeReducedLunch: 'Free',
        gender: 'female',
        race: ['white', 'asian'],
        homeLanguage: ['English', 'Spanish'],
      }),
    );

    expect(result.demographics).toEqual({
      gender: 'female',
      race: 'white, asian',
      statusEll: 'Y',
      statusFrl: 'Free',
      statusIep: 'N',
      hispanicEthnicity: true,
      homeLanguage: 'English, Spanish',
    });
  });

  it('maps hispanicEthnicity N to false', () => {
    const result = mapStudentFormToAddChild(buildStudent({ hispanicEthnicity: 'N' }));
    expect(result.demographics).toEqual({ hispanicEthnicity: false });
  });

  it('omits empty / unrecognized demographic fields rather than sending empty strings', () => {
    const result = mapStudentFormToAddChild(
      buildStudent({
        ell: '',
        IEPStatus: '',
        freeReducedLunch: 'N/A', // legacy value the enum rejects -> omitted
        gender: '',
        race: [],
        homeLanguage: [],
        hispanicEthnicity: '',
      }),
    );
    expect(result).not.toHaveProperty('demographics');
  });

  it('throws when first or last name is blank (the form leaves them optional)', () => {
    expect(() => mapStudentFormToAddChild(buildStudent({ firstName: '' }))).toThrow(/first and last name/i);
    expect(() => mapStudentFormToAddChild(buildStudent({ lastName: '   ' }))).toThrow(/first and last name/i);
  });

  it('throws when the activation code is missing', () => {
    expect(() => mapStudentFormToAddChild(buildStudent({ activationCode: '' }))).toThrow(/activation code/i);
  });

  it('throws when the password is missing', () => {
    expect(() => mapStudentFormToAddChild(buildStudent({ password: '' }))).toThrow(/password/i);
  });

  it('throws on an unrecognized grade', () => {
    expect(() => mapStudentFormToAddChild(buildStudent({ grade: 'twelfth' }))).toThrow(/Unrecognized grade/i);
  });
});
