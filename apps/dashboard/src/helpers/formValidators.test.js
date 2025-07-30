import { describe, it, expect, vi } from 'vitest';
import { hasNoDuplicates, notInBlacklist } from './formValidators';

vi.mock('@vuelidate/validators', () => ({
  helpers: {
    withParams: vi.fn((params, validator) => validator),
    withMessage: vi.fn((message, validator) => validator),
  },
}));

describe('formValidators', () => {
  describe('hasNoDuplicates', () => {
    it('should return true for an array with no duplicates', () => {
      const collection = [{ name: 'apple' }, { name: 'banana' }, { name: 'orange' }];
      const validator = hasNoDuplicates(collection, 'name', 'Duplicate name');
      expect(validator('apple')).toBe(true);
    });

    it('should return false for an array with duplicates', () => {
      const collection = [{ name: 'apple' }, { name: 'banana' }, { name: 'apple' }];
      const validator = hasNoDuplicates(collection, 'name', 'Duplicate name');
      expect(validator('apple')).toBe(false);
    });

    it('should handle empty values', () => {
      const collection = [{ name: 'apple' }, { name: 'banana' }];
      const validator = hasNoDuplicates(collection, 'name', 'Duplicate name');
      expect(validator('')).toBe(true);
    });
  });

  describe('notInBlacklist', () => {
    it('should return true for a value not in the blacklist', () => {
      const blacklist = ['test', 'example', 'sample'];
      const validator = notInBlacklist(blacklist, 'Value is blacklisted');
      expect(validator('valid')).toBe(true);
    });

    it('should return false for a value in the blacklist', () => {
      const blacklist = ['test', 'example', 'sample'];
      const validator = notInBlacklist(blacklist, 'Value is blacklisted');
      expect(validator('example')).toBe(false);
    });

    it('should handle case sensitivity appropriately', () => {
      const blacklist = ['Test', 'Example', 'Sample'];
      const validator = notInBlacklist(blacklist, 'Value is blacklisted');
      expect(validator('test')).toBe(true);
    });

    it('should handle empty blacklist', () => {
      const blacklist = [];
      const validator = notInBlacklist(blacklist, 'Value is blacklisted');
      expect(validator('test')).toBe(true);
    });

    it('should handle empty values', () => {
      const blacklist = ['test', 'example'];
      const validator = notInBlacklist(blacklist, 'Value is blacklisted');
      expect(validator('')).toBe(true);
    });
  });
});
