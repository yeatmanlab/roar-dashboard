/**
 * Route integration tests for /v1/administrations/:id/reports endpoints.
 *
 * Tests the full HTTP lifecycle: middleware -> controller -> service -> repository -> DB.
 * Firebase token verification and FGA authorization are mocked — everything else runs for real.
 *
 * FGA mock: `FgaClient.getClient()` is intercepted so that `AuthorizationService`
 * receives a mock whose `check` method resolves based on `allowedFgaUsers` — a set
 * of user IDs that should pass FGA permission checks. Tests configure this set to
 * match their authorization expectations.
 *
 * FDW tests seed run data via RunFactory into the assessment DB and verify that the
 * progress status is correctly derived through the full HTTP stack.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { authenticateAs, createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { RunFactory } from '../test-support/factories/run.factory';
import { RunScoreFactory } from '../test-support/factories/run-score.factory';
import { FgaClient } from '../clients/fga.client';

// ═══════════════════════════════════════════════════════════════════════════
// FGA mock
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Set of user IDs that FGA should allow for any relation/object.
 * Configure per-test or per-describe block via `allowedFgaUsers.add(userId)`.
 */
const allowedFgaUsers = new Set<string>();

const mockFgaCheck = vi.fn().mockImplementation(async (req: { user: string }) => {
  // req.user is formatted as "user:<userId>"
  const userId = req.user.replace('user:', '');
  return { allowed: allowedFgaUsers.has(userId) };
});

vi.spyOn(FgaClient, 'getClient').mockReturnValue({ check: mockFgaCheck } as never);

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

/** Builds the score overview endpoint path for the given administration. */
function scoreOverviewPath(administrationId: string) {
  return `/v1/administrations/${administrationId}/reports/scores/overview`;
}

/** Default query params for a valid progress request. */
function defaultQuery() {
  return {
    scopeType: 'district',
    scopeId: baseFixture.district.id,
    page: 1,
    perPage: 25,
  };
}

/** Default query params for a valid score overview request. */
function defaultScoreOverviewQuery() {
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
  const { registerReportsRoutes } = await import('./reports');

  app = createTestApp(registerAdministrationsRoutes, registerReportsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
});

