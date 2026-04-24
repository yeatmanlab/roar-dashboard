import { describe, it, expect } from 'vitest';
import { UserFamilyRoleSchema } from '@roar-dashboard/api-contract';
import { userFamilyRoleEnum } from '../db/schema/enums';

describe('UserFamilyRole enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(userFamilyRoleEnum.enumValues);
      const contractValues = new Set(UserFamilyRoleSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
