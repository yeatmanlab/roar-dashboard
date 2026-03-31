/**
 * Integration tests for UserAgreementRepository.
 *
 * Tests UserAgreementRepository operations against the real test database.
 * Validates that the repository correctly writes to the user_agreements table.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { UserAgreementRepository } from './user-agreement.repository';
import { UserFactory } from '../test-support/factories/user.factory';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { AgreementType } from '../enums/agreement-type.enum';

describe('UserAgreementRepository Integration', () => {
  let repository: UserAgreementRepository;

  beforeAll(() => {
    repository = new UserAgreementRepository();
  });

  // Note: Do not truncate in afterAll - let the test suite handle cleanup
  // to avoid interfering with other test files running concurrently

  describe('create', () => {
    it('should create a new user agreement record', async () => {
      const user = await UserFactory.create();
      const agreement = await AgreementFactory.create({
        name: 'Test Agreement',
        agreementType: AgreementType.TOS,
      });
      const version = await AgreementVersionFactory.create(
        {
          locale: 'en-US',
        },
        {
          transient: { agreementId: agreement.id },
        },
      );

      const agreementTimestamp = new Date();
      const { id: userAgreementId } = await repository.create({
        data: {
          userId: user.id,
          agreementVersionId: version.id,
          agreementTimestamp,
        },
      });

      expect(userAgreementId).toBeDefined();

      // Verify it was actually saved by fetching it
      const retrieved = await repository.getById({ id: userAgreementId });
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(userAgreementId);
      expect(retrieved!.userId).toBe(user.id);
      expect(retrieved!.agreementVersionId).toBe(version.id);
      expect(retrieved!.agreementTimestamp).toBeInstanceOf(Date);
      expect(retrieved!.createdAt).toBeInstanceOf(Date);
      // updatedAt is nullable and only set on UPDATE, not INSERT
      expect(retrieved!.updatedAt === null || retrieved!.updatedAt instanceof Date).toBe(true);
    });

    it('should create user agreement with specific timestamp', async () => {
      const user = await UserFactory.create();
      const agreement = await AgreementFactory.create({
        name: 'Child Assent',
        agreementType: AgreementType.ASSENT,
      });
      const version = await AgreementVersionFactory.create(
        {
          locale: 'en-US',
        },
        {
          transient: { agreementId: agreement.id },
        },
      );

      const specificTimestamp = new Date('2024-01-15T10:30:00Z');
      const { id: userAgreementId } = await repository.create({
        data: {
          userId: user.id,
          agreementVersionId: version.id,
          agreementTimestamp: specificTimestamp,
        },
      });

      expect(userAgreementId).toBeDefined();

      // Verify timestamp is preserved
      const retrieved = await repository.getById({ id: userAgreementId });
      expect(retrieved).not.toBeNull();
      expect(retrieved!.userId).toBe(user.id);
      expect(retrieved!.agreementTimestamp.toISOString()).toBe(specificTimestamp.toISOString());
    });

    it('should allow duplicate consents for same user and agreement version', async () => {
      const user = await UserFactory.create();
      const agreement = await AgreementFactory.create({
        name: 'Annual Reconsent Agreement',
        agreementType: AgreementType.CONSENT,
      });
      const version = await AgreementVersionFactory.create(
        {
          locale: 'en-US',
        },
        {
          transient: { agreementId: agreement.id },
        },
      );

      // Create first consent
      const firstTimestamp = new Date('2024-01-01T00:00:00Z');
      const { id: firstConsentId } = await repository.create({
        data: {
          userId: user.id,
          agreementVersionId: version.id,
          agreementTimestamp: firstTimestamp,
        },
      });

      // Create second consent (duplicate for annual reconsent)
      const secondTimestamp = new Date('2025-01-01T00:00:00Z');
      const { id: secondConsentId } = await repository.create({
        data: {
          userId: user.id,
          agreementVersionId: version.id,
          agreementTimestamp: secondTimestamp,
        },
      });

      expect(firstConsentId).toBeDefined();
      expect(secondConsentId).toBeDefined();
      expect(firstConsentId).not.toBe(secondConsentId);

      // Both should exist in database
      const firstRetrieved = await repository.getById({ id: firstConsentId });
      const secondRetrieved = await repository.getById({ id: secondConsentId });

      expect(firstRetrieved).not.toBeNull();
      expect(secondRetrieved).not.toBeNull();
      expect(firstRetrieved!.userId).toBe(user.id);
      expect(secondRetrieved!.userId).toBe(user.id);
      expect(firstRetrieved!.agreementTimestamp.toISOString()).toBe(firstTimestamp.toISOString());
      expect(secondRetrieved!.agreementTimestamp.toISOString()).toBe(secondTimestamp.toISOString());
    });
  });

  describe('getById', () => {
    it('should return user agreement when found', async () => {
      const user = await UserFactory.create();
      const agreement = await AgreementFactory.create({
        name: 'Lookup Test Agreement',
        agreementType: AgreementType.TOS,
      });
      const version = await AgreementVersionFactory.create(
        {
          locale: 'en-US',
        },
        {
          transient: { agreementId: agreement.id },
        },
      );

      const { id: userAgreementId } = await repository.create({
        data: {
          userId: user.id,
          agreementVersionId: version.id,
          agreementTimestamp: new Date(),
        },
      });

      const result = await repository.getById({ id: userAgreementId });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(userAgreementId);
      expect(result!.userId).toBe(user.id);
      expect(result!.agreementVersionId).toBe(version.id);
      expect(result!.agreementTimestamp).toBeInstanceOf(Date);
    });

    it('should return null when user agreement not found', async () => {
      const result = await repository.getById({ id: '00000000-0000-0000-0000-000000000000' });

      expect(result).toBeNull();
    });
  });
});
