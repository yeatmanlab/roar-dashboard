/**
 * Route integration tests for /v1/districts endpoints.
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
import { OrgFactory } from '../test-support/factories/org.factory';
import { OrgType } from '../enums/org-type.enum';

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

    it('student tier sees empty list (no Organizations.LIST permission)', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.student).toReturn(200);

      // Students don't have Organizations.LIST permission, so allowedRoles
      // won't match their student role — the access control query returns nothing
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });

    it('caregiver tier can list districts scoped to their org tree', async () => {
      const res = await expectRoute('GET', '/v1/districts').as(tiers.caregiver).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).not.toContain(baseFixture.districtB.id);
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

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/districts/:districtId/schools
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/districts/:districtId/schools', () => {
  const districtSchoolsUrl = `/v1/districts/${baseFixture.district.id}/schools`;

  describe('authorization', () => {
    it('superAdmin tier can list schools in district', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
      // Should not include schools from other districts
      expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
    });

    it('siteAdmin tier can list schools in their district', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.siteAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
    });

    it('admin tier can list schools in their district', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.admin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
    });

    it('educator tier can list schools in their district', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.educator).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
    });

    it('student tier is forbidden from listing schools (supervised role)', async () => {
      await expectRoute('GET', districtSchoolsUrl).as(tiers.student).toReturn(403);
    });

    it('caregiver tier is forbidden from listing schools (supervised role)', async () => {
      await expectRoute('GET', districtSchoolsUrl).as(tiers.caregiver).toReturn(403);
    });
  });

  describe('response shape', () => {
    it('returns schools with correct pagination structure', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.pagination).toMatchObject({
        page: 1,
        perPage: expect.any(Number),
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
      });

      // Verify school item shape
      const school = res.body.data.items[0];
      expect(school).toHaveProperty('id');
      expect(school).toHaveProperty('name');
      expect(school).toHaveProperty('orgType');
      expect(school).toHaveProperty('createdAt');
      expect(school).toHaveProperty('updatedAt');
    });
  });

  describe('data isolation', () => {
    it('does not return schools from other districts', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
    });

    it('does not return ended schools by default', async () => {
      // Create a school with rosteringEnded set in the past
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(endedSchool.id);
    });

    it('returns ended schools when includeEnded=true', async () => {
      const res = await expectRoute('GET', `${districtSchoolsUrl}?includeEnded=true`)
        .as(tiers.superAdmin)
        .toReturn(200);

      // Should have more items than without includeEnded (ended school from previous test)
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when district does not exist', async () => {
      const fakeDistrictId = '00000000-0000-0000-0000-000000000000';
      await expectRoute('GET', `/v1/districts/${fakeDistrictId}/schools`).as(tiers.superAdmin).toReturn(404);
    });

    it('returns 403 when user lacks access to the district', async () => {
      // Use districtB — tier users are only assigned to district (A)
      const crossDistrictUrl = `/v1/districts/${baseFixture.districtB.id}/schools`;
      await expectRoute('GET', crossDistrictUrl).as(tiers.admin).toReturn(403);
    });
  });
});
