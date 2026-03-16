import { describe, it, expect } from 'vitest';
import { AuthProviderSchema } from '@roar-dashboard/api-contract';
import { authProviderEnum } from '../db/schema/enums';

describe('AuthProvider enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(authProviderEnum.enumValues);
      const contractValues = new Set(AuthProviderSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
