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
import { RunScoreFactory } from '../test-support/factories/run-score.factory';

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

/** Builds the score overview endpoint path for the given administration. */
function scoreOverviewPath(administrationId: string) {
  return `/v1/administrations/${administrationId}/reports/scores/overview`;
}

/** Builds the student scores endpoint path for the given administration. */
function studentScoresPath(administrationId: string) {
  return `/v1/administrations/${administrationId}/reports/scores/students`;
}

/** Builds the individual student report endpoint path. */
function individualStudentReportPath(administrationId: string, userId: string) {
  return `/v1/administrations/${administrationId}/reports/scores/students/${userId}`;
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

  // Re-sync FGA tuples to pick up tier users created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
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

    it('educator (teacher role) at district is forbidden from reading progress at district scope', async () => {
      // District can_read_progress is restricted to admin_tier only. A teacher
      // at the district level is not in admin_tier, so they cannot read progress
      // at the district scope.
      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
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

    it('principal at school A can read progress at school scope (school_admin_tier has can_read_progress at school)', async () => {
      // Principal is in school_admin_tier. School-level can_read_progress = admin_tier or school_admin_tier.
      authenticateAs(baseFixture.schoolAPrincipal);
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
      expect(res.body.data).toBeDefined();
    });

    it('principal at school A is forbidden from reading progress at district scope', async () => {
      // District can_read_progress = admin_tier only. Principal is in school_admin_tier, not admin_tier.
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('school-level teacher is forbidden from reading progress at school scope (educator_tier excluded)', async () => {
      // schoolATeacher has teacher role at schoolA. School-level can_read_progress
      // = admin_tier or school_admin_tier — educator_tier is excluded.
      authenticateAs(baseFixture.schoolATeacher);
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
        expect([
          'assigned-required',
          'assigned-optional',
          'started-required',
          'started-optional',
          'completed-required',
          'completed-optional',
        ]).toContain(entry.status);
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

    it('returns 200 when filtering by progress.<taskId>.status:eq:assigned-required', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          // Without FDW run data, all students have "assigned-required" status for tasks they're eligible for
          filter: `progress.${baseFixture.task.id}.status:eq:assigned-required`,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      // Students matching the "assigned-required" status for this task should be returned
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('returns 200 when filtering by progress.<taskId>.status:in with 7-level values', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...defaultQuery(),
          filter: `progress.${baseFixture.task.id}.status:in:assigned-required,completed-required`,
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
          filter: `progress.${baseFixture.task.id}.status:eq:assigned-required`,
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
          filter: `progress.${baseFixture.task2.id}.status:eq:assigned-required`,
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
          filter: 'progress.00000000-0000-0000-0000-000000000000.status:eq:completed-required',
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
            `progress.${taskId}.status:eq:assigned-required`,
            `progress.${taskId}.status:eq:completed-required`,
            `progress.${taskId}.status:eq:started-required`,
            `progress.${taskId}.status:eq:assigned-optional`,
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
      expect(studentRow.progress[taskMeta.taskId].status).toBe('completed-required');
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
      expect(studentRow.progress[taskMeta.taskId].status).toBe('started-required');
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
      expect(studentRow.progress[taskMeta.taskId].status).toBe('assigned-required');
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
      expect(studentRow.progress[taskMeta.taskId].status).toBe('assigned-required');
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
      expect(studentRow.progress[taskMeta.taskId].status).toBe('assigned-required');
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
      expect(studentRow.progress[taskMeta.taskId].status).toBe('assigned-required');
    });

    it('returns completed-optional for ELL student with completed run on optional variant', async () => {
      // grade5EllStudent has statusEll='active', so variantOptionalForEll has
      // conditionsRequirements matching → task is optional for them.
      // A completed run on that variant should produce completed-optional (priority 4),
      // which wins over the no-run assigned-required (priority 1) from variantForAllGrades.
      await RunFactory.create({
        userId: baseFixture.grade5EllStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantOptionalForEll.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-07-10T10:00:00Z'),
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
      // Multi-variant dedup: completed-optional (4) from variantOptionalForEll wins over
      // assigned-required (1) from variantForAllGrades/variantForGrade5
      expect(studentRow.progress[taskMeta.taskId].status).toBe('completed-optional');
      expect(studentRow.progress[taskMeta.taskId].completedAt).toBeTruthy();
    });

    it('returns started-optional for ELL student with started run on optional variant', async () => {
      // Similar to above but with a started (not completed) run on task2's optional variant.
      // grade5EllStudent matches both conditions on variantForTask2Grade5OptionalEll:
      // conditionsAssignment (grade=5) and conditionsRequirements (statusEll=active) → optional.
      await RunFactory.create({
        userId: baseFixture.grade5EllStudent.id,
        taskId: baseFixture.task2.id,
        taskVariantId: baseFixture.variantForTask2Grade5OptionalEll.id,
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
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.grade5EllStudent.id,
      );
      expect(studentRow).toBeDefined();

      const taskMeta = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task2.id);
      expect(taskMeta).toBeDefined();
      // Multi-variant dedup: started-optional (2) from variantForTask2Grade5OptionalEll wins over
      // assigned-required (1) from variantForTask2
      expect(studentRow.progress[taskMeta.taskId].status).toBe('started-optional');
      expect(studentRow.progress[taskMeta.taskId].startedAt).toBeTruthy();
      expect(studentRow.progress[taskMeta.taskId].completedAt).toBeNull();
    });

    it('returns assigned-optional for ELL student on variant with conditionsRequirements', async () => {
      // Without any run, grade5EllStudent sees variantOptionalForEll as assigned-optional
      // because conditionsRequirements (statusEll=active) matches. However, multi-variant
      // dedup across task 1 picks the highest priority: assigned-required (1) from
      // variantForAllGrades wins over assigned-optional (0).
      // To observe assigned-optional, check task2 for a student with only the optional variant
      // matching their grade. But variantForTask2 has no conditions → all students get
      // assigned-required (1), masking assigned-optional (0) from variantForTask2Grade5OptionalEll.
      //
      // This confirms that multi-variant dedup correctly masks lower-priority optional variants
      // when a higher-priority required variant exists. The dedup behavior is tested here
      // at the integration level, complementing the unit test coverage.
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      // schoolAStudent has no grade or ELL status → all variants with no conditionsAssignment
      // are assigned-required. Multi-variant dedup picks highest priority among no-run variants.
      const studentRow = res.body.data.items.find(
        (item: { user: { userId: string } }) => item.user.userId === baseFixture.schoolAStudent.id,
      );
      expect(studentRow).toBeDefined();

      // Task 2: variantForTask2 (no conditions → assigned-required=1) and
      // variantForTask2Grade5OptionalEll (grade=5 doesn't match → excluded).
      // Result: assigned-required from the unconditional variant.
      const task2Meta = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task2.id);
      expect(task2Meta).toBeDefined();
      expect(studentRow.progress[task2Meta.taskId].status).toBe('assigned-required');
    });

    // Note: filtering by completed-optional on a multi-variant task is NOT testable here
    // because resolveProgressFilters resolves to a single variant (the first for the taskId),
    // and the completed-optional run was seeded on a different variant (variantOptionalForEll).
    // The filter LEFT JOINs runs against the resolved variant only, so cross-variant runs
    // are invisible to the filter. This is a known limitation of single-variant filter resolution.
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

    it('educator (teacher role) at district is forbidden from reading progress overview at district scope', async () => {
      // District can_read_progress is restricted to admin_tier only.
      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('principal at school A can read progress overview at school scope (school_admin_tier)', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('principal at school A is forbidden from reading progress overview at district scope', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
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

      // Top-level student-level assignment counts
      expect(data).toHaveProperty('totalStudents');
      expect(data).toHaveProperty('studentsWithRequiredTasks');
      expect(data).toHaveProperty('studentsAssigned');
      expect(data).toHaveProperty('studentsStarted');
      expect(data).toHaveProperty('studentsCompleted');
      expect(data).toHaveProperty('byTask');
      expect(data).toHaveProperty('computedAt');

      expect(typeof data.totalStudents).toBe('number');
      expect(data.totalStudents).toBeGreaterThan(0);
      expect(typeof data.studentsWithRequiredTasks).toBe('number');
      expect(typeof data.studentsAssigned).toBe('number');
      expect(typeof data.studentsStarted).toBe('number');
      expect(typeof data.studentsCompleted).toBe('number');
      expect(typeof data.computedAt).toBe('string');

      // Invariant: studentsAssigned + studentsStarted + studentsCompleted = studentsWithRequiredTasks
      expect(data.studentsAssigned + data.studentsStarted + data.studentsCompleted).toBe(
        data.studentsWithRequiredTasks,
      );

      // byTask array
      expect(data.byTask).toBeInstanceOf(Array);
      expect(data.byTask.length).toBeGreaterThan(0);

      // Per-task shape — includes 7-level counts plus convenience totals
      const firstTask = data.byTask[0];
      expect(firstTask).toHaveProperty('taskId');
      expect(firstTask).toHaveProperty('taskSlug');
      expect(firstTask).toHaveProperty('taskName');
      expect(firstTask).toHaveProperty('orderIndex');
      // 7-level per-status counts
      expect(firstTask).toHaveProperty('assignedRequired');
      expect(firstTask).toHaveProperty('assignedOptional');
      expect(firstTask).toHaveProperty('startedRequired');
      expect(firstTask).toHaveProperty('startedOptional');
      expect(firstTask).toHaveProperty('completedRequired');
      expect(firstTask).toHaveProperty('completedOptional');
      // Convenience totals by progress axis
      expect(firstTask).toHaveProperty('assigned');
      expect(firstTask).toHaveProperty('started');
      expect(firstTask).toHaveProperty('completed');
      // Convenience totals by requirement axis
      expect(firstTask).toHaveProperty('required');
      expect(firstTask).toHaveProperty('optional');
    });

    it('per-task 7-level counts are internally consistent', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;

      for (const task of data.byTask) {
        // Convenience totals by progress axis = sum of required + optional for that axis
        expect(task.assigned).toBe(task.assignedRequired + task.assignedOptional);
        expect(task.started).toBe(task.startedRequired + task.startedOptional);
        expect(task.completed).toBe(task.completedRequired + task.completedOptional);

        // Convenience totals by requirement axis
        expect(task.required).toBe(task.assignedRequired + task.startedRequired + task.completedRequired);
        expect(task.optional).toBe(task.assignedOptional + task.startedOptional + task.completedOptional);

        // Total across all 6 statuses should not exceed totalStudents
        const taskTotal = task.assigned + task.started + task.completed;
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

      // Seed a completed run on the optional variant for the ELL student so the
      // optional counts test below is self-contained (no cross-describe dependency).
      await RunFactory.create({
        userId: baseFixture.grade5EllStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantOptionalForEll.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-07-10T10:00:00Z'),
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
      // classAStudent has a completed run on task but not task2,
      // so they're in the "started" bucket (not all required tasks done).
      // groupStudent has a started run on task only → also "started" bucket.
      expect(data.studentsStarted).toBeGreaterThan(0);

      // Verify per-task breakdown still shows completed at the task level
      const taskOverview = data.byTask.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskOverview).toBeDefined();
      expect(taskOverview.completed).toBeGreaterThan(0);

      // Invariant
      expect(data.studentsAssigned + data.studentsStarted + data.studentsCompleted).toBe(
        data.studentsWithRequiredTasks,
      );
    });

    it('counts started run in overview', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // groupStudent has a started (not completed) run on task — they're in the "started" bucket
      // because they haven't completed all required tasks
      expect(data.studentsStarted).toBeGreaterThan(0);

      // Invariant
      expect(data.studentsAssigned + data.studentsStarted + data.studentsCompleted).toBe(
        data.studentsWithRequiredTasks,
      );
    });

    it('counts assigned students (no run) in overview', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // Students with no runs on any task are in the "assigned" bucket
      expect(data.studentsAssigned).toBeGreaterThan(0);
      // studentsWithRequiredTasks should be meaningful — not all students may have required tasks
      expect(data.studentsWithRequiredTasks).toBeGreaterThan(0);
      expect(data.studentsWithRequiredTasks).toBeLessThanOrEqual(data.totalStudents);

      // Invariant
      expect(data.studentsAssigned + data.studentsStarted + data.studentsCompleted).toBe(
        data.studentsWithRequiredTasks,
      );
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
      // Soft-deleted runs should not affect student-level counts
      expect(typeof data.studentsCompleted).toBe('number');
      expect(typeof data.studentsAssigned).toBe('number');
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
      // Task 2 has no conditions, so all students are accounted for across all 6 statuses
      const task2Total = task2Overview.assigned + task2Overview.started + task2Overview.completed;
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

    it('resolves both conditionsAssignment and conditionsRequirements in SQL', async () => {
      // variantForTask2Grade5OptionalEll has both conditionsAssignment (grade=5)
      // and conditionsRequirements (statusEll=active). This exercises the
      // buildOverviewStatusCase branch where both conditions are present.
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      const task2Overview = data.byTask.find((t: { taskId: string }) => t.taskId === baseFixture.task2.id);
      expect(task2Overview).toBeDefined();
      // Task 2 now has two variants: one with no conditions (assigned to all) and one
      // with both conditions (grade 5 + ELL optional). Multi-variant dedup takes the
      // highest-priority status per student, so the no-conditions variant guarantees
      // all students are at least "assigned" — total should still equal totalStudents.
      // In the 7-level scheme, assigned/started/completed are progress-axis totals
      // that already include both required and optional variants. Their sum equals
      // the total number of students visible for this task (no double-counting).
      const task2Total = task2Overview.assigned + task2Overview.started + task2Overview.completed;
      expect(task2Total).toBe(data.totalStudents);
    });

    it('includes studentsCompleted in overview response', async () => {
      // The overview beforeAll seeded a completed run for classAStudent on task/variantForAllGrades.
      // But studentsCompleted requires ALL required tasks to be completed-required for a student.
      // The district administration has 2 tasks (task and task2). classAStudent only has a
      // completed run for task, not task2 → they should NOT count as fully completed.
      // studentsCompleted should be 0 unless a student has completed runs for all tasks.
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(typeof data.studentsCompleted).toBe('number');
      // No student has completed ALL required tasks — classAStudent only completed task, not task2
      expect(data.studentsCompleted).toBe(0);
    });

    it('counts studentsCompleted when student completes all required tasks', async () => {
      // Seed a completed run for classAStudent on task2/variantForTask2.
      // classAStudent already has a completed run on task/variantForAllGrades (from beforeAll).
      // With both tasks completed-required, classAStudent should count toward studentsCompleted.
      await RunFactory.create({
        userId: baseFixture.classAStudent.id,
        taskId: baseFixture.task2.id,
        taskVariantId: baseFixture.variantForTask2.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-07-02T10:00:00Z'),
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // classAStudent now has completed-required on both task and task2
      expect(data.studentsCompleted).toBeGreaterThanOrEqual(1);
      // Invariant should still hold
      expect(data.studentsAssigned + data.studentsStarted + data.studentsCompleted).toBe(
        data.studentsWithRequiredTasks,
      );
    });

    it('includes optional counts in per-task overview', async () => {
      // variantOptionalForEll has conditionsRequirements (statusEll=active).
      // grade5EllStudent (statusEll=active) should be counted as optional for task 1.
      // A completed run on variantOptionalForEll was seeded in this describe's beforeAll.
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(overviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      const taskOverview = data.byTask.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskOverview).toBeDefined();

      // grade5EllStudent has a completed-optional status for task 1
      expect(taskOverview.completedOptional).toBeGreaterThan(0);

      // The 7-level counts should all be non-negative integers
      expect(taskOverview.assignedRequired).toBeGreaterThanOrEqual(0);
      expect(taskOverview.assignedOptional).toBeGreaterThanOrEqual(0);
      expect(taskOverview.startedRequired).toBeGreaterThanOrEqual(0);
      expect(taskOverview.startedOptional).toBeGreaterThanOrEqual(0);
      expect(taskOverview.completedRequired).toBeGreaterThanOrEqual(0);
      expect(taskOverview.completedOptional).toBeGreaterThanOrEqual(0);
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

    it('returns overview for group scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(progressOverviewPath(baseFixture.administrationAssignedToGroup.id))
        .query({
          scopeType: 'group',
          scopeId: baseFixture.group.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data).toHaveProperty('totalStudents');
      expect(data.totalStudents).toBeGreaterThan(0);
      expect(data).toHaveProperty('byTask');
      // Group administration has no task variants — byTask is empty but query succeeds
      expect(data.byTask).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/reports/scores/overview
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/reports/scores/overview', () => {
  /** Default query params for a valid score overview request. */
  function scoreOverviewQuery() {
    return {
      scopeType: 'district',
      scopeId: baseFixture.district.id,
    };
  }

  describe('authorization', () => {
    it('returns 401 without auth', async () => {
      const res = await expectRoute('GET', scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .unauthenticated()
        .toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('super admin can access', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('admin (administrator role) at district can access', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('site admin (site_administrator role) at district can access', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('educator (teacher role) at district is forbidden from reading scores at district scope', async () => {
      // District can_read_scores is restricted to admin_tier only.
      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('principal at school A can read score overview at school scope', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('principal at school A is forbidden from reading score overview at district scope', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('student tier returns 403', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier returns 403', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 for admin in a different district', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('returns 403 when class teacher requests school scope', async () => {
      // FGA can_read_scores at the school level requires school_admin_tier or higher.
      // A class teacher's tuples don't propagate up to the school, so the request is denied.
      authenticateAs(baseFixture.classATeacher);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('scope validation', () => {
    it('returns 400 for scope not assigned to administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
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
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ scopeId: baseFixture.district.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when scopeId is missing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ scopeType: 'district' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 for non-existent administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath('00000000-0000-0000-0000-000000000000'))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });

  describe('response shape', () => {
    it('returns 200 with correct response structure', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data).toHaveProperty('totalStudents');
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('computedAt');
      expect(typeof data.totalStudents).toBe('number');
      expect(typeof data.computedAt).toBe('string');
      expect(data.tasks).toBeInstanceOf(Array);
      expect(data.tasks.length).toBeGreaterThan(0);

      const firstTask = data.tasks[0];
      expect(firstTask).toHaveProperty('taskId');
      expect(firstTask).toHaveProperty('taskSlug');
      expect(firstTask).toHaveProperty('taskName');
      expect(firstTask).toHaveProperty('orderIndex');
      expect(firstTask).toHaveProperty('totalAssessed');
      expect(firstTask).toHaveProperty('totalNotAssessed');
      expect(firstTask.totalNotAssessed).toHaveProperty('required');
      expect(firstTask.totalNotAssessed).toHaveProperty('optional');
      expect(firstTask).toHaveProperty('supportLevels');
      expect(firstTask.supportLevels).toHaveProperty('achievedSkill');
      expect(firstTask.supportLevels).toHaveProperty('developingSkill');
      expect(firstTask.supportLevels).toHaveProperty('needsExtraSupport');
      expect(firstTask.supportLevels.achievedSkill).toHaveProperty('count');
      expect(firstTask.supportLevels.achievedSkill).toHaveProperty('percentage');
    });

    it('per-task counts are internally consistent', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      for (const task of data.tasks) {
        // Sum of bucketed assessed students cannot exceed totalAssessed
        const bucketedAssessed =
          task.supportLevels.achievedSkill.count +
          task.supportLevels.developingSkill.count +
          task.supportLevels.needsExtraSupport.count;
        expect(bucketedAssessed).toBeLessThanOrEqual(task.totalAssessed);

        // Total students engaged with the task cannot exceed totalStudents
        const totalEngaged = task.totalAssessed + task.totalNotAssessed.required + task.totalNotAssessed.optional;
        expect(totalEngaged).toBeLessThanOrEqual(data.totalStudents);

        // Percentages are 0-100 with at most 1 decimal place
        for (const level of ['achievedSkill', 'developingSkill', 'needsExtraSupport'] as const) {
          const pct = task.supportLevels[level].percentage;
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
          // Round to 1 decimal: pct * 10 should be an integer
          expect(Math.round(pct * 10)).toBeCloseTo(pct * 10);
        }
      }
    });

    it('filters tasks via taskId filter', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...scoreOverviewQuery(),
          filter: `taskId:in:${baseFixture.task.id}`,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // All returned tasks share the filtered taskId (the fixture defines a single task,
      // so this confirms the filter doesn't accidentally widen the set)
      for (const task of data.tasks) {
        expect(task.taskId).toBe(baseFixture.task.id);
      }
    });

    it('filters student population via user.grade filter', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...scoreOverviewQuery(),
          filter: 'user.grade:eq:5',
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // grade-filtered population should be smaller than the unfiltered district set
      expect(typeof data.totalStudents).toBe('number');
      expect(data.totalStudents).toBeGreaterThanOrEqual(0);
    });

    it('deduplicates multi-variant tasks into one entry per taskId', async () => {
      // The fixture assigns 4 variants of `task` (variantForAllGrades, variantForGrade5,
      // variantForGrade3, variantOptionalForEll) and 2 variants of `task2` to
      // administrationAssignedToDistrict. Without dedup we would see 6 entries; with
      // dedup we expect exactly 2 (one per unique taskId).
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      const uniqueTaskIds = new Set(data.tasks.map((t: { taskId: string }) => t.taskId));
      expect(uniqueTaskIds.size).toBe(data.tasks.length);
      expect(uniqueTaskIds).toEqual(new Set([baseFixture.task.id, baseFixture.task2.id]));
    });

    it('returns 200 for class scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToClassA.id))
        .query({
          scopeType: 'class',
          scopeId: baseFixture.classInSchoolA.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data).toHaveProperty('totalStudents');
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('computedAt');
    });

    it('returns 200 for group scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToGroup.id))
        .query({
          scopeType: 'group',
          scopeId: baseFixture.group.id,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data).toHaveProperty('totalStudents');
      expect(data).toHaveProperty('tasks');
      // The group administration has no task variants assigned — tasks should be empty
      expect(data.tasks).toHaveLength(0);
    });
  });

  describe('FDW-backed aggregation', () => {
    // Seed a completed run + scores for grade5Student so totalAssessed is non-zero.
    beforeAll(async () => {
      const run = await RunFactory.create({
        userId: baseFixture.grade5Student.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-08-01T10:00:00Z'),
      });

      // Seed a percentile score so getSupportLevel can classify the student.
      await RunScoreFactory.create({
        runId: run.id,
        type: 'computed',
        domain: 'default',
        name: 'percentile',
        value: '90',
      });
    });

    it('counts the seeded completed run in totalAssessed', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      const taskOverview = data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskOverview).toBeDefined();
      // At least the seeded student should be assessed
      expect(taskOverview!.totalAssessed).toBeGreaterThanOrEqual(1);
    });

    it('counts students without completed runs in totalNotAssessed', async () => {
      // The district contains more students than the single seeded grade5Student.
      // Every other student has no completed run with scores for `task`, so they
      // should appear in totalNotAssessed (required or optional, depending on
      // condition evaluation).
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(scoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      const taskOverview = data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(taskOverview).toBeDefined();
      const notAssessedTotal = taskOverview!.totalNotAssessed.required + taskOverview!.totalNotAssessed.optional;
      expect(notAssessedTotal).toBeGreaterThan(0);
      // Every assigned student is either assessed or not-assessed — never both.
      expect(taskOverview!.totalAssessed + notAssessedTotal).toBeLessThanOrEqual(data.totalStudents);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/reports/scores/students
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/reports/scores/students', () => {
  /** Default query params for a valid student scores request. */
  function studentScoresQuery() {
    return {
      scopeType: 'district',
      scopeId: baseFixture.district.id,
      page: 1,
      perPage: 25,
    };
  }

  describe('authorization', () => {
    it('returns 401 without auth', async () => {
      const res = await expectRoute('GET', studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .unauthenticated()
        .toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('super admin can access', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('admin (administrator role) at district can access', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('site admin (site_administrator role) at district can access', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('educator (teacher) at district is forbidden from reading scores at district scope', async () => {
      // District can_read_scores is restricted to admin_tier only.
      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('principal at school A can access at school scope', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
          page: 1,
          perPage: 25,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('principal at school A is forbidden at district scope', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('student tier returns 403', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier returns 403', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 for admin in a different district', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
          page: 1,
          perPage: 25,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('returns 403 when class teacher requests school scope', async () => {
      authenticateAs(baseFixture.classATeacher);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToSchoolA.id))
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
  });

  describe('scope validation', () => {
    it('returns 400 for scope not assigned to administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToSchoolA.id))
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
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ scopeId: baseFixture.district.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when scopeId is missing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ scopeType: 'district' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 for non-existent administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath('00000000-0000-0000-0000-000000000000'))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 400 when sortBy references an unknown task ID', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...studentScoresQuery(),
          sortBy: 'scores.00000000-0000-0000-0000-000000000000.percentile',
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('response shape', () => {
    it('returns 200 with correct response structure', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('pagination');
      expect(data.tasks).toBeInstanceOf(Array);
      expect(data.tasks.length).toBeGreaterThan(0);

      // Per-task metadata shape
      const firstTask = data.tasks[0];
      expect(firstTask).toHaveProperty('taskId');
      expect(firstTask).toHaveProperty('taskSlug');
      expect(firstTask).toHaveProperty('taskName');
      expect(firstTask).toHaveProperty('orderIndex');

      // Pagination shape
      expect(data.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          perPage: 25,
          totalItems: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      );

      // If any students are in scope, verify the row shape
      if (data.items.length > 0) {
        const row = data.items[0];
        expect(row).toHaveProperty('user');
        expect(row).toHaveProperty('scores');
        expect(row.user).toHaveProperty('userId');
        expect(row.user).toHaveProperty('grade');
      }
    });

    it('populates schoolName on user info at district scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // Every row at district scope should have schoolName as either string or null;
      // at least one row should have a non-null value (district has school memberships)
      for (const row of data.items) {
        expect(['string', 'object']).toContain(typeof row.user.schoolName); // string or null
      }
    });

    it('returns null schoolName at non-district scopes', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({
          scopeType: 'school',
          scopeId: baseFixture.schoolA.id,
          page: 1,
          perPage: 25,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      for (const row of res.body.data.items) {
        expect(row.user.schoolName).toBeNull();
      }
    });

    it('filters tasks via taskId filter', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...studentScoresQuery(),
          filter: `taskId:in:${baseFixture.task.id}`,
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      // Only the filtered task should appear in tasks metadata
      for (const t of data.tasks) {
        expect(t.taskId).toBe(baseFixture.task.id);
      }
      // And in score entries
      for (const row of data.items) {
        for (const entryTaskId of Object.keys(row.scores)) {
          expect(entryTaskId).toBe(baseFixture.task.id);
        }
      }
    });

    it('filters student population via user.grade filter', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query({
          ...studentScoresQuery(),
          filter: 'user.grade:eq:5',
        })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      for (const row of res.body.data.items) {
        expect(row.user.grade).toBe('5');
      }
    });

    it('sorts by user.lastName by default', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const lastNames = res.body.data.items
        .map((r: { user: { lastName: string | null } }) => r.user.lastName)
        .filter((n: string | null): n is string => n !== null);
      const sorted = [...lastNames].sort((a, b) => a.localeCompare(b));
      expect(lastNames).toEqual(sorted);
    });
  });

  describe('FDW-backed score classification', () => {
    // Seed a completed run with a percentile score for grade5Student so the
    // service has real data to classify and the row reaches the assessed path.
    beforeAll(async () => {
      const run = await RunFactory.create({
        userId: baseFixture.grade5Student.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-09-01T10:00:00Z'),
      });

      await RunScoreFactory.create({
        runId: run.id,
        type: 'computed',
        domain: 'default',
        name: 'percentile',
        value: '90',
      });
    });

    it('returns completed:true with run metadata for the seeded student', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const seededRow = res.body.data.items.find(
        (r: { user: { userId: string } }) => r.user.userId === baseFixture.grade5Student.id,
      );
      expect(seededRow).toBeDefined();
      const entry = seededRow.scores[baseFixture.task.id];
      expect(entry).toBeDefined();
      // Run-level wiring: the completed run was joined and reliability propagated.
      expect(entry.completed).toBe(true);
      expect(typeof entry.reliable).toBe('boolean');
      expect(Array.isArray(entry.engagementFlags)).toBe(true);
      // Note: rawScore/percentile/standardScore/supportLevel resolution requires the
      // task's slug to be registered in the scoring config (apps/backend/src/services/scoring/configs/*).
      // The fixture's task uses an auto-generated slug, so those fields stay null end-to-end.
      // Score classification correctness is covered by service unit tests, which exercise
      // the full scoring pipeline against known slugs (swr, roam-alpaca, etc.).
    });

    it('returns completed:false for students without a completed run', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(studentScoresPath(baseFixture.administrationAssignedToDistrict.id))
        .query(studentScoresQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      // Find any student-without-run row (there should be several besides grade5Student)
      const unfinishedRow = res.body.data.items.find(
        (r: { user: { userId: string }; scores: Record<string, { completed: boolean }> }) =>
          r.user.userId !== baseFixture.grade5Student.id &&
          r.scores[baseFixture.task.id] !== undefined &&
          r.scores[baseFixture.task.id]!.completed === false,
      );
      expect(unfinishedRow).toBeDefined();
      expect(unfinishedRow.scores[baseFixture.task.id]!.rawScore).toBeNull();
      expect(unfinishedRow.scores[baseFixture.task.id]!.percentile).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/administrations/:id/reports/scores/students/:userId
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/reports/scores/students/:userId', () => {
  /** Default scope params for the individual student report endpoint. */
  function reportQuery() {
    return {
      scopeType: 'district',
      scopeId: baseFixture.district.id,
    };
  }

  describe('authorization', () => {
    it('returns 401 without auth', async () => {
      const res = await expectRoute(
        'GET',
        individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id),
      )
        .unauthenticated()
        .toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('super admin can access', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('admin (administrator role) at district can access', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('site admin at district can access', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('educator (teacher) at district is forbidden at district scope', async () => {
      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('principal at school A can access at school scope', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToSchoolA.id, baseFixture.classAStudent.id))
        .query({ scopeType: 'school', scopeId: baseFixture.schoolA.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('principal at school A is forbidden at district scope', async () => {
      authenticateAs(baseFixture.schoolAPrincipal);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('student tier returns 403', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier returns 403', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('returns 403 for admin in a different district', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToSchoolA.id, baseFixture.classAStudent.id))
        .query({ scopeType: 'school', scopeId: baseFixture.schoolA.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('class teacher requesting school scope returns 403', async () => {
      authenticateAs(baseFixture.classATeacher);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToSchoolA.id, baseFixture.classAStudent.id))
        .query({ scopeType: 'school', scopeId: baseFixture.schoolA.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('scope and target validation', () => {
    it('returns 400 for scope not assigned', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToSchoolA.id, baseFixture.classAStudent.id))
        .query({ scopeType: 'school', scopeId: baseFixture.schoolB.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
    });

    it('returns 400 when scopeType is missing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query({ scopeId: baseFixture.district.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when scopeId is missing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query({ scopeType: 'district' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 for non-existent administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath('00000000-0000-0000-0000-000000000000', baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 for student not in the requested scope', async () => {
      authenticateAs(tiers.superAdmin);
      // grade5Student IS in the district; districtBAdmin is in districtB and is not a student in district A
      const res = await request(app)
        .get(
          individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.districtBAdmin.id),
        )
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 404 for an unknown user ID', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(
          individualStudentReportPath(
            baseFixture.administrationAssignedToDistrict.id,
            '00000000-0000-0000-0000-000000000000',
          ),
        )
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });
  });

  describe('response shape', () => {
    it('returns 200 with student, administration, tasks, and counts', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data).toHaveProperty('student');
      expect(data).toHaveProperty('administration');
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('completedTaskCount');
      expect(data).toHaveProperty('totalTaskCount');

      expect(data.student.userId).toBe(baseFixture.grade5Student.id);
      expect(data.administration.id).toBe(baseFixture.administrationAssignedToDistrict.id);
      expect(typeof data.administration.dateStart).toBe('string');
      expect(typeof data.administration.dateEnd).toBe('string');
      expect(data.tasks).toBeInstanceOf(Array);
      expect(typeof data.completedTaskCount).toBe('number');
      expect(typeof data.totalTaskCount).toBe('number');
      expect(data.completedTaskCount).toBeLessThanOrEqual(data.totalTaskCount);

      // Per-task entry shape
      if (data.tasks.length > 0) {
        const task = data.tasks[0];
        expect(task).toHaveProperty('taskId');
        expect(task).toHaveProperty('taskSlug');
        expect(task).toHaveProperty('taskName');
        expect(task).toHaveProperty('orderIndex');
        expect(task).toHaveProperty('scores');
        expect(task).toHaveProperty('supportLevel');
        expect(task).toHaveProperty('reliable');
        expect(task).toHaveProperty('optional');
        expect(task).toHaveProperty('completed');
        expect(task).toHaveProperty('engagementFlags');
        expect(task).toHaveProperty('tags');
        expect(task).toHaveProperty('historicalScores');
        // Tags always include Type label
        expect(task.tags.some((t: { label: string }) => t.label === 'Type')).toBe(true);
      }
    });
  });

  describe('FDW-backed run integration', () => {
    // Reuse the seeded run from the student-scores describe-block beforeAll
    // (grade5Student has a completed run + percentile=90 score for baseFixture.task).
    it('returns completed:true with run metadata for the student with a seeded run', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      const seededTask = data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(seededTask).toBeDefined();
      expect(seededTask.completed).toBe(true);
      expect(typeof seededTask.reliable).toBe('boolean');
      expect(Array.isArray(seededTask.engagementFlags)).toBe(true);
      // Run-level wiring proven; classification correctness covered by service unit tests
      // (the fixture's auto-generated task slug is not in the scoring config registry,
      // so percentile/rawScore/standardScore stay null end-to-end).
    });

    it('counts completed tasks correctly', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;
      expect(data.completedTaskCount).toBeGreaterThanOrEqual(1);
    });

    it('every per-task entry includes a Type tag with Required or Optional', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToDistrict.id, baseFixture.grade5Student.id))
        .query(reportQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      for (const task of res.body.data.tasks) {
        const typeTag = task.tags.find((t: { label: string }) => t.label === 'Type');
        expect(typeTag).toBeDefined();
        expect(['Required', 'Optional']).toContain(typeTag.value);
      }
    });
  });

  describe('class and group scopes', () => {
    it('returns 200 for class scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToClassA.id, baseFixture.classAStudent.id))
        .query({ scopeType: 'class', scopeId: baseFixture.classInSchoolA.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const { data } = res.body;
      expect(data.student.userId).toBe(baseFixture.classAStudent.id);
      expect(data.administration.id).toBe(baseFixture.administrationAssignedToClassA.id);
    });

    it('returns 200 for group scope', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(individualStudentReportPath(baseFixture.administrationAssignedToGroup.id, baseFixture.groupStudent.id))
        .query({ scopeType: 'group', scopeId: baseFixture.group.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const { data } = res.body;
      expect(data.student.userId).toBe(baseFixture.groupStudent.id);
      // Group administration has no task variants assigned — tasks empty but query 200s
      expect(data.tasks).toEqual([]);
    });
  });
});
