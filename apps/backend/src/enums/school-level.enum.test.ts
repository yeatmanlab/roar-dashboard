import { describe, it, expect } from 'vitest';
import { UserSchoolLevelSchema } from '@roar-dashboard/api-contract';
import { schoolLevelEnum } from '../db/schema/enums';

describe('SchoolLevel enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(schoolLevelEnum.enumValues);
      const contractValues = new Set(UserSchoolLevelSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
