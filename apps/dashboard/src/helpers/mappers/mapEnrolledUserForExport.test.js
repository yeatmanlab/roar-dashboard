import { describe, it, expect } from 'vitest';
import { mapEnrolledUserForExport } from './mapEnrolledUserForExport';

// A representative enrolled-user API row WITH the `?embed=demographics` sub-object.
// Base fields come from EnrolledUserSchema; `demographics` from
// EnrolledUserDemographicsSchema. Demographic values mirror the user-profile read
// shape (`statusEll`/`statusFrl`/`statusIep` strings, `race` comma-joined string,
// `hispanicEthnicity` boolean) — see mapUser.test.js.
const apiEnrolledUser = {
  id: 'user-uuid',
  email: 'student@example.org',
  username: 'student1',
  nameFirst: 'Ada',
  nameLast: 'Lovelace',
  dob: '2015-04-01',
  grade: '3',
  gender: 'female',
  studentId: 'student-001',
  sisId: 'sis-001',
  stateId: 'state-001',
  localId: 'local-001',
  roles: ['student'],
  demographics: {
    userType: 'student',
    statusEll: 'true',
    statusIep: 'false',
    statusFrl: 'Free',
    race: 'White, Asian',
    hispanicEthnicity: false,
    homeLanguage: 'Spanish',
  },
};

// The exact CSV header set and order the pre-migration export produced.
const EXPECTED_COLUMNS = [
  'Username',
  'Email',
  'FirstName',
  'LastName',
  'Grade',
  'Gender',
  'DateOfBirth',
  'UserType',
  'ell_status',
  'iep_status',
  'frl_status',
  'race',
  'hispanic_ethnicity',
  'home_language',
];

describe('mapEnrolledUserForExport', () => {
  it('produces exactly the pre-migration CSV columns, in order', () => {
    const row = mapEnrolledUserForExport(apiEnrolledUser);
    expect(Object.keys(row)).toEqual(EXPECTED_COLUMNS);
  });

  it('maps base identity and demographic fields to their columns', () => {
    const row = mapEnrolledUserForExport(apiEnrolledUser);
    expect(row).toMatchObject({
      Username: 'student1',
      Email: 'student@example.org',
      FirstName: 'Ada',
      LastName: 'Lovelace',
      Grade: '3',
      Gender: 'female',
      DateOfBirth: '2015-04-01',
    });
  });

  it('maps the embedded PII demographics to their snake_case columns', () => {
    const row = mapEnrolledUserForExport(apiEnrolledUser);
    expect(row).toMatchObject({
      UserType: 'student',
      ell_status: 'true',
      iep_status: 'false',
      frl_status: 'Free',
      home_language: 'Spanish',
    });
  });

  it('keeps race as the raw comma-joined scalar string (no array split)', () => {
    // mapUser splits race into an array for the profile *view*; the CSV cell must
    // stay the scalar string the Firestore export wrote, so it serialises cleanly.
    const row = mapEnrolledUserForExport(apiEnrolledUser);
    expect(row.race).toBe('White, Asian');
    expect(Array.isArray(row.race)).toBe(false);
  });

  it('keeps hispanic_ethnicity as the raw boolean', () => {
    expect(mapEnrolledUserForExport(apiEnrolledUser).hispanic_ethnicity).toBe(false);
    expect(
      mapEnrolledUserForExport({
        ...apiEnrolledUser,
        demographics: { ...apiEnrolledUser.demographics, hispanicEthnicity: true },
      }).hispanic_ethnicity,
    ).toBe(true);
  });

  it('does not export retired tags/testData/demoData fields', () => {
    const row = mapEnrolledUserForExport({
      ...apiEnrolledUser,
      tags: ['x'],
      testData: true,
      demoData: true,
    });
    expect(row).not.toHaveProperty('tags');
    expect(row).not.toHaveProperty('testData');
    expect(row).not.toHaveProperty('demoData');
  });

  it('yields empty PII cells (undefined) when the demographics embed is absent', () => {
    // A row without `demographics` should not throw; PII columns are undefined so
    // the CSV serialiser renders empty cells.
    const { demographics, ...rowWithoutEmbed } = apiEnrolledUser;
    void demographics;
    const row = mapEnrolledUserForExport(rowWithoutEmbed);
    expect(Object.keys(row)).toEqual(EXPECTED_COLUMNS);
    expect(row.UserType).toBeUndefined();
    expect(row.ell_status).toBeUndefined();
    expect(row.race).toBeUndefined();
    // Base identity fields are still present.
    expect(row.Username).toBe('student1');
  });
});
