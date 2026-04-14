/**
 * Route integration tests for /v1/schools endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization is tested by permission tier (resolved via OpenFGA):
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - siteAdmin:   site_administrator (can_list on school via supervisory_tier_group)
 *   - admin:       administrator (can_list on school via supervisory_tier_group)
 *   - educator:    teacher (can_list on school via supervisory_tier_group)
 *   - student:     student (no can_list on school → empty results)
 *   - caregiver:   guardian (no can_list on school → empty results)
 *
 * Each endpoint section generally follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Error cases where applicable — e.g. 401 unauthenticated, 403 forbidden, 404 not found.
 *      For GET /v1/schools specifically, unauthorized roles receive 200 with an
 *      empty result set rather than 403/404 (FGA returns no accessible objects).
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

  // Re-sync FGA tuples to pick up tier users created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
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

    it('educator (teacher) at district level sees empty list (teacher does not inherit to schools)', async () => {
      // Teacher role does NOT inherit via parent_org — a district-level teacher
      // has no teacher role on child schools, so FGA does not grant can_list.
      const res = await expectRoute('GET', '/v1/schools').as(tiers.educator).toReturn(200);

      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });

    it('principal at school A can list their school (school_admin_tier has can_list)', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app).get('/v1/schools').set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      // Principal at schoolA sees schoolA (they have supervisory_tier_group → can_list)
      expect(ids).toContain(baseFixture.schoolA.id);
      // But NOT schools in other districts or sibling schools they're not rostered at
      expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
    });

    it('school-level teacher can list their school (educator_tier has can_list on directly rostered school)', async () => {
      // schoolATeacher is rostered at schoolA with teacher role — teacher is in
      // supervisory_tier_group at school level, so FGA grants can_list.
      authenticateAs(baseFixture.schoolATeacher);
      const res = await request(app).get('/v1/schools').set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).not.toContain(baseFixture.schoolB.id);
    });

    it('student tier sees empty list (no can_list on school)', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.student).toReturn(200);

      // Students are not in supervisory_tier_group → no can_list on school
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });

    it('caregiver tier sees empty list (no can_list on school)', async () => {
      const res = await expectRoute('GET', '/v1/schools').as(tiers.caregiver).toReturn(200);

      // Caregivers (guardians) are not in supervisory_tier_group → no can_list on school
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

    it('educator (teacher) at district level is forbidden from listing classes (teacher does not inherit to schools)', async () => {
      // Teacher role does NOT inherit via parent_org — a district-level teacher
      // has no teacher role on child schools, so FGA does not grant can_list_classes.
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('principal at school A can list classes in their school (school_admin_tier inherits school→class)', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);
    });

    it('school-level teacher can list classes in their school (educator_tier has can_list_classes on rostered school)', async () => {
      // schoolATeacher has teacher role at schoolA — teacher is in supervisory_tier_group,
      // and school's can_list_classes = supervisory_tier_group.
      authenticateAs(baseFixture.schoolATeacher);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const ids = res.body.data.items.map((item: { id: string }) => item.id);
      expect(ids).toContain(baseFixture.classInSchoolA.id);
    });

    it('principal at school A cannot list classes in school B (cross-school isolation)', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(`/v1/schools/${baseFixture.schoolB.id}/classes`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
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
