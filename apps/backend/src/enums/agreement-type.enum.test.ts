import { describe, it, expect } from 'vitest';
import { AgreementTypeSchema } from '@roar-dashboard/api-contract';
import { agreementTypeEnum } from '../db/schema/enums';

describe('AgreementType enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract schema', () => {
      const backendValues = new Set(agreementTypeEnum.enumValues);
      const contractValues = new Set(AgreementTypeSchema.options);

      expect(backendValues).toEqual(contractValues);
    });
  });
});
