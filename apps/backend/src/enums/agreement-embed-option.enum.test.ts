import { describe, it, expect } from 'vitest';
import { AgreementEmbedOption as ContractAgreementEmbedOption } from '@roar-dashboard/api-contract';
import { AgreementEmbedOption } from './agreement-embed-option.enum';

describe('AgreementEmbedOption enum', () => {
  describe('sync with api-contract', () => {
    it('backend enum matches api-contract enum', () => {
      const backendValues = new Set(Object.values(AgreementEmbedOption));
      const contractValues = new Set(Object.values(ContractAgreementEmbedOption));

      expect(backendValues).toEqual(contractValues);
    });
  });
});
