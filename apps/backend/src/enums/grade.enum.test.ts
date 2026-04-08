import { describe, it, expect } from 'vitest';
import { UserGradeSchema } from '@roar-dashboard/api-contract';
import { gradeEnum } from '../db/schema/enums';

describe('Grade enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(gradeEnum.enumValues);
      const contractValues = new Set(UserGradeSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
