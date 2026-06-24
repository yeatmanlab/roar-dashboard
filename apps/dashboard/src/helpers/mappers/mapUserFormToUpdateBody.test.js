import { describe, it, expect } from 'vitest';
import { mapUserFormToUpdateBody, parseDateLocal } from './mapUserFormToUpdateBody';

// The shape EditUsersForm holds in `localUserData`: nested name, nested
// studentData with legacy snake_case keys, dob as a Date, race as an array.
const formModel = () => ({
  name: { first: 'Ada', middle: 'B', last: 'Lovelace' },
  studentData: {
    dob: new Date(2015, 3, 1), // 2015-04-01, local midnight
    grade: '3',
    gender: 'female',
    race: ['White', 'Asian'],
    hispanic_ethnicity: false,
    ell_status: true,
    iep_status: false,
    frl_status: 'Free',
  },
  userType: 'student',
  dataInitialized: true,
});

describe('mapUserFormToUpdateBody', () => {
  it('returns an empty object for nullish input', () => {
    expect(mapUserFormToUpdateBody(null)).toEqual({});
    expect(mapUserFormToUpdateBody(undefined)).toEqual({});
  });

  it('flattens and camelCases the name fields', () => {
    const body = mapUserFormToUpdateBody(formModel());
    expect(body.nameFirst).toBe('Ada');
    expect(body.nameMiddle).toBe('B');
    expect(body.nameLast).toBe('Lovelace');
  });

  it('serializes the dob Date to a YYYY-MM-DD string from local components', () => {
    const body = mapUserFormToUpdateBody(formModel());
    // No UTC shift: the local calendar date the admin picked is preserved.
    expect(body.dob).toBe('2015-04-01');
  });

  it('serializes a late-evening local date without rolling to the next UTC day', () => {
    const form = formModel();
    form.studentData.dob = new Date(2015, 11, 31, 23, 30); // 2015-12-31 23:30 local
    const body = mapUserFormToUpdateBody(form);
    expect(body.dob).toBe('2015-12-31');
  });

  it('maps a null/unset dob to null', () => {
    const form = formModel();
    form.studentData.dob = null;
    expect(mapUserFormToUpdateBody(form).dob).toBeNull();
  });

  it('maps an unparseable dob string to null', () => {
    const form = formModel();
    form.studentData.dob = 'not-a-date';
    expect(mapUserFormToUpdateBody(form).dob).toBeNull();
  });

  it('joins the race array into a comma-separated string', () => {
    const body = mapUserFormToUpdateBody(formModel());
    expect(body.race).toBe('White, Asian');
  });

  it('maps an empty race selection to null', () => {
    const form = formModel();
    form.studentData.race = [];
    expect(mapUserFormToUpdateBody(form).race).toBeNull();
  });

  it('passes a non-array race string straight through', () => {
    const form = formModel();
    form.studentData.race = 'White, Asian';
    expect(mapUserFormToUpdateBody(form).race).toBe('White, Asian');
  });

  it('maps a nullish race to null', () => {
    for (const empty of [null, undefined]) {
      const form = formModel();
      form.studentData.race = empty;
      expect(mapUserFormToUpdateBody(form).race).toBeNull();
    }
  });

  it('coerces boolean ell/iep status flags to strings (statusEll/statusIep)', () => {
    const body = mapUserFormToUpdateBody(formModel());
    expect(body.statusEll).toBe('true');
    expect(body.statusIep).toBe('false');
  });

  it('leaves nullish ell/iep status flags as null rather than the string "null"', () => {
    for (const empty of [null, undefined]) {
      const form = formModel();
      form.studentData.ell_status = empty;
      form.studentData.iep_status = empty;
      const body = mapUserFormToUpdateBody(form);
      // A nullish flag must not clobber the stored value with the literal string "null".
      expect(body.statusEll).toBeNull();
      expect(body.statusIep).toBeNull();
    }
  });

  it('passes hispanicEthnicity through as a boolean', () => {
    const body = mapUserFormToUpdateBody(formModel());
    expect(body.hispanicEthnicity).toBe(false);
  });

  it('passes the Free|Reduced|Paid enum through to statusFrl', () => {
    const body = mapUserFormToUpdateBody(formModel());
    expect(body.statusFrl).toBe('Free');
  });

  it('preserves each FRL enum value', () => {
    for (const value of ['Free', 'Reduced', 'Paid']) {
      const form = formModel();
      form.studentData.frl_status = value;
      expect(mapUserFormToUpdateBody(form).statusFrl).toBe(value);
    }
  });

  it('maps a None/empty FRL selection to null', () => {
    for (const empty of [null, undefined, '']) {
      const form = formModel();
      form.studentData.frl_status = empty;
      // null clears the value under the strict schema rather than rejecting it.
      expect(mapUserFormToUpdateBody(form).statusFrl).toBeNull();
    }
  });

  it('does not write the retired testData/demoData/tags fields', () => {
    const form = { ...formModel(), testData: true, demoData: true, tags: ['x'] };
    const body = mapUserFormToUpdateBody(form);
    expect(body).not.toHaveProperty('testData');
    expect(body).not.toHaveProperty('demoData');
    expect(body).not.toHaveProperty('tags');
  });

  it('produces only flat, camelCased keys allowed by UpdateUserRequestBodySchema', () => {
    const body = mapUserFormToUpdateBody(formModel());
    // Every key must be a member of the contract's strict allow-list. Notably
    // absent: nested `name`/`studentData`, snake_case keys, and the retired
    // testData/demoData/tags flags. `statusFrl` is now emitted (the enum/null).
    const allowedKeys = new Set([
      'nameFirst',
      'nameMiddle',
      'nameLast',
      'username',
      'email',
      'userType',
      'dob',
      'grade',
      'statusEll',
      'statusFrl',
      'statusIep',
      'studentId',
      'sisId',
      'stateId',
      'localId',
      'gender',
      'race',
      'hispanicEthnicity',
      'homeLanguage',
    ]);
    for (const key of Object.keys(body)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
    // At least one field present (the schema requires it).
    expect(Object.keys(body).length).toBeGreaterThan(0);
  });
});

describe('parseDateLocal', () => {
  it('returns null for nullish, non-string, or unparseable input', () => {
    expect(parseDateLocal(null)).toBeNull();
    expect(parseDateLocal(undefined)).toBeNull();
    expect(parseDateLocal('')).toBeNull();
    expect(parseDateLocal('not-a-date')).toBeNull();
  });

  it('parses a date-only string using local calendar components', () => {
    const date = parseDateLocal('2015-04-01');
    // Local components, not UTC — so the parsed day matches the string regardless of timezone.
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2015);
    expect(date.getMonth()).toBe(3); // April (0-indexed)
    expect(date.getDate()).toBe(1);
  });

  it('passes an existing Date through unchanged', () => {
    const input = new Date(2015, 3, 1);
    expect(parseDateLocal(input)).toBe(input);
  });

  it('round-trips a YYYY-MM-DD string losslessly through serializeDob', () => {
    // The DOB corruption bug: parsing a date-only string as UTC midnight (the old
    // `new Date('2015-04-01')`) then serializing from local components shifts the day
    // west of UTC. parseDateLocal + serializeDob must return the SAME string in any timezone.
    for (const dateString of ['2015-04-01', '2015-12-31', '2000-01-01', '2024-02-29']) {
      const form = formModel();
      form.studentData.dob = parseDateLocal(dateString);
      expect(mapUserFormToUpdateBody(form).dob).toBe(dateString);
    }
  });
});
