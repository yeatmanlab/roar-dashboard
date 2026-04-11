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
import { ClassFactory } from '../test-support/factories/class.factory';

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

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/schools/:schoolId/classes
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/schools/:schoolId/classes', () => {
  const schoolId = () => baseFixture.schoolA.id;
  const path = () => `/v1/schools/${schoolId()}/classes`;

  describe('authorization', () => {
    it('superAdmin tier can list all classes in the school', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('siteAdmin tier can list classes in the school', async () => {
      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);
    });

    it('admin tier can list classes in the school', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);
    });

    it('educator tier can list classes in the school', async () => {
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);
    });

    it('student tier is forbidden from listing classes (supervised role)', async () => {
      const res = await expectRoute('GET', path()).as(tiers.student).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing classes (supervised role)', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('response shape', () => {
    it('returns paginated response with class fields', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      expect(res.body.data.pagination).toMatchObject({
        page: 1,
        perPage: expect.any(Number),
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
      });

      const classItem = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.classInSchoolA.id);
      expect(classItem).toBeDefined();
      expect(classItem.name).toBe(baseFixture.classInSchoolA.name);
      // Dates should be ISO strings
      expect(typeof classItem.createdAt).toBe('string');
    });
  });

  describe('data isolation', () => {
    it('does not include classes from other schools', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // Should contain classInSchoolA but NOT classInSchoolB or classInDistrictB
      expect(ids).toContain(baseFixture.classInSchoolA.id);
      expect(ids).not.toContain(baseFixture.classInSchoolB.id);
      expect(ids).not.toContain(baseFixture.classInDistrictB.id);
    });

    it('excludes classes with rosteringEnded set', async () => {
      // Create a class with rosteringEnded in the same school
      const endedClass = await ClassFactory.create({
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
        name: 'Ended Class',
        rosteringEnded: new Date('2024-01-01'),
      });

      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).not.toContain(endedClass.id);
    });
  });

  describe('filtering', () => {
    it('filters classes by grade using the array contains operator', async () => {
      // Create a class with a known grade
      await ClassFactory.create({
        name: 'Grade 3 Math',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
        grades: ['3'],
      });

      const res = await expectRoute('GET', `${path()}?filter=grade:eq:3`).as(tiers.superAdmin).toReturn(200);

      // Should only return the class with grade 3
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const names = res.body.data.items.map((item: { name: string }) => item.name);
      expect(names).toContain('Grade 3 Math');

      // The base fixture class has grades: null, so it should be excluded
      expect(names).not.toContain(baseFixture.classInSchoolA.name);
    });

    it('filters classes by classType', async () => {
      // Create a class with a specific classType
      await ClassFactory.create({
        name: 'Scheduled Science',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
        classType: 'scheduled',
      });

      const res = await expectRoute('GET', `${path()}?filter=classType:eq:scheduled`)
        .as(tiers.superAdmin)
        .toReturn(200);

      // Should only return scheduled classes
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const items = res.body.data.items as { name: string; classType: string }[];
      for (const item of items) {
        expect(item.classType).toBe('scheduled');
      }
      expect(items.map((i) => i.name)).toContain('Scheduled Science');
    });

    it('returns empty results when filter matches no classes', async () => {
      // Filter by a grade that no class in this school has
      const res = await expectRoute('GET', `${path()}?filter=grade:eq:13`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', path()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 for a non-existent school', async () => {
      const res = await expectRoute('GET', '/v1/schools/00000000-0000-0000-0000-000000000000/classes')
        .as(tiers.admin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when user lacks access to the school', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });
});
