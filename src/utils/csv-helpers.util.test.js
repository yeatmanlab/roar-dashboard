import { generateColumns, findMappedColumn, isEmailValid, isPasswordValid } from './csv-helpers.util';
import { HEADER_OVERRIDES } from '@/constants/studentRegistration';

describe('csv-helpers.util', () => {
  describe('generateColumns', () => {
    it('should generate columns from a raw JSON object', () => {
      const rawJson = {
        rowKey: '1',
        name: 'John Doe',
        dob: '2000-01-01',
        age: 23,
      };

      const expected = [
        {
          field: 'name',
          header: 'Name',
          dataType: 'string',
        },
        {
          field: 'dob',
          header: 'Date of Birth',
          dataType: 'string',
        },
        {
          field: 'age',
          header: 'Age',
          dataType: 'number',
        },
      ];

      const result = generateColumns(rawJson);
      expect(result).toEqual(expected);
    });

    it('should use header overrides when available', () => {
      const rawJson = {
        rowKey: '1',
        dob: '2000-01-01',
      };

      const expected = [
        {
          field: 'dob',
          header: HEADER_OVERRIDES.dob,
          dataType: 'string',
        },
      ];

      const result = generateColumns(rawJson);
      expect(result).toEqual(expected);
    });
  });

  describe('findMappedColumn', () => {
    it('should find a mapped column in mappings object', () => {
      const mappings = {
        required: {
          username: 'user',
          email: 'email',
        },
        names: {
          first: 'firstName',
        },
      };

      const result = findMappedColumn(mappings, 'username');
      expect(result).toBe('user');
    });

    it('should return null when column is not found', () => {
      const mappings = {
        required: {
          username: 'user',
          email: 'email',
        },
      };

      const result = findMappedColumn(mappings, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should join array values', () => {
      const mappings = {
        required: {
          username: ['user', 'name'],
        },
      };

      const result = findMappedColumn(mappings, 'username');
      expect(result).toBe('user, name');
    });
  });

  describe('isEmailValid', () => {
    it('should return true for valid emails', () => {
      expect(isEmailValid('test@example.com')).toBe(true);
      expect(isEmailValid('user.name@domain.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isEmailValid('')).toBe(false);
      expect(isEmailValid(null)).toBe(false);
      expect(isEmailValid('notanemail')).toBe(false);
      expect(isEmailValid('missing@domain')).toBe(false);
    });
  });

  describe('isPasswordValid', () => {
    it('should return true for valid passwords', () => {
      expect(isPasswordValid('password123')).toBe(true);
      expect(isPasswordValid('validPass')).toBe(true);
    });

    it('should return false for invalid passwords', () => {
      expect(isPasswordValid('')).toBe(false);
      expect(isPasswordValid(null)).toBe(false);
      expect(isPasswordValid('short')).toBe(false);
      expect(isPasswordValid('123456')).toBe(false);
    });
  });
});
