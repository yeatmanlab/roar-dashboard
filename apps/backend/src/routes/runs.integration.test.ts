/**
 * Route integration tests for /v1/runs endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization is tested by permission tier (resolved via OpenFGA):
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - siteAdmin:   site_administrator → 403
 *   - admin:       administrator → 403
 *   - educator:    teacher → 403
 *   - student:     student → 201 (only tier with can_create_run on administration)
 *   - caregiver:   guardian → 403
 *
 * Run events enforce strict ownership — only the run owner can post events.
 * Super admins do NOT bypass ownership checks for run events.
 *
 * Each endpoint section follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Error cases — 401 unauthenticated, 422/404/409 scenarios
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { faker } from '@faker-js/faker';
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

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerRunsRoutes } = await import('./runs');

  app = createTestApp(registerRunsRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);

  // Re-sync FGA tuples to pick up tier users created above
  const { syncFgaTuplesFromPostgres } = await import('../test-support/fga');
  await syncFgaTuplesFromPostgres();
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Builds a valid create-run request body. */
function buildCreateRunBody(overrides: Record<string, unknown> = {}) {
  return {
    taskVariantId: baseFixture.variantForAllGrades.id,
    taskVersion: '1.0.0',
    administrationId: baseFixture.administrationAssignedToDistrict.id,
    ...overrides,
  };
}

/**
 * Creates a run as the student tier user via HTTP POST and returns the run ID.
 * This ensures the run's userId matches the tier user's DB user ID (needed for
 * ownership checks on the event endpoint).
 */
async function createRunAsStudent(): Promise<string> {
  authenticateAs(tiers.student);
  const res = await request(app)
    .post(`/v1/user/${tiers.student.id}/runs`)
    .set('Authorization', 'Bearer token')
    .send(buildCreateRunBody());

  expect(res.status).toBe(StatusCodes.CREATED);
  return res.body.data.id;
}

/** Builds a complete event body. */
function buildCompleteEventBody() {
  return { type: 'complete' as const };
}

/** Builds an abort event body. */
function buildAbortEventBody() {
  return { type: 'abort' as const };
}

/** Builds a trial event body with minimal required fields. */
function buildTrialEventBody() {
  return {
    type: 'trial' as const,
    trial: {
      assessmentStage: 'test' as const,
      correct: 1,
    },
  };
}

/** Builds an engagement event body. */
function buildEngagementEventBody() {
  return {
    type: 'engagement' as const,
    engagementFlags: {},
    reliableRun: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/runs
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/user/:userId/runs', () => {
  const getPath = (userId: string) => `/v1/user/${userId}/runs`;

  describe('authorization', () => {
    it('student tier can create a run for themselves', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .post(getPath(tiers.student.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody());

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('superAdmin tier can create a run for any user', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .post(getPath(tiers.student.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody());

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.data.id).toEqual(expect.any(String));

      // Verify the run is owned by the target user, not the superAdmin
      const runId = res.body.data.id;
      const runRes = await request(app)
        .get(`/v1/user/${tiers.student.id}/runs/${runId}`)
        .set('Authorization', 'Bearer token');

      expect(runRes.status).toBe(StatusCodes.OK);
      expect(runRes.body.data.userId).toBe(tiers.student.id);
    });

    it('siteAdmin tier is forbidden from creating runs', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app)
        .post(getPath(tiers.siteAdmin.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier is forbidden from creating runs', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app)
        .post(getPath(tiers.admin.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier is forbidden from creating runs', async () => {
      authenticateAs(tiers.educator);
      const res = await request(app)
        .post(getPath(tiers.educator.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from creating runs', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app)
        .post(getPath(tiers.caregiver.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post(getPath(faker.string.uuid())).send(buildCreateRunBody());

      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 400 when isAnonymous is true and administrationId is provided', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .post(getPath(tiers.student.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody({ isAnonymous: true }));

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 422 when administrationId does not exist', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .post(getPath(tiers.student.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody({ administrationId: faker.string.uuid() }));

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
    });

    it('returns 422 when taskVariantId does not exist', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .post(getPath(tiers.student.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody({ taskVariantId: faker.string.uuid() }));

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(res.body.error.code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
    });

    it('returns 403 when student is in a different district', async () => {
      authenticateAs({ authId: baseFixture.districtBStudent.authId! });
      const res = await request(app)
        .post(getPath(baseFixture.districtBStudent.id))
        .set('Authorization', 'Bearer token')
        .send(buildCreateRunBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/runs/:runId/event
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/user/:userId/runs/:runId/event', () => {
  const eventPath = (userId: string, runId: string) => `/v1/user/${userId}/runs/${runId}/event`;

  describe('authorization — strict ownership', () => {
    it('run owner (student) can post an event', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildTrialEventBody());

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('ok');
    });

    it('superAdmin who does not own the run is forbidden', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildTrialEventBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('another student who does not own the run is forbidden', async () => {
      const runId = await createRunAsStudent();

      authenticateAs({ authId: baseFixture.districtBStudent.authId! });
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildTrialEventBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier who does not own the run is forbidden', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.admin);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildTrialEventBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('event types', () => {
    it('complete event returns 200', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildCompleteEventBody());

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('ok');
    });

    it('abort event returns 200', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildAbortEventBody());

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('ok');
    });

    it('trial event returns 200', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildTrialEventBody());

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('ok');
    });

    it('engagement event returns 200', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildEngagementEventBody());

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('ok');
    });
  });

  describe('state guards', () => {
    it('returns 409 when completing an already completed run', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildCompleteEventBody());

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildCompleteEventBody());

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when aborting an already completed run', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildCompleteEventBody());

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildAbortEventBody());

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when completing an already aborted run', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildAbortEventBody());

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildCompleteEventBody());

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });

    it('returns 409 when aborting an already aborted run', async () => {
      const runId = await createRunAsStudent();

      authenticateAs(tiers.student);
      await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildAbortEventBody());

      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, runId))
        .set('Authorization', 'Bearer token')
        .send(buildAbortEventBody());

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const runId = await createRunAsStudent();
      const res = await expectRoute('POST', eventPath(tiers.student.id, runId)).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when runId does not exist', async () => {
      authenticateAs(tiers.student);
      const res = await request(app)
        .post(eventPath(tiers.student.id, faker.string.uuid()))
        .set('Authorization', 'Bearer token')
        .send(buildTrialEventBody());

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });
  });
});
