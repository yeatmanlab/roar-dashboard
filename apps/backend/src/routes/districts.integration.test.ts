/**
 * Route integration tests for /v1/districts endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 * Authorization is resolved via FGA (seeded from Postgres fixtures).
 *
 * Authorization is tested by permission tier:
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - siteAdmin:   site_administrator (supervisory → can_list)
 *   - admin:       administrator (supervisory → can_list)
 *   - educator:    teacher (supervisory → can_list)
 *   - student:     student (not supervisory → no can_list → empty results)
 *   - caregiver:   guardian (not supervisory → no can_list → empty results)
 *
 * Each endpoint section follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Error cases — 401 unauthenticated
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { authenticateAs, createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
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
  const { registerDistrictsRoutes } = await import('./districts');

  app = createTestApp(registerDistrictsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);

  // Re-sync FGA tuples to pick up tier users created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/districts
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/districts', () => {
  describe('authorization', () => {
    it('superAdmin tier can list all districts across org trees', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // Super admin sees districts from ALL org trees
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).toContain(baseFixture.districtB.id);
    });

    it('siteAdmin tier can list districts scoped to their org tree', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.siteAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).not.toContain(baseFixture.districtB.id);
    });

    it('admin tier can list districts scoped to their org tree', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.admin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).not.toContain(baseFixture.districtB.id);
    });

    it('educator tier can list districts scoped to their org tree', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.educator).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).not.toContain(baseFixture.districtB.id);
    });

    it('student tier sees empty list (not in supervisory_tier_group → no can_list)', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.student).toReturn(200);

      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });

    it('caregiver tier sees empty list (not in supervisory_tier_group → no can_list)', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.caregiver).toReturn(200);

      // Caregivers (guardians) are not in supervisory_tier_group, so FGA
      // does not grant can_list on districts
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });
  });

  describe('embed: counts', () => {
    it('includes user, school, and class counts when embed=counts', async () => {
      const res = await expectRoute('GET', '/v1/districts?embed=counts').as(tiers.admin).toReturn(200);

      const district = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.district.id);
      expect(district).toBeDefined();
      expect(district.counts).toMatchObject({
        users: expect.any(Number),
        schools: expect.any(Number),
        classes: expect.any(Number),
      });
    });

    it('omits counts when embed is not requested', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.admin).toReturn(200);

      const district = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.district.id);
      expect(district).toBeDefined();
      expect(district.counts).toBeUndefined();
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', '/v1/districts').unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns empty list for an unassigned user', async () => {
      authenticateAs(baseFixture.unassignedUser);
      const res = await request(app).get('/v1/districts').set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });
  });
});
