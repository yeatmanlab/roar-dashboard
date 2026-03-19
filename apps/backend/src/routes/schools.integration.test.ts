/**
 * Route integration tests for /v1/schools endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization is tested by permission tier (matching RolePermissions groupings):
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - siteAdmin:   site_administrator
 *   - admin:       administrator
 *   - educator:    teacher
 *   - student:     student (no Organizations.LIST permission → empty results)
 *   - caregiver:   guardian
 *
 * Each endpoint section generally follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Error cases where applicable — e.g. 401 unauthenticated, 403 forbidden, 404 not found.
 *      For GET /v1/schools specifically, unauthorized roles receive 200 with an
 *      empty result set rather than 403/404 (access control via INNER JOIN).
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
  const { registerSchoolsRoutes } = await import('./schools');

  app = createTestApp(registerSchoolsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/schools
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/schools', () => {
  describe('authorization', () => {
    it('superAdmin tier can list all schools across org trees', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // Super admin sees schools from ALL org trees
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
      expect(ids).toContain(baseFixture.schoolInDistrictB.id);
    });

    it('siteAdmin tier can list schools scoped to their org tree', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.siteAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // siteAdmin at district level sees both schoolA and schoolB (same district)
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
      // But NOT schools from other districts
      expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
    });

    it('admin tier can list schools scoped to their org tree', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.admin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // admin at district level sees both schoolA and schoolB (same district)
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
      // But NOT schools from other districts
      expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
    });

    it('educator tier can list schools scoped to their org tree', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.educator).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // educator at district level sees both schoolA and schoolB (same district)
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
      // But NOT schools from other districts
      expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
    });

    it('student tier sees empty list (no Organizations.LIST permission)', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.student).toReturn(200);

      // Students don't have Organizations.LIST permission, so allowedRoles
      // won't match their student role — the access control query returns nothing
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });

    it('caregiver tier sees empty list (no Organizations.LIST permission)', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.caregiver).toReturn(200);

      // Caregivers (guardians) don't have Organizations.LIST permission
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });
  });

  describe('embed: counts', () => {
    it('includes user and class counts when embed=counts', async () => {
      const res = await expectRoute('GET', '/v1/schools?embed=counts').as(tiers.admin).toReturn(200);

      const school = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school.counts).toMatchObject({
        users: expect.any(Number),
        classes: expect.any(Number),
      });
      // Schools should NOT have schools count (only districts do)
      expect(school.counts).not.toHaveProperty('schools');
    });

    it('omits counts when embed is not requested', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.admin).toReturn(200);

      const school = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school.counts).toBeUndefined();
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', '/v1/schools').unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns empty list for an unassigned user', async () => {
      authenticateAs(baseFixture.unassignedUser);
      const res = await request(app).get('/v1/schools').set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });
  });
});
