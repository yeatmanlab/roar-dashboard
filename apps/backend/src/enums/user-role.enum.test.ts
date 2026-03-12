import { describe, it, expect } from 'vitest';
import { UserRoleSchema } from '@roar-dashboard/api-contract';
import { userRoleEnum } from '../db/schema/enums';

describe('UserRole enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(userRoleEnum.enumValues);
      const contractValues = new Set(UserRoleSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
