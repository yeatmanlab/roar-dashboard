import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { getStudentDisplayName } from './getStudentDisplayName';

describe('getStudentDisplayName', () => {
  describe('Complete student data', () => {
    it('should return first and last name when both are provided', () => {
      const studentData = {
        name: {
          first: 'Alice',
          last: 'Johnson',
        },
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'Alice',
        lastName: 'Johnson',
      });
    });

    it('should handle student data with username when name is complete', () => {
      const studentData = {
        name: {
          first: 'Bob',
          last: 'Smith',
        },
        username: 'bsmith123',
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'Bob',
        lastName: 'Smith',
      });
    });
  });

  describe('Missing first name fallback', () => {
    it('should use username as firstName when first name is missing', () => {
      const studentData = {
        name: {
          last: 'Wilson',
        },
        username: 'student123',
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'student123',
        lastName: 'Wilson',
      });
    });

    it('should use username when name object is missing', () => {
      const studentData = {
        username: 'anonymous_user',
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'anonymous_user',
        lastName: '',
      });
    });

    it('should use username when first name is empty string', () => {
      const studentData = {
        name: {
          first: '',
          last: 'Brown',
        },
        username: 'jbrown',
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'jbrown',
        lastName: 'Brown',
      });
    });
  });

  describe('Missing last name handling', () => {
    it('should return empty string for lastName when not provided', () => {
      const studentData = {
        name: {
          first: 'Charlie',
        },
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'Charlie',
        lastName: '',
      });
    });

    it('should handle empty last name with username fallback', () => {
      const studentData = {
        name: {
          last: '',
        },
        username: 'student456',
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'student456',
        lastName: '',
      });
    });
  });

  describe('Empty and null inputs', () => {
    it('should return empty strings for null input', () => {
      const result = getStudentDisplayName(null);
      expect(result).toEqual({
        firstName: '',
        lastName: '',
      });
    });

    it('should return empty strings for undefined input', () => {
      const result = getStudentDisplayName(undefined);
      expect(result).toEqual({
        firstName: '',
        lastName: '',
      });
    });

    it('should return empty strings for empty object', () => {
      const result = getStudentDisplayName({});
      expect(result).toEqual({
        firstName: '',
        lastName: '',
      });
    });

    it('should handle student data with no name or username', () => {
      const studentData = {
        id: '12345',
        grade: '3rd',
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: '',
        lastName: '',
      });
    });
  });

  describe('Vue reactivity support', () => {
    it('should work with Vue ref objects', () => {
      const studentData = ref({
        name: {
          first: 'Diana',
          last: 'Prince',
        },
      });

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'Diana',
        lastName: 'Prince',
      });
    });

    it('should work with reactive ref containing username fallback', () => {
      const studentData = ref({
        name: {
          last: 'Kent',
        },
        username: 'superman',
      });

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'superman',
        lastName: 'Kent',
      });
    });

    it('should handle null ref values', () => {
      const studentData = ref(null);

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: '',
        lastName: '',
      });
    });
  });

  describe('Edge cases and data variations', () => {
    it('should handle numeric values in name fields', () => {
      const studentData = {
        name: {
          first: 123,
          last: 456,
        },
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 123,
        lastName: 456,
      });
    });

    it('should handle whitespace-only names', () => {
      const studentData = {
        name: {
          first: '   ',
          last: '\t\n',
        },
        username: 'cleanuser',
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: '   ',
        lastName: '\t\n',
      });
    });

    it('should handle special characters in names', () => {
      const studentData = {
        name: {
          first: 'José-María',
          last: "O'Connor",
        },
      };

      const result = getStudentDisplayName(studentData);
      expect(result).toEqual({
        firstName: 'José-María',
        lastName: "O'Connor",
      });
    });
  });
});
