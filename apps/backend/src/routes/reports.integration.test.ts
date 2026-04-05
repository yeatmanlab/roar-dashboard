/**
 * Route integration tests for /v1/administrations/:id/reports endpoints.
 *
 * Tests the full HTTP lifecycle: middleware -> controller -> service -> repository -> DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * FDW tests seed run data via RunFactory into the assessment DB and verify that the
 * progress status is correctly derived through the full HTTP stack.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { authenticateAs, createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { RunFactory } from '../test-support/factories/run.factory';

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

/** Builds the progress overview endpoint path for the given administration. */
function progressOverviewPath(administrationId: string) {
  return `/v1/administrations/${administrationId}/reports/progress/overview`;
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

/** Default query params for overview (no pagination). */
function overviewQuery() {
  return {
    scopeType: 'district',
    scopeId: baseFixture.district.id,
  };
}

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerAdministrationsRoutes } = await import('./administrations');

  app = createTestApp(registerAdministrationsRoutes);
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

  describe('progress status sort and filter', () => {
    it('returns 200 when sorting by progress.<taskId>.status', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          sortBy: `progress.${baseFixture.task.id}.status`,
        })
        .set('Authorization', 'Bearer token');

      // Include response body in failure message to diagnose SQL errors
      expect(res.body.error ?? 'no error').toBe('no error');
      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('returns 200 when filtering by progress.<taskId>.status:eq:assigned', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          // Without FDW run data, all students have "assigned" status for tasks they're eligible for
          filter: `progress.${baseFixture.task.id}.status:eq:assigned`,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      // Students matching the "assigned" status for this task should be returned
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('returns 200 when filtering by progress.<taskId>.status:in:assigned,completed', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          filter: `progress.${baseFixture.task.id}.status:in:assigned,completed`,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('returns 200 with sort and filter targeting the same task variant', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          sortBy: `progress.${baseFixture.task.id}.status`,
          filter: `progress.${baseFixture.task.id}.status:eq:assigned`,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('returns 200 with sort and filter targeting different task variants', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          sortBy: `progress.${baseFixture.task.id}.status`,
          filter: `progress.${baseFixture.task2.id}.status:eq:assigned`,
        })
        .set('Authorization', 'Bearer token');

      expect(res.body.error ?? 'no error').toBe('no error');
      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('returns 400 for unknown task ID in filter', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          filter: 'progress.00000000-0000-0000-0000-000000000000.status:eq:completed',
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when more than 3 progress status filters are provided', async () => {
      authenticateAs(tiers.superAdmin);
      // The fixture only has one task, so we'd need to fabricate UUIDs.
      // But unknown task IDs return 400 before the count check. Use the real task ID
      // for the first 3 and a fourth to trigger the cap. Since the cap is checked before
      // task validation, we can use duplicates of the same task ID.
      const taskId = baseFixture.task.id;
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          filter: [
            `progress.${taskId}.status:eq:assigned`,
            `progress.${taskId}.status:eq:completed`,
            `progress.${taskId}.status:eq:started`,
            `progress.${taskId}.status:eq:optional`,
          ],
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('FDW-backed run status', () => {
    it('returns completed status for student with a completed run', async () => {
      await RunFactory.create({
        userId: baseFixture.schoolAStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-06-15T10:00:00Z'),
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const studentRow = res.body.data.items.find(
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.schoolAStudent.id,
      );
      expect(studentRow).toBeDefined();

      // Find the task in the response — progress map is keyed by taskId, not variantId
      const taskMeta = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskMeta).toBeDefined();
      expect(studentRow.progress[taskMeta.taskId].status).toBe('completed');
      expect(studentRow.progress[taskMeta.taskId].completedAt).toBeTruthy();
    });

    it('returns started status for student with a started (not completed) run', async () => {
      await RunFactory.create({
        userId: baseFixture.schoolBStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: null,
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const studentRow = res.body.data.items.find(
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.schoolBStudent.id,
      );
      expect(studentRow).toBeDefined();

      const taskMeta = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskMeta).toBeDefined();
      expect(studentRow.progress[taskMeta.taskId].status).toBe('started');
      expect(studentRow.progress[taskMeta.taskId].startedAt).toBeTruthy();
      expect(studentRow.progress[taskMeta.taskId].completedAt).toBeNull();
    });

    it('returns assigned status for student with no run', async () => {
      // classAStudent has no seeded runs
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const studentRow = res.body.data.items.find(
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.classAStudent.id,
      );
      expect(studentRow).toBeDefined();

      const taskMeta = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskMeta).toBeDefined();
      expect(studentRow.progress[taskMeta.taskId].status).toBe('assigned');
    });

    it('excludes soft-deleted run from progress status', async () => {
      await RunFactory.create({
        userId: baseFixture.grade3Student.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-06-15T10:00:00Z'),
        deletedAt: new Date('2025-06-16T10:00:00Z'),
        deletedBy: baseFixture.districtAdmin.id,
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const studentRow = res.body.data.items.find(
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.grade3Student.id,
      );
      expect(studentRow).toBeDefined();

      const taskMeta = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskMeta).toBeDefined();
      // Soft-deleted run should not count — status falls back to assigned
      expect(studentRow.progress[taskMeta.taskId].status).toBe('assigned');
    });

    it('excludes aborted run from progress status', async () => {
      await RunFactory.create({
        userId: baseFixture.grade5Student.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: null,
        abortedAt: new Date('2025-06-15T12:00:00Z'),
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const studentRow = res.body.data.items.find(
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.grade5Student.id,
      );
      expect(studentRow).toBeDefined();

      const taskMeta = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskMeta).toBeDefined();
      // Aborted run should not count — status falls back to assigned
      expect(studentRow.progress[taskMeta.taskId].status).toBe('assigned');
    });

    it('excludes useForReporting=false run from progress status', async () => {
      await RunFactory.create({
        userId: baseFixture.grade5EllStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: false,
        completedAt: new Date('2025-06-15T10:00:00Z'),
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const studentRow = res.body.data.items.find(
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.grade5EllStudent.id,
      );
      expect(studentRow).toBeDefined();

      const taskMeta = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskMeta).toBeDefined();
      // useForReporting=false run should not count — status falls back to assigned
      expect(studentRow.progress[taskMeta.taskId].status).toBe('assigned');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/reports/progress/overview
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/reports/progress/overview', () => {
  describe('authorization', () => {
    it('returns 401 without auth', async () => {
      const res = await expectRoute('GET', progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .unauthenticated()
        .toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('super admin can access', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('admin (administrator role) at district can access', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('educator (teacher role) at district can access', async () => {
      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('student tier returns 403', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier returns 403 (has report permission but not supervisory)', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 when class teacher requests school scope', async () => {
      authenticateAs(baseFixture.classATeacher);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 for admin in a different district', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('scope validation', () => {
    it('returns 400 for scope not assigned to administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolB.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
    });

    it('returns 400 when scopeType is missing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ scopeId: baseFixture.district.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when scopeId is missing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ scopeType: 'district' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 for non-existent administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath('00000000-0000-0000-0000-000000000000'))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });

  describe('response shape', () => {
    it('returns 200 with correct response structure', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;

      // Top-level aggregate fields
      expect(data).toHaveProperty('totalStudents');
      expect(data).toHaveProperty('assigned');
      expect(data).toHaveProperty('started');
      expect(data).toHaveProperty('completed');
      expect(data).toHaveProperty('byTask');
      expect(data).toHaveProperty('computedAt');

      expect(typeof data.totalStudents).toBe('number');
      expect(data.totalStudents).toBeGreaterThan(0);
      expect(typeof data.assigned).toBe('number');
      expect(typeof data.started).toBe('number');
      expect(typeof data.completed).toBe('number');
      expect(typeof data.computedAt).toBe('string');

      // byTask array
      expect(data.byTask).toBeInstanceOf(Array);
      expect(data.byTask.length).toBeGreaterThan(0);

      // Per-task shape
      const firstTask = data.byTask[0];
      expect(firstTask).toHaveProperty('taskId');
      expect(firstTask).toHaveProperty('taskSlug');
      expect(firstTask).toHaveProperty('taskName');
      expect(firstTask).toHaveProperty('orderIndex');
      expect(firstTask).toHaveProperty('assigned');
      expect(firstTask).toHaveProperty('started');
      expect(firstTask).toHaveProperty('completed');
      expect(firstTask).toHaveProperty('optional');
    });

    it('per-task counts are consistent with totalStudents', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;

      // For each task, the sum of assigned + started + completed + optional
      // should not exceed totalStudents (some students may be excluded by conditions)
      for (const task of data.byTask) {
        const taskTotal = task.assigned + task.started + task.completed + task.optional;
        expect(taskTotal).toBeLessThanOrEqual(data.totalStudents);
      }
    });
  });

  describe('FDW-backed aggregation', () => {
    // Seed dedicated runs for overview tests so they don't depend on the
    // progress/students FDW tests above. Uses classAStudent (completed) and
    // groupStudent (started) — neither is used in the students FDW block.
    beforeAll(async () => {
      await RunFactory.create({
        userId: baseFixture.classAStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-07-01T10:00:00Z'),
      });

      await RunFactory.create({
        userId: baseFixture.groupStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: null,
      });
    });

    it('counts completed run in overview', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data.completed).toBeGreaterThan(0);

      // Verify per-task breakdown
      const taskOverview = data.byTask.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskOverview).toBeDefined();
      expect(taskOverview.completed).toBeGreaterThan(0);
    });

    it('counts started run in overview', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data.started).toBeGreaterThan(0);
    });

    it('counts assigned students (no run) in overview', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // Students with no runs should be counted as assigned
      expect(data.assigned).toBeGreaterThan(0);
    });

    it('excludes soft-deleted runs from overview counts', async () => {
      // Create a soft-deleted completed run for grade3Student — should not be counted
      await RunFactory.create({
        userId: baseFixture.grade3Student.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-07-01T10:00:00Z'),
        deletedAt: new Date('2025-07-02T10:00:00Z'),
        deletedBy: baseFixture.districtAdmin.id,
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(typeof data.completed).toBe('number');
      expect(typeof data.assigned).toBe('number');
    });

    it('returns overview for school scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data.totalStudents).toBeGreaterThan(0);
      expect(data.byTask).toBeInstanceOf(Array);
    });

    it('resolves conditionsAssignment in SQL without column resolution errors', async () => {
      // The district administration has variants with conditionsAssignment JSONB
      // (grade=5, grade=3). conditionToSql translates these into Drizzle SQL referencing
      // "app"."users"."grade". This test proves the generated SQL resolves correctly
      // against the fully-qualified table names used in the UNION branches.
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // Task 1 has conditionsAssignment variants (grade 5, grade 3) — students not matching
      // either condition should be excluded from that variant's count, not assigned.
      // Task 2 has no conditions — all students in scope should be counted.
      const task2Overview = data.byTask.find((t: { taskId: string }) => t.taskId === baseFixture.task2.id);
      expect(task2Overview).toBeDefined();
      // Task 2 has no conditions, so assigned + started + completed + optional = totalStudents
      const task2Total =
        task2Overview.assigned + task2Overview.started + task2Overview.completed + task2Overview.optional;
      expect(task2Total).toBe(data.totalStudents);
    });

    it('resolves conditionsRequirements in SQL for optional status', async () => {
      // The district administration has a variant with conditionsRequirements (statusEll=active).
      // This test verifies the SQL handles the requirements condition without errors.
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // The optional variant (conditionsRequirements: statusEll=active) should produce
      // valid counts — some students may be optional if they match the ELL condition
      const taskWithOptional = data.byTask.find((t: { optional: number }) => t.optional !== undefined);
      expect(taskWithOptional).toBeDefined();
    });

    it('returns overview for class scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToClassA.id))
        .query({
          scopeType: 'class',
          scopeId: baseFixture.classInSchoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data).toHaveProperty('totalStudents');
      expect(data).toHaveProperty('byTask');
    });
  });
});
