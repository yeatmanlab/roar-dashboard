import { describe, it, expect } from 'vitest';
import { FreeReducedLunchStatusSchema } from '@roar-dashboard/api-contract';
import { freeReducedLunchStatusEnum } from '../db/schema/enums';

describe('FreeReducedLunchStatus enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(freeReducedLunchStatusEnum.enumValues);
      const contractValues = new Set(FreeReducedLunchStatusSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
