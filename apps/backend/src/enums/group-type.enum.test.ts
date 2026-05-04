import { describe, it, expect } from 'vitest';
import { GroupTypeSchema } from '@roar-dashboard/api-contract';
import { groupTypeEnum } from '../db/schema/enums';

describe('GroupType enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(groupTypeEnum.enumValues);
      const contractValues = new Set(GroupTypeSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