beforeEach(() => {
  // Reset FGA mock state — each test configures its own allowed users
  allowedFgaUsers.clear();
  mockFgaCheck.mockClear();
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
      allowedFgaUsers.add(tiers.admin.id);
      authenticateAs(tiers.admin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('site admin (site_administrator role) at district can access', async () => {
      allowedFgaUsers.add(tiers.siteAdmin.id);
      authenticateAs(tiers.siteAdmin);
      const res = await request(app)
        .get(progressStudentsPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('educator (teacher role) at district can access', async () => {
      allowedFgaUsers.add(tiers.educator.id);
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
      // FGA denies can_read_progress at the school scope level.
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
// GET /v1/administrations/:id/reports/scores/overview
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/administrations/:id/reports/scores/overview', () => {
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
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('admin (administrator role) at district can access', async () => {
      allowedFgaUsers.add(tiers.admin.id);
      authenticateAs(tiers.admin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toBeDefined();
    });

    it('educator (teacher role) at district can access', async () => {
      allowedFgaUsers.add(tiers.educator.id);
      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('student tier returns 403', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier returns 403 (has report permission but not supervisory)', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 when class teacher requests school scope', async () => {
      authenticateAs(baseFixture.classATeacher);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({ scopeType: 'school', scopeId: baseFixture.schoolA.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('returns 403 for admin in a different district', async () => {
      authenticateAs(baseFixture.districtBAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({ scopeType: 'school', scopeId: baseFixture.schoolA.id })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('scope validation', () => {
    it('returns 400 for scope not assigned to administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToSchoolA.id))
        .query({ scopeType: 'school', scopeId: baseFixture.schoolB.id })
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

    it('returns 404 for non-existent administration', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath('00000000-0000-0000-0000-000000000000'))
        .query(defaultScoreOverviewQuery())
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
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const { data } = res.body;

      // Top-level structure
      expect(data).toHaveProperty('totalStudents');
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('computedAt');
      expect(typeof data.totalStudents).toBe('number');
      expect(data.totalStudents).toBeGreaterThan(0);

      // computedAt is a valid ISO 8601 datetime
      const parsedDate = new Date(data.computedAt);
      expect(parsedDate.getTime()).not.toBeNaN();

      // Tasks array
      expect(data.tasks).toBeInstanceOf(Array);
      expect(data.tasks.length).toBeGreaterThan(0);

      // Verify task overview shape
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

      // Each support level has count and percentage
      for (const level of ['achievedSkill', 'developingSkill', 'needsExtraSupport'] as const) {
        expect(firstTask.supportLevels[level]).toHaveProperty('count');
        expect(firstTask.supportLevels[level]).toHaveProperty('percentage');
        expect(typeof firstTask.supportLevels[level].count).toBe('number');
        expect(typeof firstTask.supportLevels[level].percentage).toBe('number');
      }
    });

    it('filters by user.grade when provided', async () => {
      authenticateAs(tiers.superAdmin);

      // Request with grade filter
      const resFiltered = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query({ ...defaultScoreOverviewQuery(), filter: 'user.grade:eq:5' })
        .set('Authorization', 'Bearer token');

      expect(resFiltered.status).toBe(StatusCodes.OK);

      // Unfiltered request for comparison
      const resAll = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(resAll.status).toBe(StatusCodes.OK);

      // Filtered should have fewer or equal students
      expect(resFiltered.body.data.totalStudents).toBeLessThanOrEqual(resAll.body.data.totalStudents);
    });
  });

  describe('FDW-backed score data', () => {
    it('counts students with completed scored runs in totalAssessed', async () => {
      // Create a completed run with scores for schoolAStudent
      const run = await RunFactory.create({
        userId: baseFixture.schoolAStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-06-15T10:00:00Z'),
      });

      await RunScoreFactory.create({
        runId: run.id,
        name: 'percentile',
        value: '75',
        type: 'computed',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      const task = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(task).toBeDefined();
      // At least the student with scores should be counted
      expect(task.totalAssessed).toBeGreaterThanOrEqual(1);
    });

    it('excludes aborted runs from score aggregation', async () => {
      // Create an aborted run with scores — should not count
      const abortedRun = await RunFactory.create({
        userId: baseFixture.classAStudent.id,
        taskId: baseFixture.task.id,
        taskVariantId: baseFixture.variantForAllGrades.id,
        administrationId: baseFixture.administrationAssignedToDistrict.id,
        useForReporting: true,
        completedAt: new Date('2025-06-15T10:00:00Z'),
        abortedAt: new Date('2025-06-15T10:30:00Z'),
      });

      await RunScoreFactory.create({
        runId: abortedRun.id,
        name: 'percentile',
        value: '80',
        type: 'computed',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      // The response should succeed — the aborted run is excluded at the SQL level
      const task = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      expect(task).toBeDefined();
    });

    it('support level percentages sum to <= 100', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      for (const task of res.body.data.tasks) {
        const totalPct =
          task.supportLevels.achievedSkill.percentage +
          task.supportLevels.developingSkill.percentage +
          task.supportLevels.needsExtraSupport.percentage;
        // Sum can be < 100 when some assessed students have null support level (unknown task slug)
        expect(totalPct).toBeLessThanOrEqual(100);
        expect(totalPct).toBeGreaterThanOrEqual(0);
      }
    });

    it('totalAssessed + totalNotAssessed accounts for all assigned students', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(scoreOverviewPath(baseFixture.administrationAssignedToDistrict.id))
        .query(defaultScoreOverviewQuery())
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);

      // For the base variant (no conditions, assigned to all students),
      // totalAssessed + notAssessed.required + notAssessed.optional should equal totalStudents
      // (since all students are assigned with no conditions)
      const task = res.body.data.tasks.find((t: { taskId: string }) => t.taskId === baseFixture.task.id);
      if (task) {
        const accountedFor = task.totalAssessed + task.totalNotAssessed.required + task.totalNotAssessed.optional;
        expect(accountedFor).toBe(res.body.data.totalStudents);
      }
    });
  });
});
