import { describe, it, expect } from 'vitest';
import { UserTypeSchema } from '@roar-dashboard/api-contract';
import { userTypeEnum } from '../db/schema/enums';

describe('UserType enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(userTypeEnum.enumValues);
      const contractValues = new Set(UserTypeSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
