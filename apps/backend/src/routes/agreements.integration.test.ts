/**
 * Route integration tests for /v1/agreements endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Because agreements are system-wide resources required for consent/onboarding flows,
 * all authenticated users see the same list regardless of role or org membership.
 *
 * Note: 500/DATABASE_QUERY_FAILED is not covered here because there is no established
 * pattern in this test suite for forcing a real DB failure without affecting other tests.
 * The 500 error path is covered at the controller unit test layer
 * (agreements.controller.test.ts: 'returns 500 when service throws an ApiError').
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import { createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
import { AgreementType } from '../enums/agreement-type.enum';
import { ApiErrorCode } from '../enums/api-error-code.enum';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerAgreementsRoutes } = await import('./agreements');

  app = createTestApp(registerAgreementsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/agreements
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/agreements', () => {
  describe('authentication', () => {
    it('returns 401 without authentication', async () => {
      const res = await expectRoute('GET', '/v1/agreements').unauthenticated().toReturn(401);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });
  });

  describe('authorization', () => {
    it('superAdmin can list agreements', async () => {
      const res = await expectRoute('GET', '/v1/agreements').as(tiers.superAdmin).toReturn(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('admin can list agreements', async () => {
      const res = await expectRoute('GET', '/v1/agreements').as(tiers.admin).toReturn(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('educator can list agreements', async () => {
      const res = await expectRoute('GET', '/v1/agreements').as(tiers.educator).toReturn(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('student can list agreements', async () => {
      const res = await expectRoute('GET', '/v1/agreements').as(tiers.student).toReturn(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('caregiver can list agreements', async () => {
      const res = await expectRoute('GET', '/v1/agreements').as(tiers.caregiver).toReturn(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });
  });

  describe('response shape', () => {
    it('returns paginated result with correct shape', async () => {
      const agreement = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: agreement.id } },
      );

      const res = await expectRoute('GET', '/v1/agreements').as(tiers.admin).toReturn(200);

      expect(res.body.data).toMatchObject({
        items: expect.any(Array),
        pagination: {
          page: expect.any(Number),
          perPage: expect.any(Number),
          totalItems: expect.any(Number),
          totalPages: expect.any(Number),
        },
      });
    });

    it('returns agreement fields including currentVersion', async () => {
      const agreement = await AgreementFactory.create({ agreementType: AgreementType.TOS });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US', githubFilename: 'TOS.md' },
        { transient: { agreementId: agreement.id } },
      );

      const res = await expectRoute('GET', '/v1/agreements').as(tiers.admin).toReturn(200);

      const item = res.body.data.items.find((i: { id: string }) => i.id === agreement.id);
      expect(item).toBeDefined();
      expect(item).toMatchObject({
        id: agreement.id,
        name: agreement.name,
        agreementType: AgreementType.TOS,
        createdAt: expect.any(String),
        currentVersion: expect.objectContaining({
          locale: 'en-US',
          githubFilename: 'TOS.md',
        }),
      });
    });
  });

  describe('locale filtering', () => {
    it('only returns agreements that have a current version in the requested locale', async () => {
      const agreementEn = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: agreementEn.id } },
      );

      const agreementEs = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'es-MX' },
        { transient: { agreementId: agreementEs.id } },
      );

      const res = await expectRoute('GET', '/v1/agreements?locale=es-MX').as(tiers.admin).toReturn(200);

      const ids = res.body.data.items.map((i: { id: string }) => i.id);
      expect(ids).toContain(agreementEs.id);
      expect(ids).not.toContain(agreementEn.id);
    });
  });

  describe('agreementType filter', () => {
    it('filters to the requested agreement type', async () => {
      const consent = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: consent.id } },
      );

      const tos = await AgreementFactory.create({ agreementType: AgreementType.TOS });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: tos.id } },
      );

      const res = await expectRoute('GET', `/v1/agreements?agreementType=${AgreementType.CONSENT}`)
        .as(tiers.admin)
        .toReturn(200);

      const ids = res.body.data.items.map((i: { id: string }) => i.id);
      expect(ids).toContain(consent.id);
      expect(ids).not.toContain(tos.id);
    });
  });

  describe('embed=versions', () => {
    it('includes all versions when embed=versions is requested', async () => {
      const agreement = await AgreementFactory.create({ agreementType: AgreementType.ASSENT });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: agreement.id } },
      );
      await AgreementVersionFactory.create(
        { isCurrent: false, locale: 'en-US' },
        { transient: { agreementId: agreement.id } },
      );

      const res = await expectRoute('GET', '/v1/agreements?embed=versions').as(tiers.admin).toReturn(200);

      const item = res.body.data.items.find((i: { id: string }) => i.id === agreement.id);
      expect(item).toBeDefined();
      expect(item.versions).toBeInstanceOf(Array);
      expect(item.versions.length).toBeGreaterThanOrEqual(2);
    });

    it('does not include versions when embed is not requested', async () => {
      const agreement = await AgreementFactory.create({ agreementType: AgreementType.CONSENT });
      await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US' },
        { transient: { agreementId: agreement.id } },
      );

      const res = await expectRoute('GET', '/v1/agreements').as(tiers.admin).toReturn(200);

      const item = res.body.data.items.find((i: { id: string }) => i.id === agreement.id);
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty('versions');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/agreements/:agreementId/versions/:versionId/content
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/agreements/:agreementId/versions/:versionId/content', () => {
  describe('cache headers', () => {
    it('sets Cache-Control header with public, max-age, and immutable directives', async () => {
      const agreement = await AgreementFactory.create({ agreementType: AgreementType.TOS });
      const version = await AgreementVersionFactory.create(
        { isCurrent: true, locale: 'en-US', githubFilename: 'TOS.md', githubOrgRepo: 'roar-org/legal-docs' },
        { transient: { agreementId: agreement.id } },
      );

      // The handler will return 500 in tests because GitHub is unreachable,
      // but the cache middleware runs before the handler so the header is set regardless.
      const res = await expectRoute('GET', `/v1/agreements/${agreement.id}/versions/${version.id}/content`)
        .as(tiers.admin)
        .toReturn(500);

      // Cache-Control is set by middleware before the handler executes
      const cacheControl = res.headers['cache-control'];
      expect(cacheControl).toBe('public, max-age=86400, immutable');
    });
  });

  describe('authentication', () => {
    it('returns 401 without authentication', async () => {
      const res = await expectRoute(
        'GET',
        '/v1/agreements/00000000-0000-0000-0000-000000000000/versions/00000000-0000-0000-0000-000000000001/content',
      )
        .unauthenticated()
        .toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });
  });
});
