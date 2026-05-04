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
  const { registerSchoolsRoutes } = await import('./schools');

  app = createTestApp(registerSchoolsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);

  // Re-sync FGA tuples to pick up tier users created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/schools
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/schools', () => {
  const buildCreateSchoolBody = (overrides: Record<string, unknown> = {}) => ({
    districtId: baseFixture.district.id,
    name: 'Springfield Elementary',
    abbreviation: 'SPFD',
    ...overrides,
  });

  describe('authorization', () => {
    it('superAdmin tier can create a school under an active district and gets 201 with the new id', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(buildCreateSchoolBody({ abbreviation: 'SUPER1' }))
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('siteAdmin tier is forbidden from creating schools', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.siteAdmin)
        .withBody(buildCreateSchoolBody({ abbreviation: 'SITE1' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier is forbidden from creating schools', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.admin)
        .withBody(buildCreateSchoolBody({ abbreviation: 'ADMIN1' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier is forbidden from creating schools', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.educator)
        .withBody(buildCreateSchoolBody({ abbreviation: 'EDU1' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier is forbidden from creating schools', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.student)
        .withBody(buildCreateSchoolBody({ abbreviation: 'STU1' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from creating schools', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.caregiver)
        .withBody(buildCreateSchoolBody({ abbreviation: 'CARE1' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('persistence', () => {
    it('inserted row has orgType=school, parentOrgId=districtId, isRosteringRootOrg=false, and a path that extends the parent district path', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(buildCreateSchoolBody({ abbreviation: 'PERSIST1' }))
        .toReturn(StatusCodes.CREATED);

      const id = res.body.data.id as string;

      const { CoreDbClient } = await import('../db/clients');
      const { orgs } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      const [row] = await CoreDbClient.select().from(orgs).where(eq(orgs.id, id));
      expect(row).toBeDefined();
      expect(row!.orgType).toBe(OrgType.SCHOOL);
      expect(row!.parentOrgId).toBe(baseFixture.district.id);
      expect(row!.isRosteringRootOrg).toBe(false);
      // Trigger appends `school_<id-with-hyphens-as-underscores>` to the
      // parent district's path.
      expect(row!.path).toBe(`${baseFixture.district.path}.school_${id.replace(/-/g, '_')}`);
    });

    it('forwards optional location and identifier fields to the column-shaped insert', async () => {
      const body = buildCreateSchoolBody({
        abbreviation: 'PERSIST2',
        location: {
          addressLine1: '742 Evergreen Terrace',
          city: 'Springfield',
          stateProvince: 'IL',
          postalCode: '62701',
          country: 'US',
        },
        identifiers: {
          ncesId: 'NCES-S-9001',
          stateId: 'IL-S-9001',
          schoolNumber: 'SCH-001',
        },
      });

      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(body)
        .toReturn(StatusCodes.CREATED);

      const id = res.body.data.id as string;

      const { CoreDbClient } = await import('../db/clients');
      const { orgs } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      const [row] = await CoreDbClient.select().from(orgs).where(eq(orgs.id, id));
      expect(row).toBeDefined();
      expect(row!.locationAddressLine1).toBe('742 Evergreen Terrace');
      expect(row!.locationCity).toBe('Springfield');
      expect(row!.locationStateProvince).toBe('IL');
      expect(row!.locationPostalCode).toBe('62701');
      expect(row!.locationCountry).toBe('US');
      expect(row!.ncesId).toBe('NCES-S-9001');
      expect(row!.stateId).toBe('IL-S-9001');
      expect(row!.schoolNumber).toBe('SCH-001');
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .unauthenticated()
        .withBody(buildCreateSchoolBody({ abbreviation: 'UNAUTH' }))
        .toReturn(StatusCodes.UNAUTHORIZED);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 422 when districtId does not resolve to any row', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(
          buildCreateSchoolBody({
            abbreviation: 'NOPARENT',
            districtId: '00000000-0000-4000-8000-000000000000',
          }),
        )
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_UNPROCESSABLE);
    });

    it('returns 422 when districtId points at a school instead of a district', async () => {
      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(
          buildCreateSchoolBody({
            abbreviation: 'WRONGTYPE',
            districtId: baseFixture.schoolA.id,
          }),
        )
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_UNPROCESSABLE);
    });

    it('returns 422 when districtId points at a district whose rostering ended in the past', async () => {
      const endedDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        rosteringEnded: new Date('2020-01-01T00:00:00.000Z'),
      });

      const res = await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(
          buildCreateSchoolBody({
            abbreviation: 'ENDED',
            districtId: endedDistrict.id,
          }),
        )
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_UNPROCESSABLE);
    });

    it('returns 400 when districtId is missing', async () => {
      await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody({ name: 'No District USD', abbreviation: 'NODIST' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when districtId is not a UUID', async () => {
      await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(buildCreateSchoolBody({ abbreviation: 'BADID', districtId: 'not-a-uuid' }))
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when name is missing', async () => {
      await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody({ districtId: baseFixture.district.id, abbreviation: 'BAD1' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when abbreviation is missing', async () => {
      await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody({ districtId: baseFixture.district.id, name: 'No Abbreviation Elementary' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when abbreviation exceeds 10 characters', async () => {
      await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(buildCreateSchoolBody({ abbreviation: 'TOOLONGABBR1' }))
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when abbreviation contains non-alphanumeric characters', async () => {
      await expectRoute('POST', '/v1/schools')
        .as(tiers.superAdmin)
        .withBody(buildCreateSchoolBody({ abbreviation: 'SCH-001' }))
        .toReturn(StatusCodes.BAD_REQUEST);
    });
  });
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

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/schools/:schoolId/users
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/schools/:schoolId/users', () => {
  const schoolUsersPath = () => `/v1/schools/${baseFixture.schoolA.id}/users`;

  describe('authorization', () => {
    it('superAdmin tier can list users in a school', async () => {
      const res = await expectRoute('GET', schoolUsersPath()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // Super admin sees users in the school
      expect(userIds).toContain(baseFixture.schoolAAdmin.id);
    });

    it('user with supervisory role directly assigned to school can list users', async () => {
      // schoolAAdmin is assigned directly to the school with administrator role
      const res = await expectRoute('GET', schoolUsersPath())
        .as({ id: baseFixture.schoolAAdmin.id, authId: baseFixture.schoolAAdmin.authId! })
        .toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('principal at school A can list users in their school', async () => {
      const res = await expectRoute('GET', schoolUsersPath())
        .as({ id: baseFixture.schoolAPrincipal.id, authId: baseFixture.schoolAPrincipal.authId! })
        .toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('user with supervisory role at district level can list users in child school', async () => {
      // districtAdmin has administrator role at district level, which inherits to schools
      const res = await expectRoute('GET', schoolUsersPath())
        .as({ id: baseFixture.districtAdmin.id, authId: baseFixture.districtAdmin.authId! })
        .toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('teacher role (educator_tier) does not have can_list_users on school', async () => {
      // schoolATeacher can read the school (getById succeeds)
      const readRes = await expectRoute('GET', `/v1/schools/${baseFixture.schoolA.id}`)
        .as({ id: baseFixture.schoolATeacher.id, authId: baseFixture.schoolATeacher.authId! })
        .toReturn(200);
      expect(readRes.status).toBe(200);

      // But cannot list users (no school-level can_list_users permission)
      const listRes = await expectRoute('GET', schoolUsersPath())
        .as({ id: baseFixture.schoolATeacher.id, authId: baseFixture.schoolATeacher.authId! })
        .toReturn(403);

      expect(listRes.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier is forbidden from listing users in schools', async () => {
      // Students lack can_list_users on the school — FGA requirePermission throws 403
      const res = await expectRoute('GET', schoolUsersPath()).as(tiers.student).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing users in schools', async () => {
      // Caregivers lack can_list_users on the school — FGA requirePermission throws 403
      const res = await expectRoute('GET', schoolUsersPath()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('response shape', () => {
    it('returns users with expected fields', async () => {
      const res = await expectRoute('GET', schoolUsersPath()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items.length).toBeGreaterThan(0);
      const user = res.body.data.items[0];

      // Verify user object has expected fields
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('roles');
    });

    it('returns pagination metadata', async () => {
      const res = await expectRoute('GET', schoolUsersPath()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.pagination).toMatchObject({
        page: expect.any(Number),
        perPage: expect.any(Number),
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });
  });

  describe('query parameters', () => {
    // Test school with multiple users of different grades and roles
    let filterTestSchool: Awaited<ReturnType<typeof OrgFactory.create>>;

    beforeAll(async () => {
      // Create a dedicated school for filter tests
      filterTestSchool = await OrgFactory.create({
        name: 'Filter Test School',
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
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
          UserOrgFactory.create({ userId: user.id, orgId: filterTestSchool.id, role: usersToCreate[i]!.role }),
        ),
      );
    });

    const filterPath = () => `/v1/schools/${filterTestSchool.id}/users`;

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
      const res = await expectRoute('GET', schoolUsersPath()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when school does not exist', async () => {
      const res = await expectRoute('GET', '/v1/schools/00000000-0000-0000-0000-000000000000/users')
        .as(tiers.superAdmin)
        .toReturn(404);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 403 when user does not have access to school', async () => {
      // User from district A trying to access school in district B
      const res = await expectRoute('GET', `/v1/schools/${baseFixture.schoolInDistrictB.id}/users`)
        .as(tiers.admin)
        .toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });
});
