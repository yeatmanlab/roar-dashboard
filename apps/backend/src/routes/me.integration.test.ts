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
import { FamilyFactory } from '../test-support/factories/family.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserFamilyFactory } from '../test-support/factories/user-family.factory';

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
      expect(res.body.data.isSuperAdmin).toBe(true);
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
      expect(res.body.data.isSuperAdmin).toBe(false);
    });

    it('caregiver tier can retrieve their own profile', async () => {
      const res = await expectRoute('GET', '/v1/me').as(tiers.caregiver).toReturn(200);

      expect(res.body.data.id).toEqual(expect.any(String));
    });
  });

  describe('response content', () => {
    it('returns the correct profile fields for a known fixture user', async () => {
      const res = await expectRoute('GET', '/v1/me')
        .as({ id: baseFixture.districtAdmin.id, authId: baseFixture.districtAdmin.authId! })
        .toReturn(200);

      expect(res.body.data).toMatchObject({
        id: baseFixture.districtAdmin.id,
        userType: baseFixture.districtAdmin.userType,
        isSuperAdmin: false,
        nameFirst: baseFixture.districtAdmin.nameFirst,
        nameLast: baseFixture.districtAdmin.nameLast,
      });
    });

    it('includes unsignedAgreements array in the response', async () => {
      const res = await expectRoute('GET', '/v1/me')
        .as({ id: baseFixture.districtAdmin.id, authId: baseFixture.districtAdmin.authId! })
        .toReturn(200);

      expect(res.body.data).toHaveProperty('unsignedAgreements');
      expect(res.body.data.unsignedAgreements).toBeInstanceOf(Array);
    });

    it('returns an empty families array for an org-only user (no family membership)', async () => {
      const res = await expectRoute('GET', '/v1/me')
        .as({ id: baseFixture.districtAdmin.id, authId: baseFixture.districtAdmin.authId! })
        .toReturn(200);

      expect(res.body.data).toHaveProperty('families');
      expect(res.body.data.families).toEqual([]);
    });

    it("returns the caller's own family with role 'parent' for a seeded parent", async () => {
      const family = await FamilyFactory.create();
      const parent = await UserFactory.create({ nameLast: 'MeRouteParent' });
      await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });

      const res = await expectRoute('GET', '/v1/me').as({ id: parent.id, authId: parent.authId! }).toReturn(200);

      expect(res.body.data.id).toBe(parent.id);
      expect(res.body.data.families).toEqual([{ id: family.id, role: 'parent' }]);
    });

    it("returns the caller's own family with role 'child' for a seeded ROAR@Home child", async () => {
      const family = await FamilyFactory.create();
      const child = await UserFactory.create({ nameLast: 'MeRouteChild', dob: '2015-01-01', grade: '3' });
      await UserFamilyFactory.create({ userId: child.id, familyId: family.id, role: 'child' });

      const res = await expectRoute('GET', '/v1/me').as({ id: child.id, authId: child.authId! }).toReturn(200);

      expect(res.body.data.id).toBe(child.id);
      expect(res.body.data.families).toEqual([{ id: family.id, role: 'child' }]);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', '/v1/me').unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });
  });
});
