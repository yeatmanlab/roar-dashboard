import { describe, it, expect } from 'vitest';
import { mapEnrolledUser } from './mapEnrolledUser';

// A representative EnrolledUser API row: UserSchema fields + roles.
const apiEnrolledUser = {
  id: 'user-uuid',
  email: 'student@example.org',
  username: 'student1',
  assessmentPid: 'abc123',
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
};

describe('mapEnrolledUser', () => {
  it('returns null for nullish input', () => {
    expect(mapEnrolledUser(null)).toBeNull();
    expect(mapEnrolledUser(undefined)).toBeNull();
  });

  it('preserves flat identity fields', () => {
    const result = mapEnrolledUser(apiEnrolledUser);
    expect(result).toMatchObject({
      id: 'user-uuid',
      email: 'student@example.org',
      username: 'student1',
    });
  });

  it('nests the name under `name`', () => {
    expect(mapEnrolledUser(apiEnrolledUser).name).toEqual({ first: 'Ada', last: 'Lovelace' });
  });

  it('nests demographics under `studentData` with the legacy keys the columns read', () => {
    const { studentData } = mapEnrolledUser(apiEnrolledUser);
    expect(studentData).toMatchObject({
      dob: '2015-04-01',
      grade: '3',
      gender: 'female',
    });
  });

  it('maps identifier fields to legacy snake_case keys', () => {
    const { studentData } = mapEnrolledUser(apiEnrolledUser);
    expect(studentData.state_id).toBe('state-001');
    expect(studentData.sis_id).toBe('sis-001');
    expect(studentData.student_number).toBe('student-001');
  });

  it('carries the enrolled roles', () => {
    expect(mapEnrolledUser(apiEnrolledUser).roles).toEqual(['student']);
  });

  it('defaults roles to an empty array when absent', () => {
    expect(mapEnrolledUser({ ...apiEnrolledUser, roles: undefined }).roles).toEqual([]);
  });

  it('does not surface userType or archived (not present on the list row)', () => {
    const result = mapEnrolledUser(apiEnrolledUser);
    expect(result).not.toHaveProperty('userType');
    expect(result).not.toHaveProperty('archived');
  });

  it('does not reintroduce retired tags/testData/demoData fields', () => {
    const result = mapEnrolledUser({ ...apiEnrolledUser, tags: ['x'], testData: true, demoData: true });
    expect(result).not.toHaveProperty('tags');
    expect(result).not.toHaveProperty('testData');
    expect(result).not.toHaveProperty('demoData');
  });
});
