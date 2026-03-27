import { describe, it, expect } from 'vitest';
import { ProgressStatusSchema, ProgressStatus } from '@roar-dashboard/api-contract';

/**
 * ProgressStatus is a computed field (not stored in the database), so there is no
 * Drizzle pgEnum to compare against. Instead, we verify the Zod schema options
 * match the ProgressStatus constant object and the expected value set.
 */
describe('ProgressStatus enum', () => {
  describe('sync with api-contract', () => {
    it('ProgressStatusSchema options match ProgressStatus constant', () => {
      const schemaValues = new Set(ProgressStatusSchema.options);
      const constantValues = new Set(Object.values(ProgressStatus));

      expect(schemaValues).toEqual(constantValues);
    });

    it('contains all expected status values', () => {
      const expected = new Set(['assigned', 'started', 'completed', 'optional']);
      const actual = new Set(ProgressStatusSchema.options);

      expect(actual).toEqual(expected);
    });
  });
});
