import { describe, it, expect } from 'vitest';
import { UserTypeSchema } from '@roar-dashboard/api-contract';
import { userTypeEnum } from '../db/schema/enums';

describe('UserType enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = [...userTypeEnum.enumValues].sort();
      const contractValues = [...UserTypeSchema.options].sort();

      expect(backendValues).toEqual(contractValues);
    });
  });
});
