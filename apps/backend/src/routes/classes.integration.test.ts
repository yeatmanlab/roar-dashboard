/**
 * Route integration tests for /v1/classes endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization is tested by permission tier (resolved via OpenFGA):
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - siteAdmin:   site_administrator
 *   - admin:       administrator
 *   - educator:    teacher
 *   - student:     student
 *   - caregiver:   guardian
 *
 * Each endpoint section follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Access filtering — cross-district isolation, scoped visibility
 *   3. Error cases — 401, 404, 403 (no access to resource)
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
import { UserFactory } from '../test-support/factories/user.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { UserRole } from '../enums/user-role.enum';
import { UserType } from '../enums/user-type.enum';
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
  const { registerClassesRoutes } = await import('./classes');

  app = createTestApp(registerClassesRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);

  // Re-sync FGA tuples to pick up tier users created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/classes
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/classes', () => {
  const buildCreateClassBody = (overrides: Record<string, unknown> = {}) => ({
    schoolId: baseFixture.schoolA.id,
    name: 'Reading 101',
    classType: 'homeroom',
    ...overrides,
  });

  describe('authorization', () => {
    it('superAdmin tier can create a class under an active school and gets 201 with the new id', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(buildCreateClassBody({ name: 'SuperAdmin Class' }))
        .toReturn(StatusCodes.CREATED);

      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('siteAdmin tier is forbidden from creating classes', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.siteAdmin)
        .withBody(buildCreateClassBody({ name: 'SiteAdmin Class' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier is forbidden from creating classes', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.admin)
        .withBody(buildCreateClassBody({ name: 'Admin Class' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier is forbidden from creating classes', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.educator)
        .withBody(buildCreateClassBody({ name: 'Educator Class' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier is forbidden from creating classes', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.student)
        .withBody(buildCreateClassBody({ name: 'Student Class' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from creating classes', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.caregiver)
        .withBody(buildCreateClassBody({ name: 'Caregiver Class' }))
        .toReturn(StatusCodes.FORBIDDEN);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('persistence', () => {
    it('inserted row has schoolId, derived districtId, and orgPath copied from the parent school', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(buildCreateClassBody({ name: 'Persist 1' }))
        .toReturn(StatusCodes.CREATED);

      const id = res.body.data.id as string;

      const { CoreDbClient } = await import('../db/clients');
      const { classes, orgs } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      const [classRow] = await CoreDbClient.select().from(classes).where(eq(classes.id, id));
      expect(classRow).toBeDefined();
      expect(classRow!.schoolId).toBe(baseFixture.schoolA.id);
      // districtId is derived server-side from the school's parent
      expect(classRow!.districtId).toBe(baseFixture.district.id);

      // orgPath is copied verbatim from the parent school's path by the trigger
      const [schoolRow] = await CoreDbClient.select().from(orgs).where(eq(orgs.id, baseFixture.schoolA.id));
      expect(classRow!.orgPath).toBe(schoolRow!.path);
    });

    it('schoolLevels is computed by the generated column from grades', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(
          buildCreateClassBody({
            name: 'Persist 2',
            // grades 3 and 4 should yield schoolLevels containing 'elementary'
            grades: ['3', '4'],
          }),
        )
        .toReturn(StatusCodes.CREATED);

      const id = res.body.data.id as string;

      const { CoreDbClient } = await import('../db/clients');
      const { classes } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      const [row] = await CoreDbClient.select().from(classes).where(eq(classes.id, id));
      expect(row).toBeDefined();
      expect(row!.grades).toEqual(expect.arrayContaining(['3', '4']));
      // The exact mapping is implemented by app.get_school_levels_from_grades_array;
      // we just assert the column was populated, since the SQL function owns the rules.
      expect(row!.schoolLevels).toBeDefined();
      expect(Array.isArray(row!.schoolLevels)).toBe(true);
      expect((row!.schoolLevels ?? []).length).toBeGreaterThan(0);
    });

    it('forwards optional fields (number, period, subjects, location) to the insert', async () => {
      const body = buildCreateClassBody({
        name: 'Persist 3',
        number: '101A',
        period: '3',
        subjects: ['Reading', 'Phonics'],
        location: 'Room 12',
      });

      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(body)
        .toReturn(StatusCodes.CREATED);

      const id = res.body.data.id as string;

      const { CoreDbClient } = await import('../db/clients');
      const { classes } = await import('../db/schema');
      const { eq } = await import('drizzle-orm');

      const [row] = await CoreDbClient.select().from(classes).where(eq(classes.id, id));
      expect(row).toBeDefined();
      expect(row!.number).toBe('101A');
      expect(row!.period).toBe('3');
      expect(row!.subjects).toEqual(['Reading', 'Phonics']);
      expect(row!.location).toBe('Room 12');
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .unauthenticated()
        .withBody(buildCreateClassBody({ name: 'Unauth' }))
        .toReturn(StatusCodes.UNAUTHORIZED);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 422 when schoolId does not resolve to any row', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(
          buildCreateClassBody({
            name: 'NoParent',
            schoolId: '00000000-0000-4000-8000-000000000000',
          }),
        )
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_UNPROCESSABLE);
    });

    it('returns 422 when schoolId points at a district instead of a school', async () => {
      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(
          buildCreateClassBody({
            name: 'WrongType',
            schoolId: baseFixture.district.id,
          }),
        )
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_UNPROCESSABLE);
    });

    it('returns 422 when schoolId points at a school whose rostering ended in the past', async () => {
      const { OrgFactory } = await import('../test-support/factories/org.factory');
      const { OrgType } = await import('../enums/org-type.enum');

      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01T00:00:00.000Z'),
      });

      const res = await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(
          buildCreateClassBody({
            name: 'EndedParent',
            schoolId: endedSchool.id,
          }),
        )
        .toReturn(StatusCodes.UNPROCESSABLE_ENTITY);

      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_UNPROCESSABLE);
    });

    it('returns 400 when schoolId is missing', async () => {
      await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody({ name: 'No School', classType: 'homeroom' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when schoolId is not a UUID', async () => {
      await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(buildCreateClassBody({ name: 'Bad UUID', schoolId: 'not-a-uuid' }))
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when name is missing', async () => {
      await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody({ schoolId: baseFixture.schoolA.id, classType: 'homeroom' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when classType is missing', async () => {
      await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody({ schoolId: baseFixture.schoolA.id, name: 'No ClassType' })
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when classType is not in the enum', async () => {
      await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(buildCreateClassBody({ name: 'Bad ClassType', classType: 'not-a-type' }))
        .toReturn(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when grades contains a value outside the gradeEnum', async () => {
      await expectRoute('POST', '/v1/classes')
        .as(tiers.superAdmin)
        .withBody(buildCreateClassBody({ name: 'Bad Grade', grades: ['nope'] }))
        .toReturn(StatusCodes.BAD_REQUEST);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/classes/:classId/users
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/classes/:classId/users', () => {
  const classId = () => baseFixture.classInSchoolA.id;
  const path = () => `/v1/classes/${classId()}/users`;

  describe('authorization', () => {
    it('superAdmin tier can list all users in a class', async () => {
      const res = await expectRoute('GET', path()).as(tiers.superAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toBeDefined();

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // Super admin sees all active users in the class
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      // Expired enrollment should not be included
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('siteAdmin tier can list users in a class within their district', async () => {
      const res = await expectRoute('GET', path()).as(tiers.siteAdmin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('admin tier can list users in a class within their district', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      expect(res.body.data.items).toBeInstanceOf(Array);
      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('educator (teacher) at district level is forbidden from listing class users (teacher does not inherit to classes)', async () => {
      // Teacher role does NOT inherit via parent_org — a district-level teacher
      // has no teacher role on child schools or classes, so FGA does not grant
      // can_list_users on the class.
      const res = await expectRoute('GET', path()).as(tiers.educator).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('principal at school A can list users in class (school_admin_tier inherits school→class)', async () => {
      // Principal is rostered at schoolA. In the FGA model, principal inherits from
      // parent_org at the class level, so schoolAPrincipal has principal role on
      // classInSchoolA → supervisory_tier_group → can_list_users.
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toBeInstanceOf(Array);
      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
    });

    it('school-level teacher cannot list users in class (teacher does not inherit school→class)', async () => {
      // schoolATeacher is rostered at schoolA with teacher role. In the FGA model,
      // teacher does NOT have `from parent_org` at the class level, so the teacher
      // role does not cascade from school to class. The school-level teacher has no
      // role on classInSchoolA → no can_list_users.
      authenticateAs(baseFixture.schoolATeacher);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier is forbidden from listing users in classes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.student).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from listing users in classes', async () => {
      const res = await expectRoute('GET', path()).as(tiers.caregiver).toReturn(403);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('access filtering', () => {
    it('filters out users with expired enrollments', async () => {
      const res = await expectRoute('GET', path()).as(tiers.admin).toReturn(200);

      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      // expiredClassStudent has an expired enrollment and should not appear
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('returns 403 for user without access to class in different district', async () => {
      authenticateAs(baseFixture.districtAdmin);
      const res = await request(app)
        .get(`/v1/classes/${baseFixture.classInDistrictB.id}/users`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('teacher can list users in their assigned class', async () => {
      authenticateAs(baseFixture.classATeacher);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toBeInstanceOf(Array);
      const userIds = res.body.data.items.map((user: { id: string }) => user.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
    });

    it('teacher cannot list users in unassigned class in same school', async () => {
      // Create a new class in district A that the teacher is not assigned to
      const unassignedClass = await ClassFactory.create({
        name: 'Unassigned Class in District A',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });

      authenticateAs(baseFixture.classATeacher);
      const res = await request(app)
        .get(`/v1/classes/${unassignedClass.id}/users`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('district B admin cannot list users in class in district A school', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(`/v1/classes/${baseFixture.classInSchoolA.id}/users`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    describe('query parameters', () => {
      // Test class with multiple students of different grades and roles
      let filterTestClass: Awaited<ReturnType<typeof ClassFactory.create>>;

      beforeAll(async () => {
        // Create a dedicated class for filter tests
        filterTestClass = await ClassFactory.create({
          name: 'Filter Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });

        // Create users with specific grades and enroll them
        const usersToCreate = [
          { grade: '5' as const, role: UserRole.STUDENT },
          { grade: '5' as const, role: UserRole.STUDENT },
          { grade: '3' as const, role: UserRole.STUDENT },
          { grade: '7' as const, role: UserRole.STUDENT },
          { grade: null, role: UserRole.TEACHER },
        ];

        const createdUsers = await Promise.all(
          usersToCreate.map(({ grade }) =>
            UserFactory.create({ userType: grade ? UserType.STUDENT : UserType.EDUCATOR, grade }),
          ),
        );

        await Promise.all(
          createdUsers.map((user, i) =>
            UserClassFactory.create({ userId: user.id, classId: filterTestClass.id, role: usersToCreate[i]!.role }),
          ),
        );
      });

      const filterPath = () => `/v1/classes/${filterTestClass.id}/users`;

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
  });
});
