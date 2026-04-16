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
import { OrgFactory } from '../test-support/factories/org.factory';
import { OrgType } from '../enums/org-type.enum';
import { UserRole } from '../enums/user-role.enum';
import { UserType } from '../enums/user-type.enum';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import type { EnrolledUser } from '@roar-dashboard/api-contract';

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

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/districts/:districtId/schools
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/districts/:districtId/schools', () => {
  let districtSchoolsUrl: string;

  beforeAll(() => {
    districtSchoolsUrl = `/v1/districts/${baseFixture.district.id}/schools`;
  });

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
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.student).toReturn(403);
      expect(res.body.error).toBeDefined();
    });

    it('caregiver tier is forbidden from listing schools (supervised role)', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.caregiver).toReturn(403);
      expect(res.body.error).toBeDefined();
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

      // Verify school item shape matches SchoolDetailSchema
      const school = res.body.data.items[0];
      expect(school).toHaveProperty('id');
      expect(school).toHaveProperty('name');
      expect(school).toHaveProperty('abbreviation');
      expect(school).toHaveProperty('orgType', 'school');
      expect(school).toHaveProperty('parentOrgId');
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

  describe('embed: counts', () => {
    it('includes user and class counts when embed=counts', async () => {
      const res = await expectRoute('GET', `${districtSchoolsUrl}?embed=counts`).as(tiers.admin).toReturn(200);

      const school = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school.counts).toMatchObject({
        users: expect.any(Number),
        classes: expect.any(Number),
      });
    });

    it('includes counts for super admin path (listAllByDistrictId)', async () => {
      const res = await expectRoute('GET', `${districtSchoolsUrl}?embed=counts`).as(tiers.superAdmin).toReturn(200);

      const school = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school.counts).toMatchObject({
        users: expect.any(Number),
        classes: expect.any(Number),
      });
    });

    it('omits counts when embed is not requested', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).as(tiers.admin).toReturn(200);

      const school = res.body.data.items.find((item: { id: string }) => item.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school.counts).toBeUndefined();
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', districtSchoolsUrl).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when district does not exist', async () => {
      const fakeDistrictId = '00000000-0000-0000-0000-000000000000';
      const res = await expectRoute('GET', `/v1/districts/${fakeDistrictId}/schools`)
        .as(tiers.superAdmin)
        .toReturn(404);
      expect(res.body.error).toBeDefined();
    });

    it('returns 403 when user lacks access to the district', async () => {
      // Use districtB — tier users are only assigned to district (A)
      const crossDistrictUrl = `/v1/districts/${baseFixture.districtB.id}/schools`;
      const res = await expectRoute('GET', crossDistrictUrl).as(tiers.admin).toReturn(403);
      expect(res.body.error).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/districts/:districtId/users
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/districts/:districtId/users', () => {
  const districtUsersPath = () => `/v1/districts/${baseFixture.district.id}/users`;

  describe('authorization', () => {
    it('superAdmin tier can list users in a district', async () => {
      const res = await expectRoute('GET', districtUsersPath()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // Super admin sees users in the district
      expect(userIds).toContain(baseFixture.districtAdmin.id);
    });

    it('user with supervisory role directly assigned to district can list users', async () => {
      // districtAdmin is assigned directly to the district with administrator role
      const res = await expectRoute('GET', districtUsersPath())
        .as({ id: baseFixture.districtAdmin.id, authId: baseFixture.districtAdmin.authId! })
        .toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('user with supervisory role at school level can read district but cannot list users', async () => {
      // schoolAAdmin can read the district (getById succeeds)
      const readRes = await expectRoute('GET', `/v1/districts/${baseFixture.district.id}`)
        .as({ id: baseFixture.schoolAAdmin.id, authId: baseFixture.schoolAAdmin.authId! })
        .toReturn(200);
      expect(readRes.status).toBe(200);

      // But cannot list users (no district-level supervisory role)
      const listRes = await expectRoute('GET', districtUsersPath())
        .as({ id: baseFixture.schoolAAdmin.id, authId: baseFixture.schoolAAdmin.authId! })
        .toReturn(403);

      expect(listRes.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator at school level can read district but cannot list users', async () => {
      // schoolATeacher can read the district (getById succeeds)
      const readRes = await expectRoute('GET', `/v1/districts/${baseFixture.district.id}`)
        .as({ id: baseFixture.schoolATeacher.id, authId: baseFixture.schoolATeacher.authId! })
        .toReturn(200);
      expect(readRes.status).toBe(200);

      // But cannot list users (no district-level supervisory role)
      const listRes = await expectRoute('GET', districtUsersPath())
        .as({ id: baseFixture.schoolATeacher.id, authId: baseFixture.schoolATeacher.authId! })
        .toReturn(403);

      expect(listRes.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier is forbidden from listing users in districts', async () => {
      // Students don't have Organizations.READ permission, so getById returns 404
      const res = await expectRoute('GET', districtUsersPath()).as(tiers.student).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing users in districts', async () => {
      // Caregivers have Organizations.READ but not supervisory role
      // getById succeeds but authorizeSubResourceAccess throws 403
      const res = await expectRoute('GET', districtUsersPath()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('response shape', () => {
    it('returns users with expected fields', async () => {
      const res = await expectRoute('GET', districtUsersPath()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const user = res.body.data.items[0];

      // Verify user object has expected fields
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('roles');
    });

    it('returns pagination metadata', async () => {
      const res = await expectRoute('GET', districtUsersPath()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.pagination).toMatchObject({
        page: expect.any(Number),
        perPage: expect.any(Number),
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });
  });

  describe('query parameters', () => {
    // Test district with multiple users of different grades and roles
    let filterTestDistrict: Awaited<ReturnType<typeof OrgFactory.create>>;

    beforeAll(async () => {
      // Create a dedicated district for filter tests
      filterTestDistrict = await OrgFactory.create({
        name: 'Filter Test District',
        orgType: OrgType.DISTRICT,
      });

      // Create users with specific grades and enroll them
      const usersToCreate = [
        { grade: '5' as const, role: UserRole.STUDENT },
        { grade: '5' as const, role: UserRole.STUDENT },
        { grade: '3' as const, role: UserRole.STUDENT },
        { grade: '7' as const, role: UserRole.STUDENT },
        { grade: null, role: UserRole.ADMINISTRATOR },
      ];

      const createdUsers = await Promise.all(
        usersToCreate.map(({ grade }) =>
          UserFactory.create({ userType: grade ? UserType.STUDENT : UserType.ADMIN, grade }),
        ),
      );

      await Promise.all(
        createdUsers.map((user, i) =>
          UserOrgFactory.create({ userId: user.id, orgId: filterTestDistrict.id, role: usersToCreate[i]!.role }),
        ),
      );
    });

    const filterPath = () => `/v1/districts/${filterTestDistrict.id}/users`;

    it('filters users by role parameter', async () => {
      const res = await expectRoute('GET', `${filterPath()}?role=student`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledUser) => {
        expect(user.roles).toContain('student');
      });
    });

    it('filters users by single grade parameter', async () => {
      const res = await expectRoute('GET', `${filterPath()}?grade=5`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledUser) => {
        expect(user.grade).toBe('5');
      });
    });

    it('filters users by multiple grades with comma-separated values', async () => {
      const res = await expectRoute('GET', `${filterPath()}?grade=3,7`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledUser) => {
        expect(['3', '7']).toContain(user.grade);
      });
    });

    it('combines role and grade filters', async () => {
      const res = await expectRoute('GET', `${filterPath()}?role=student&grade=5`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((user: EnrolledUser) => {
        expect(user.roles).toContain('student');
        expect(user.grade).toBe('5');
      });
    });

    it('returns empty array when no users match filter', async () => {
      const res = await expectRoute('GET', `${filterPath()}?grade=12`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('supports pagination with page and perPage parameters', async () => {
      const res = await expectRoute('GET', `${filterPath()}?page=1&perPage=2`).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.perPage).toBe(2);
      expect(res.body.data.pagination.totalItems).toBeGreaterThan(0);
      expect(res.body.data.pagination.totalPages).toBeGreaterThan(0);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', districtUsersPath()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when district does not exist', async () => {
      const res = await expectRoute('GET', '/v1/districts/00000000-0000-0000-0000-000000000000/users')
        .as(tiers.superAdmin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when user does not have access to district', async () => {
      // User from district A trying to access district B
      const res = await expectRoute('GET', `/v1/districts/${baseFixture.districtB.id}/users`)
        .as(tiers.admin)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });
});
