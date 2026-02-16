import { describe, it, expect } from 'vitest';
import { isForeignKeyViolation, isUniqueViolation, PostgresErrorCode } from './postgres-error.util';

describe('postgres-error.util', () => {
  describe('PostgresErrorCode', () => {
    it('should have correct SQLSTATE codes', () => {
      expect(PostgresErrorCode.FOREIGN_KEY_VIOLATION).toBe('23503');
      expect(PostgresErrorCode.UNIQUE_VIOLATION).toBe('23505');
      expect(PostgresErrorCode.CHECK_VIOLATION).toBe('23514');
      expect(PostgresErrorCode.NOT_NULL_VIOLATION).toBe('23502');
    });
  });

  describe('isForeignKeyViolation', () => {
    it('should return true for foreign key violation error', () => {
      const error = { code: '23503', message: 'violates foreign key constraint' };
      expect(isForeignKeyViolation(error)).toBe(true);
    });

    it('should return false for other Postgres errors', () => {
      const uniqueError = { code: '23505', message: 'duplicate key value' };
      expect(isForeignKeyViolation(uniqueError)).toBe(false);
    });

    it('should return false for errors without code property', () => {
      const error = new Error('Some error');
      expect(isForeignKeyViolation(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isForeignKeyViolation(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isForeignKeyViolation(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isForeignKeyViolation('error')).toBe(false);
      expect(isForeignKeyViolation(123)).toBe(false);
      expect(isForeignKeyViolation(true)).toBe(false);
    });

    it('should return false for objects with wrong code', () => {
      const error = { code: '42P01', message: 'relation does not exist' };
      expect(isForeignKeyViolation(error)).toBe(false);
    });
  });

  describe('isUniqueViolation', () => {
    it('should return true for unique violation error', () => {
      const error = { code: '23505', message: 'duplicate key value violates unique constraint' };
      expect(isUniqueViolation(error)).toBe(true);
    });

    it('should return false for other Postgres errors', () => {
      const fkError = { code: '23503', message: 'violates foreign key constraint' };
      expect(isUniqueViolation(fkError)).toBe(false);
    });

    it('should return false for errors without code property', () => {
      const error = new Error('Some error');
      expect(isUniqueViolation(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isUniqueViolation(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isUniqueViolation(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isUniqueViolation('error')).toBe(false);
      expect(isUniqueViolation(123)).toBe(false);
      expect(isUniqueViolation(true)).toBe(false);
    });
  });
});
