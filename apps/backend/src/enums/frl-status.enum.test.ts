import { describe, it, expect } from 'vitest';
import { UserStatusFrlSchema } from '@roar-dashboard/api-contract';
import { freeReducedLunchStatusEnum } from '../db/schema/enums';

describe('FrlStatus enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(freeReducedLunchStatusEnum.enumValues);
      const contractValues = new Set(UserStatusFrlSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
