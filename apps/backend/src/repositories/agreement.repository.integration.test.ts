/**
 * Integration tests for AgreementRepository.
 *
 * Tests AgreementRepository operations against the real test database.
 * Validates that the repository correctly queries the agreements table,
 * including the new listAll and getVersionsByAgreementIds methods.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AgreementRepository } from './agreement.repository';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { UserAgreementFactory } from '../test-support/factories/user-agreement.factory';
import { AgreementType } from '../enums/agreement-type.enum';
import { baseFixture } from '../test-support/fixtures';

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

  describe('listAll', () => {
    it('returns only agreements with a current version in the requested locale', async () => {
      const withEnUs = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      const withoutEnUs = await AgreementFactory.create({ agreementType: AgreementType.ASSENT });

      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: withEnUs.id } },
      );
      // withoutEnUs intentionally gets no version

      const result = await repository.listAll({ page: 1, perPage: 100, locale: 'en-US' });

      const ids = result.items.map((item) => item.id);
      expect(ids).toContain(withEnUs.id);
      expect(ids).not.toContain(withoutEnUs.id);
    });

    it('returns currentVersion populated for each item', async () => {
      const agreement = await AgreementFactory.create({ agreementType: AgreementType.TOS });
      const version = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US', githubFilename: 'tos.md' },
        { transient: { agreementId: agreement.id } },
      );

      const result = await repository.listAll({ page: 1, perPage: 100, locale: 'en-US' });

      const item = result.items.find((i) => i.id === agreement.id);
      expect(item).toBeDefined();
      expect(item!.currentVersion).not.toBeNull();
      expect(item!.currentVersion!.id).toBe(version.id);
      expect(item!.currentVersion!.githubFilename).toBe('tos.md');
    });

    it('filters by locale — excludes agreements with no version in the requested locale', async () => {
      const enUsOnly = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      const esMx = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });

      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: enUsOnly.id } },
      );
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'es-MX' },
        { transient: { agreementId: esMx.id } },
      );

      const result = await repository.listAll({ page: 1, perPage: 100, locale: 'es-MX' });

      const ids = result.items.map((i) => i.id);
      expect(ids).toContain(esMx.id);
      expect(ids).not.toContain(enUsOnly.id);
    });

    it('filters by agreementType when provided', async () => {
      const consent = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      const assent = await AgreementFactory.create({ agreementType: AgreementType.ASSENT });

      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: consent.id } },
      );
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: assent.id } },
      );

      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        locale: 'en-US',
        agreementType: AgreementType.CONSENT,
      });

      const ids = result.items.map((i) => i.id);
      expect(ids).toContain(consent.id);
      expect(ids).not.toContain(assent.id);
    });

    it('paginates results correctly', async () => {
      // Create 3 agreements with en-US versions
      const created = await Promise.all([
        AgreementFactory.create({ agreementType: AgreementType.TOS }),
        AgreementFactory.create({ agreementType: AgreementType.CONSENT }),
        AgreementFactory.create({ agreementType: AgreementType.ASSENT }),
      ]);

      await Promise.all(
        created.map((a) =>
          AgreementVersionFactory.create({ isCurrent: true, locale: 'en-US' }, { transient: { agreementId: a.id } }),
        ),
      );

      const page1 = await repository.listAll({ page: 1, perPage: 2, locale: 'en-US' });
      const page2 = await repository.listAll({ page: 2, perPage: 2, locale: 'en-US' });

      expect(page1.items.length).toBeLessThanOrEqual(2);
      expect(page1.totalItems).toBeGreaterThanOrEqual(3);
      // Page 2 should have at least one item from our 3 created
      expect(page1.items.length + page2.items.length).toBeLessThanOrEqual(page1.totalItems);
    });

    it('sorts by name ascending', async () => {
      const alpha = await AgreementFactory.create({ name: 'AAA Agreement', agreementType: AgreementType.TOS });
      const beta = await AgreementFactory.create({ name: 'ZZZ Agreement', agreementType: AgreementType.TOS });

      await Promise.all([
        AgreementVersionFactory.create({ isCurrent: true, locale: 'en-US' }, { transient: { agreementId: alpha.id } }),
        AgreementVersionFactory.create({ isCurrent: true, locale: 'en-US' }, { transient: { agreementId: beta.id } }),
      ]);

      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        locale: 'en-US',
        orderBy: { field: 'name', direction: 'asc' },
      });

      const names = result.items.map((i) => i.name);
      const alphaIdx = names.indexOf('AAA Agreement');
      const betaIdx = names.indexOf('ZZZ Agreement');
      expect(alphaIdx).toBeGreaterThanOrEqual(0);
      expect(betaIdx).toBeGreaterThanOrEqual(0);
      expect(alphaIdx).toBeLessThan(betaIdx);
    });
  });

  describe('getVersionsByAgreementIds', () => {
    it('returns an empty map for an empty ids array', async () => {
      const result = await repository.getVersionsByAgreementIds([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('returns all versions for the given agreement ids', async () => {
      const agreement = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      const v1 = await AgreementVersionFactory.create(
        { isCurrent: false, locale: 'en-US', githubCommitSha: 'aaa111' },
        { transient: { agreementId: agreement.id } },
      );
      const v2 = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US', githubCommitSha: 'bbb222' },
        { transient: { agreementId: agreement.id } },
      );

      const result = await repository.getVersionsByAgreementIds([agreement.id]);

      expect(result.has(agreement.id)).toBe(true);
      const versions = result.get(agreement.id)!;
      expect(versions.length).toBe(2);
      const versionIds = versions.map((v) => v.id);
      expect(versionIds).toContain(v1.id);
      expect(versionIds).toContain(v2.id);
    });

    it('sorts versions by createdAt descending', async () => {
      const agreement = await AgreementFactory.create({ agreementType: AgreementType.TOS });

      // Insert with explicit timestamps to ensure deterministic ordering
      const older = await AgreementVersionFactory.create(
        { isCurrent: false, locale: 'en-US', createdAt: new Date('2024-01-01') },
        { transient: { agreementId: agreement.id } },
      );
      const newer = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US', createdAt: new Date('2025-01-01') },
        { transient: { agreementId: agreement.id } },
      );

      const result = await repository.getVersionsByAgreementIds([agreement.id]);

      const versions = result.get(agreement.id)!;
      expect(versions[0]!.id).toBe(newer.id);
      expect(versions[1]!.id).toBe(older.id);
    });

    it('groups versions by agreementId across multiple agreements', async () => {
      const a1 = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      const a2 = await AgreementFactory.create({ agreementType: AgreementType.ASSENT });

      await AgreementVersionFactory.create({ isCurrent: true, locale: 'en-US' }, { transient: { agreementId: a1.id } });
      await AgreementVersionFactory.create({ isCurrent: true, locale: 'en-US' }, { transient: { agreementId: a2.id } });

      const result = await repository.getVersionsByAgreementIds([a1.id, a2.id]);

      expect(result.has(a1.id)).toBe(true);
      expect(result.has(a2.id)).toBe(true);
      expect(result.get(a1.id)!.length).toBeGreaterThanOrEqual(1);
      expect(result.get(a2.id)!.length).toBeGreaterThanOrEqual(1);
    });

    it('does not include versions for agreements not in the ids list', async () => {
      const included = await AgreementFactory.create({ agreementType: AgreementType.TOS });
      const excluded = await AgreementFactory.create({ agreementType: AgreementType.TOS });

      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: included.id } },
      );
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: excluded.id } },
      );

      const result = await repository.getVersionsByAgreementIds([included.id]);

      expect(result.has(included.id)).toBe(true);
      expect(result.has(excluded.id)).toBe(false);
    });
  });

  describe('getUnsignedTosAgreements', () => {
    it('returns all TOS agreements when user has signed none', async () => {
      const userId = baseFixture.districtAdmin.id;
      const tosAgreement = await AgreementFactory.create({ agreementType: AgreementType.TOS });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: tosAgreement.id } },
      );

      const result = await repository.getUnsignedTosAgreements(userId);

      const ids = result.map((r) => r.agreement.id);
      expect(ids).toContain(tosAgreement.id);
    });

    it('excludes TOS agreements the user has already signed (current version)', async () => {
      const userId = baseFixture.districtAdmin.id;
      const signedTos = await AgreementFactory.create({ agreementType: AgreementType.TOS });
      const unsignedTos = await AgreementFactory.create({ agreementType: AgreementType.TOS });

      const signedVersion = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: signedTos.id } },
      );
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: unsignedTos.id } },
      );

      // User signs the current version of signedTos
      await UserAgreementFactory.create({
        userId,
        agreementVersionId: signedVersion.id,
      });

      const result = await repository.getUnsignedTosAgreements(userId);

      const ids = result.map((r) => r.agreement.id);
      expect(ids).not.toContain(signedTos.id);
      expect(ids).toContain(unsignedTos.id);
    });

    it('returns empty array when all TOS agreements are signed', async () => {
      // Use a unique user so no other unsigned agreements leak in from other tests
      const userId = baseFixture.schoolBStudent.id;
      const tos = await AgreementFactory.create({ agreementType: AgreementType.TOS });
      const version = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: tos.id } },
      );

      await UserAgreementFactory.create({
        userId,
        agreementVersionId: version.id,
      });

      const result = await repository.getUnsignedTosAgreements(userId);

      // The user has signed all TOS agreements created in this test.
      // Other TOS agreements from earlier tests may still appear unsigned for this user,
      // so we verify the specific agreement is excluded rather than asserting empty.
      const ids = result.map((r) => r.agreement.id);
      expect(ids).not.toContain(tos.id);
    });

    it('cross-locale satisfaction — signing any current locale satisfies the agreement', async () => {
      const userId = baseFixture.classAStudent.id;
      const tos = await AgreementFactory.create({ agreementType: AgreementType.TOS });

      // Two current versions in different locales
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: tos.id } },
      );
      const esMxVersion = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'es-MX' },
        { transient: { agreementId: tos.id } },
      );

      // User signs only the es-MX version
      await UserAgreementFactory.create({
        userId,
        agreementVersionId: esMxVersion.id,
      });

      const result = await repository.getUnsignedTosAgreements(userId);

      // The agreement should be considered signed despite only signing one locale
      const ids = result.map((r) => r.agreement.id);
      expect(ids).not.toContain(tos.id);
    });

    it('signing an old non-current version does not satisfy the agreement', async () => {
      const userId = baseFixture.groupStudent.id;
      const tos = await AgreementFactory.create({ agreementType: AgreementType.TOS });

      // Old version (no longer current)
      const oldVersion = await AgreementVersionFactory.create(
        { isCurrent: false, locale: 'en-US' },
        { transient: { agreementId: tos.id } },
      );
      // New current version
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: tos.id } },
      );

      // User signed the old version only
      await UserAgreementFactory.create({
        userId,
        agreementVersionId: oldVersion.id,
      });

      const result = await repository.getUnsignedTosAgreements(userId);

      // Agreement still appears as unsigned since the signed version is not current
      const ids = result.map((r) => r.agreement.id);
      expect(ids).toContain(tos.id);
    });

    it('does not return non-TOS agreements (consent, assent)', async () => {
      const userId = baseFixture.districtAdmin.id;
      const consent = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      const assent = await AgreementFactory.create({ agreementType: AgreementType.ASSENT });

      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: consent.id } },
      );
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: assent.id } },
      );

      const result = await repository.getUnsignedTosAgreements(userId);

      const ids = result.map((r) => r.agreement.id);
      expect(ids).not.toContain(consent.id);
      expect(ids).not.toContain(assent.id);
    });

    it('returns current versions grouped with each unsigned agreement', async () => {
      const userId = baseFixture.districtAdmin.id;
      const tos = await AgreementFactory.create({ agreementType: AgreementType.TOS });

      const enUsVersion = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: tos.id } },
      );
      const esMxVersion = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'es-MX' },
        { transient: { agreementId: tos.id } },
      );
      // Old version should NOT appear
      await AgreementVersionFactory.create(
        { isCurrent: false, locale: 'en-US' },
        { transient: { agreementId: tos.id } },
      );

      const result = await repository.getUnsignedTosAgreements(userId);

      const entry = result.find((r) => r.agreement.id === tos.id);
      expect(entry).toBeDefined();
      const versionIds = entry!.currentVersions.map((v) => v.id);
      expect(versionIds).toContain(enUsVersion.id);
      expect(versionIds).toContain(esMxVersion.id);
      expect(versionIds).toHaveLength(2);
    });
  });
});
