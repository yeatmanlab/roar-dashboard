import { describe, it, expect } from 'vitest';
import { TaskVariantStatusSchema } from '@roar-dashboard/api-contract';
import { taskVariantStatusEnum } from '../db/schema/enums';

describe('TaskVariantStatusEnum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(taskVariantStatusEnum.enumValues);
      const contractValues = new Set(TaskVariantStatusSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
