import { describe, it, expect } from 'vitest';
import { getStudentExternalId } from './getStudentExternalId';

describe('getStudentExternalId', () => {
  it('should extract sisId if available', () => {
    const studentData = {
      sisId: '12345',
      studentId: '54321',
      stateId: '98765',
    };

    expect(getStudentExternalId(studentData)).toBe('_sisId-12345');
  });

  it('should extract studentId if sisId is not available', () => {
    const studentData = {
      studentId: '54321',
      stateId: '98765',
    };

    expect(getStudentExternalId(studentData)).toBe('_studentId-54321');
  });

  it('should extract stateId if sisId and studentId are not available', () => {
    const studentData = {
      stateId: '98765',
    };

    expect(getStudentExternalId(studentData)).toBe('_stateId-98765');
  });

  it('should fallback to the first defined property', () => {
    const studentData = {
      sisId: undefined,
      studentId: '54321',
      stateId: '98765',
    };

    expect(getStudentExternalId(studentData)).toBe('_studentId-54321');
  });

  describe('should handle missing data', () => {
    it('should return empty string if no studentData is undefined', () => {
      const studentData = undefined;

      expect(getStudentExternalId(studentData)).toBe('');
    });

    it('should return empty string if no studentData is null', () => {
      const studentData = null;

      expect(getStudentExternalId(studentData)).toBe('');
    });

    it('should return empty string if no studentData is empty object', () => {
      const studentData = {};

      expect(getStudentExternalId(studentData)).toBe('');
    });

    it('should return empty string if no studentData not an object', () => {
      const studentData = 'not an object';

      expect(getStudentExternalId(studentData)).toBe('');
    });

    it('should return empty string if no external id is available', () => {
      const studentData = {
        username: 'username',
        email: 'test@example.com',
      };

      expect(getStudentExternalId(studentData)).toBe('');
    });
  });
});
