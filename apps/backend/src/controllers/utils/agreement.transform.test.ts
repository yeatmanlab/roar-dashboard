import { describe, it, expect } from 'vitest';
import { toAgreementItem } from './agreement.transform';
import { AgreementFactory } from '../../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../../test-support/factories/agreement-version.factory';

describe('agreement.transform', () => {
  describe('toAgreementItem', () => {
    it('flattens the agreement and its current version into the contract shape', () => {
      const agreement = AgreementFactory.build({
        id: 'agreement-1',
        name: 'Terms of Service',
        agreementType: 'tos',
      });
      const currentVersion = AgreementVersionFactory.build({
        id: 'version-1',
        agreementId: 'agreement-1',
        locale: 'en-US',
        githubFilename: 'TOS.md',
        githubOrgRepo: 'roar-org/agreements',
        githubCommitSha: 'abc123',
      });

      const result = toAgreementItem({ agreement, currentVersion });

      expect(result).toEqual({
        id: 'agreement-1',
        name: 'Terms of Service',
        agreementType: 'tos',
        currentVersion: {
          id: 'version-1',
          locale: 'en-US',
          githubFilename: 'TOS.md',
          githubOrgRepo: 'roar-org/agreements',
          githubCommitSha: 'abc123',
        },
      });
    });

    it('maps currentVersion to null when no version exists for the locale', () => {
      const agreement = AgreementFactory.build({ id: 'agreement-2', agreementType: 'assent' });

      const result = toAgreementItem({ agreement, currentVersion: null });

      expect(result.id).toBe('agreement-2');
      expect(result.agreementType).toBe('assent');
      expect(result.currentVersion).toBeNull();
    });
  });
});
