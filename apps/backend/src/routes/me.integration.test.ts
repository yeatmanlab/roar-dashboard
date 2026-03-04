/**
 * Route integration tests for /v1/me endpoint.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * The /me endpoint returns the authenticated user's own profile — there is no
 * role-based access filtering. Every authenticated user can read their own data.
 *
 * Each endpoint section follows the structure:
 *   1. Authorization — verify all tiers can access their own profile
 *   2. Error cases — 401 unauthenticated
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import { createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
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
  const { registerMeRoutes } = await import('./me');

  app = createTestApp(registerMeRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/me
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/me', () => {
  describe('authorization', () => {
    it('superAdmin tier can retrieve their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.id).toEqual(expect.any(String));
      expect(res.body.data.userType).toEqual(expect.any(String));
    });

    it('siteAdmin tier can retrieve their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.siteAdmin).toReturn(200);

      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('admin tier can retrieve their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.admin).toReturn(200);

      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('educator tier can retrieve their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.educator).toReturn(200);

      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('student tier can retrieve their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.student).toReturn(200);

      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('caregiver tier can retrieve their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.caregiver).toReturn(200);

      expect(res.body.data.id).toEqual(expect.any(String));
    });
  });

  describe('response content', () => {
    it('returns the correct profile fields for a known fixture user', async () => {
      const res = await expectRoute('GET', '/v1/me').as({ authId: baseFixture.districtAdmin.authId! }).toReturn(200);

      expect(res.body.data).toMatchObject({
        id: baseFixture.districtAdmin.id,
        userType: baseFixture.districtAdmin.userType,
        nameFirst: baseFixture.districtAdmin.nameFirst,
        nameLast: baseFixture.districtAdmin.nameLast,
      });
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', '/v1/me').unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });
  });
});
