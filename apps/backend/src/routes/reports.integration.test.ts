/**
 * Route integration tests for /v1/administrations/:id/reports endpoints.
 *
 * Tests the full HTTP lifecycle: middleware -> controller -> service -> repository -> DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Note: FDW runs table is a foreign table to a separate database and won't have data
 * in integration tests. Run-related fields will show "assigned" status for all tasks.
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

/** Builds the progress students endpoint path for the given administration. */
function progressStudentsPath(administrationId: string) {
  return `/v1/administrations/${administrationId}/reports/progress/students`;
}

/** Default query params for a valid request. */
function defaultQuery() {
  return {
    scopeType: 'district',
    scopeId: baseFixture.district.id,
    page: 1,
    perPage: 25,
  };
}

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerReportsRoutes } = await import('./reports');

  app = createTestApp(registerReportsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/reports/progress/students
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/reports/progress/students', () => {
  describe('authorization', () => {
    it('returns 401 without auth', async () => {
      const res = await expectRoute('GET', progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .unauthenticated()
        .toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('super admin can access', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('admin (administrator role) at district can access', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('site admin (site_administrator role) at district can access', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('educator (teacher role) at district can access', async () => {
      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('student tier returns 403', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier returns 403 (has report permission but not supervisory)', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 when class teacher requests school scope', async () => {
      // classATeacher has a teacher role on classInSchoolA but not on schoolA itself.
      // Requesting school scope should fail because the ltree ancestor query finds
      // no role at or above the school level.
      authenticateAs(baseFixture.classATeacher);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
          page: 1,
          perPage: 25,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 for admin in a different district', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
          page: 1,
          perPage: 25,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('scope validation', () => {
    it('returns 400 for scope not assigned to administration', async () => {
      // schoolB is not assigned to administrationAssignedToSchoolA
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolB.id,
          page: 1,
          perPage: 25,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
    });

    it('returns 400 when scopeType is missing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ scopeId: baseFixture.district.id, page: 1, perPage: 25 })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when scopeId is missing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ scopeType: 'district', page: 1, perPage: 25 })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 for non-existent administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath('00000000-0000-0000-0000-000000000000'))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });

  describe('response shape', () => {
    it('returns 200 with correct response structure', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;

      // Top-level structure
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('pagination');

      // Tasks array — verified by shape, not hardcoded count (fixture may evolve)
      expect(data.tasks).toBeInstanceOf(Array);
      expect(data.tasks.length).toBeGreaterThan(0);

      // Verify task metadata shape
      const firstTask = data.tasks[0];
      expect(firstTask).toHaveProperty('taskId');
      expect(firstTask).toHaveProperty('taskSlug');
      expect(firstTask).toHaveProperty('taskName');
      expect(firstTask).toHaveProperty('orderIndex');

      // Collect known task IDs from the response for progress verification
      const taskIdsFromResponse = new Set(data.tasks.map((t: { taskId: string }) => t.taskId));

      // Items array — student progress rows
      expect(data.items).toBeInstanceOf(Array);
      expect(data.items.length).toBeGreaterThan(0);

      // Verify student row shape on any student
      const firstStudent = data.items[0];
      expect(firstStudent).toHaveProperty('user');
      expect(firstStudent.user).toHaveProperty('userId');
      expect(firstStudent.user).toHaveProperty('username');
      expect(firstStudent.user).toHaveProperty('email');
      expect(firstStudent.user).toHaveProperty('firstName');
      expect(firstStudent.user).toHaveProperty('lastName');
      expect(firstStudent.user).toHaveProperty('grade');

      // District scope — schoolName should be populated for students with school enrollment.
      // Find schoolAStudent specifically since they're enrolled at the org level and
      // guaranteed to have a school name. The first student in sort order may not.
      const schoolAStudentRow = data.items.find(
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.schoolAStudent.id,
      );
      expect(schoolAStudentRow).toBeDefined();
      expect(schoolAStudentRow.user.schoolName).toBeTruthy();

      // Progress map — keyed by taskId with status entries.
      // Every progress key should be a taskId from the tasks array.
      // The count of entries per student depends on condition evaluation
      // (downstream branches may filter by conditionsAssignment).
      expect(firstStudent).toHaveProperty('progress');
      expect(typeof firstStudent.progress).toBe('object');

      const progressKeys = Object.keys(firstStudent.progress);
      expect(progressKeys.length).toBeGreaterThan(0);
      for (const key of progressKeys) {
        expect(taskIdsFromResponse).toContain(key);
      }

      // Verify progress entry shape
      for (const entry of Object.values(firstStudent.progress) as {
        status: string;
        startedAt: unknown;
        completedAt: unknown;
      }[]) {
        expect(entry).toHaveProperty('status');
        expect(['assigned', 'started', 'completed', 'optional']).toContain(entry.status);
        expect(entry).toHaveProperty('startedAt');
        expect(entry).toHaveProperty('completedAt');
      }

      // Pagination
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('perPage');
      expect(data.pagination).toHaveProperty('totalItems');
      expect(data.pagination).toHaveProperty('totalPages');
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.perPage).toBe(25);
      expect(data.pagination.totalItems).toBeGreaterThan(0);
    });

    it('respects pagination parameters', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ ...defaultQuery(), perPage: 2, page: 1 })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.perPage).toBe(2);
      // totalItems reflects full count; items is capped by perPage
      expect(res.body.data.pagination.totalItems).toBeGreaterThanOrEqual(res.body.data.items.length);
    });

    it('returns items without schoolName for non-district scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
          page: 1,
          perPage: 25,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      // For non-district scope, schoolName should be null (not undefined)
      for (const item of res.body.data.items) {
        expect(item.user.schoolName).toBeNull();
      }
    });

    it('returns 200 with sortBy=user.firstName', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ ...defaultQuery(), sortBy: 'user.firstName' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('returns 400 for sortBy with unknown task ID', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ ...defaultQuery(), sortBy: 'progress.00000000-0000-0000-0000-000000000000.status' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });
});
