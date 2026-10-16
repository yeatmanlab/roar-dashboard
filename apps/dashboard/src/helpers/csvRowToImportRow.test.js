import { describe, it, expect } from 'vitest';
import { csvRowToImportRow, toBoolean } from './csvRowToImportRow';

describe('csvRowToImportRow', () => {
  it('maps a username to a synthetic email and keeps the username', () => {
    expect(csvRowToImportRow({ username: 'ada' })).toMatchObject({
      username: 'ada',
      email: 'ada@roar-auth.com',
    });
  });

  it('prefers an explicit email over the synthetic username email, keeping the username', () => {
    expect(csvRowToImportRow({ username: 'ada', email: 'ada@school.org' })).toMatchObject({
      username: 'ada',
      email: 'ada@school.org',
    });
  });

  it('omits username when the row has an empty one', () => {
    expect(csvRowToImportRow({ username: '', email: 'ada@school.org' })).not.toHaveProperty('username');
  });

  it('builds the nested name and core fields with userType student', () => {
    const row = csvRowToImportRow({ first: 'Ada', last: 'Lovelace', password: 'pw', dob: '2015-01-01', grade: '3' });
    expect(row).toMatchObject({
      userType: 'student',
      name: { first: 'Ada', last: 'Lovelace' },
      password: 'pw',
      dob: '2015-01-01',
      grade: '3',
    });
  });

  it.each([
    ['2/1/2020', '2020-02-01'],
    ['02/01/2020', '2020-02-01'],
    ['2-1-2020', '2020-02-01'],
    ['12/25/2015', '2015-12-25'],
    ['2015-01-01', '2015-01-01'],
    ['2015/1/1', '2015-01-01'],
  ])('reformats dob %s to %s', (dob, expected) => {
    expect(csvRowToImportRow({ dob }).dob).toBe(expected);
  });

  it('throws naming the value when dob is present but unparseable', () => {
    expect(() => csvRowToImportRow({ dob: '13/45/2020' })).toThrow('Invalid date of birth: 13/45/2020');
  });

  it('omits dob when absent', () => {
    expect(csvRowToImportRow({ first: 'Ada' })).not.toHaveProperty('dob');
  });

  it.each([
    [3, '3'],
    ['3', '3'],
    [0, '0'],
  ])('coerces grade %p to the primitive string %p', (grade, expected) => {
    const result = csvRowToImportRow({ grade }).grade;
    expect(result).toBe(expected);
    expect(typeof result).toBe('string');
  });

  it('renames demographics to the contract keys and coerces hispanicEthnicity to a boolean', () => {
    const { demographics } = csvRowToImportRow({
      gender: 'female',
      race: 'White',
      ellStatus: 'true',
      frlStatus: 'free',
      iepStatus: 'false',
      hispanicEthnicity: 'yes',
      homeLanguage: 'en',
    });
    expect(demographics).toEqual({
      gender: 'female',
      race: 'White',
      statusEll: 'true',
      statusFrl: 'free',
      statusIep: 'false',
      hispanicEthnicity: true,
      homeLanguage: 'en',
    });
  });

  it('maps identifiers and the unenroll flag, and drops the retired testData field', () => {
    const row = csvRowToImportRow({ stateId: 's1', pid: 'p1', unenroll: 'true', testData: 'true' });
    expect(row.identifiers).toEqual({ stateId: 's1', pid: 'p1' });
    expect(row.unenroll).toBe(true);
    expect(row).not.toHaveProperty('testData');
  });

  it('omits unenroll when falsy and demographics/identifiers when empty; memberships starts empty', () => {
    const row = csvRowToImportRow({ username: 'ada', first: 'Ada', last: 'L' });
    expect(row).not.toHaveProperty('unenroll');
    expect(row).not.toHaveProperty('demographics');
    expect(row).not.toHaveProperty('identifiers');
    expect(row.memberships).toEqual([]);
  });

  it('does not write an omitted middle name', () => {
    expect(csvRowToImportRow({ first: 'Ada', last: 'L' }).name).not.toHaveProperty('middle');
  });

  it('maps a present middle name', () => {
    expect(csvRowToImportRow({ first: 'Ada', middle: 'Augusta', last: 'L' }).name.middle).toBe('Augusta');
  });
});

describe('toBoolean', () => {
  it('treats common truthy strings (and true) as true', () => {
    for (const value of ['true', 'YES', '1', 't', 'y', true]) expect(toBoolean(value)).toBe(true);
  });

  it('treats everything else as false', () => {
    for (const value of ['false', 'no', '0', '', null, undefined, 'x']) expect(toBoolean(value)).toBe(false);
  });
});
