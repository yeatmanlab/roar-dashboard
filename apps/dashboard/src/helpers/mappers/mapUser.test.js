import { describe, it, expect } from 'vitest';
import { mapUser } from './mapUser';

const apiUser = {
  id: 'user-uuid',
  email: 'student@example.org',
  username: 'student1',
  userType: 'student',
  assessmentPid: 'abc123',
  nameFirst: 'Ada',
  nameMiddle: 'B',
  nameLast: 'Lovelace',
  dob: '2015-04-01',
  grade: '3',
  schoolLevel: 'elementary',
  gender: 'female',
  statusEll: 'true',
  statusFrl: 'free',
  statusIep: 'false',
  hispanicEthnicity: false,
  race: 'White, Asian',
  studentId: 'student-001',
  sisId: 'sis-001',
  stateId: 'state-001',
  localId: 'local-001',
  isSuperAdmin: undefined,
};

describe('mapUser', () => {
  it('returns null for nullish input', () => {
    expect(mapUser(null)).toBeNull();
    expect(mapUser(undefined)).toBeNull();
  });

  it('nests the name under `name`', () => {
    const result = mapUser(apiUser);
    expect(result.name).toEqual({ first: 'Ada', middle: 'B', last: 'Lovelace' });
  });

  it('nests demographics under `studentData` with legacy snake_case keys', () => {
    const { studentData } = mapUser(apiUser);
    expect(studentData).toMatchObject({
      dob: '2015-04-01',
      grade: '3',
      schoolLevel: 'elementary',
      gender: 'female',
      ell_status: 'true',
      frl_status: 'free',
      iep_status: 'false',
      hispanic_ethnicity: false,
    });
  });

  it('splits the comma-joined race string into an array', () => {
    expect(mapUser(apiUser).studentData.race).toEqual(['White', 'Asian']);
  });

  it('maps race to null when absent so the `?? "None"` display fallback fires', () => {
    expect(mapUser({ ...apiUser, race: null }).studentData.race).toBeNull();
  });

  it('maps identifier fields to legacy snake_case keys', () => {
    const { studentData } = mapUser(apiUser);
    expect(studentData.sis_id).toBe('sis-001');
    expect(studentData.state_id).toBe('state-001');
    expect(studentData.student_number).toBe('student-001');
  });

  it('preserves flat identity fields', () => {
    const result = mapUser(apiUser);
    expect(result).toMatchObject({
      id: 'user-uuid',
      email: 'student@example.org',
      username: 'student1',
      userType: 'student',
      assessmentPid: 'abc123',
    });
  });

  it('does not reintroduce retired tags/testData/demoData fields', () => {
    const result = mapUser({ ...apiUser, tags: ['x'], testData: true, demoData: true });
    expect(result).not.toHaveProperty('tags');
    expect(result).not.toHaveProperty('testData');
    expect(result).not.toHaveProperty('demoData');
  });
});
