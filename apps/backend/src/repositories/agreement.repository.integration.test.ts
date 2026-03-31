/**
 * Integration tests for AgreementRepository.
 *
 * Tests AgreementRepository operations against the real test database.
 * Validates that the repository correctly queries the agreements table.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AgreementRepository } from './agreement.repository';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementType } from '../enums/agreement-type.enum';

describe('AgreementRepository Integration', () => {
  let repository: AgreementRepository;

  beforeAll(() => {
    repository = new AgreementRepository();
  });

  // Note: Do not truncate in afterAll - let the test suite handle cleanup
  // to avoid interfering with other test files running concurrently

  describe('getById', () => {
    it('should return agreement when found', async () => {
      const agreement = await AgreementFactory.create({
        name: 'Test Terms of Service',
        agreementType: AgreementType.TOS,
      });

      const result = await repository.getById({ id: agreement.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(agreement.id);
      expect(result!.name).toBe('Test Terms of Service');
      expect(result!.agreementType).toBe(AgreementType.TOS);
    });

    it('should return null when agreement not found', async () => {
      const result = await repository.getById({ id: '00000000-0000-0000-0000-000000000000' });

      expect(result).toBeNull();
    });

    it('should handle different agreement types', async () => {
      const consentAgreement = await AgreementFactory.create({
        name: 'Parent Consent Form',
        agreementType: AgreementType.CONSENT,
      });

      const assentAgreement = await AgreementFactory.create({
        name: 'Child Assent Form',
        agreementType: AgreementType.ASSENT,
      });

      const tosAgreement = await AgreementFactory.create({
        name: 'Terms of Service',
        agreementType: AgreementType.TOS,
      });

      const consentResult = await repository.getById({ id: consentAgreement.id });
      const assentResult = await repository.getById({ id: assentAgreement.id });
      const tosResult = await repository.getById({ id: tosAgreement.id });

      expect(consentResult!.agreementType).toBe(AgreementType.CONSENT);
      expect(assentResult!.agreementType).toBe(AgreementType.ASSENT);
      expect(tosResult!.agreementType).toBe(AgreementType.TOS);
    });

    it('should return agreement with timestamps', async () => {
      const agreement = await AgreementFactory.create({
        name: 'Timestamped Agreement',
        agreementType: AgreementType.TOS,
      });

      const result = await repository.getById({ id: agreement.id });

      expect(result).not.toBeNull();
      expect(result!.createdAt).toBeInstanceOf(Date);
      // updatedAt is nullable and only set on UPDATE, not INSERT
      expect(result!.updatedAt === null || result!.updatedAt instanceof Date).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new agreement', async () => {
      const { id: agreementId } = await repository.create({
        data: {
          name: 'New Agreement via Repository',
          agreementType: AgreementType.CONSENT,
        },
      });

      expect(agreementId).toBeDefined();

      // Verify it was actually saved by fetching it
      const retrieved = await repository.getById({ id: agreementId });
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(agreementId);
      expect(retrieved!.name).toBe('New Agreement via Repository');
      expect(retrieved!.agreementType).toBe(AgreementType.CONSENT);
      expect(retrieved!.createdAt).toBeInstanceOf(Date);
      // updatedAt is nullable and only set on UPDATE, not INSERT
      expect(retrieved!.updatedAt === null || retrieved!.updatedAt instanceof Date).toBe(true);
    });
  });
});
