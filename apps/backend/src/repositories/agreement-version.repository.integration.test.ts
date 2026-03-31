/**
 * Integration tests for AgreementVersionRepository.
 *
 * Tests AgreementVersionRepository operations against the real test database.
 * Validates that the repository correctly queries the agreement_versions table.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AgreementVersionRepository } from './agreement-version.repository';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { AgreementType } from '../enums/agreement-type.enum';

describe('AgreementVersionRepository Integration', () => {
  let repository: AgreementVersionRepository;

  beforeAll(() => {
    repository = new AgreementVersionRepository();
  });

  // Note: Do not truncate in afterAll - let the test suite handle cleanup
  // to avoid interfering with other test files running concurrently

  describe('getById', () => {
    it('should return agreement version when found', async () => {
      const agreement = await AgreementFactory.create({
        name: 'Test Agreement',
        agreementType: AgreementType.TOS,
      });

      const version = await AgreementVersionFactory.create(undefined, {
        transient: { agreementId: agreement.id },
        locale: 'en-US',
        isCurrent: true,
      });

      const result = await repository.getById({ id: version.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(version.id);
      expect(result!.agreementId).toBe(agreement.id);
      expect(result!.locale).toBe('en-US');
      expect(result!.isCurrent).toBe(true);
    });

    it('should return null when agreement version not found', async () => {
      const result = await repository.getById({ id: '00000000-0000-0000-0000-000000000000' });

      expect(result).toBeNull();
    });

    it('should return agreement version with GitHub metadata', async () => {
      const agreement = await AgreementFactory.create({
        name: 'Versioned Agreement',
        agreementType: AgreementType.CONSENT,
      });

      const version = await AgreementVersionFactory.create(
        {
          githubFilename: 'CONSENT_v2.1.0.md',
          githubOrgRepo: 'roar-org/legal-docs',
          locale: 'en-US',
        },
        {
          transient: { agreementId: agreement.id },
        },
      );

      const result = await repository.getById({ id: version.id });

      expect(result).not.toBeNull();
      expect(result!.githubFilename).toBe('CONSENT_v2.1.0.md');
      expect(result!.githubOrgRepo).toBe('roar-org/legal-docs');
    });

    it('should return agreement version with timestamps', async () => {
      const agreement = await AgreementFactory.create({
        name: 'Timestamped Agreement',
        agreementType: AgreementType.ASSENT,
      });

      const version = await AgreementVersionFactory.create(undefined, {
        transient: { agreementId: agreement.id },
        locale: 'es-MX',
      });

      const result = await repository.getById({ id: version.id });

      expect(result).not.toBeNull();
      expect(result!.createdAt).toBeInstanceOf(Date);
      // updatedAt is nullable and only set on UPDATE, not INSERT
      expect(result!.updatedAt === null || result!.updatedAt instanceof Date).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new agreement version', async () => {
      const agreement = await AgreementFactory.create({
        name: 'Agreement for New Version',
        agreementType: AgreementType.TOS,
      });

      const { id: versionId } = await repository.create({
        data: {
          agreementId: agreement.id,
          locale: 'en-US',
          githubFilename: 'TOS_v3.0.0.md',
          githubOrgRepo: 'roar-org/legal-docs',
          githubCommitSha: 'abc123def456',
          isCurrent: true,
        },
      });

      expect(versionId).toBeDefined();

      // Verify it was actually saved by fetching it
      const retrieved = await repository.getById({ id: versionId });
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(versionId);
      expect(retrieved!.agreementId).toBe(agreement.id);
      expect(retrieved!.githubFilename).toBe('TOS_v3.0.0.md');
      expect(retrieved!.githubOrgRepo).toBe('roar-org/legal-docs');
      expect(retrieved!.githubCommitSha).toBe('abc123def456');
      expect(retrieved!.locale).toBe('en-US');
      expect(retrieved!.isCurrent).toBe(true);
      expect(retrieved!.createdAt).toBeInstanceOf(Date);
      // updatedAt is nullable and only set on UPDATE, not INSERT
      expect(retrieved!.updatedAt === null || retrieved!.updatedAt instanceof Date).toBe(true);
    });

    it('should create agreement version with different locales', async () => {
      const agreement = await AgreementFactory.create({
        name: 'Multilingual Agreement',
        agreementType: AgreementType.CONSENT,
      });

      const { id: enVersionId } = await repository.create({
        data: {
          agreementId: agreement.id,
          locale: 'en-US',
          githubFilename: 'CONSENT_v1.0.0_en.md',
          githubOrgRepo: 'roar-org/legal-docs',
          githubCommitSha: 'abc123en',
          isCurrent: true,
        },
      });

      const { id: esVersionId } = await repository.create({
        data: {
          agreementId: agreement.id,
          locale: 'es-MX',
          githubFilename: 'CONSENT_v1.0.0_es.md',
          githubOrgRepo: 'roar-org/legal-docs',
          githubCommitSha: 'abc123es',
          isCurrent: true,
        },
      });

      const enResult = await repository.getById({ id: enVersionId });
      const esResult = await repository.getById({ id: esVersionId });

      expect(enResult!.locale).toBe('en-US');
      expect(esResult!.locale).toBe('es-MX');
      expect(enResult!.agreementId).toBe(agreement.id);
      expect(esResult!.agreementId).toBe(agreement.id);
    });
  });
});
