/**
 * Route integration tests for /v1/tasks endpoints.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization is tested by permission tier (matching RolePermissions groupings):
 *   - superAdmin:  isSuperAdmin=true (bypasses all access control)
 *   - siteAdmin:   site_administrator → 403
 *   - admin:       administrator → 403
 *   - educator:    teacher → 403
 *   - student:     student → 403
 *   - caregiver:   guardian → 403
 *
 * The createTaskVariant endpoint is restricted to super admins only.
 *
 * Each endpoint section follows the structure:
 *   1. Authorization — one spec per tier with status + content assertions
 *   2. Error cases — 401 unauthenticated, 404 not found, 409 conflict
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
  const { registerTasksRoutes } = await import('./task');

  app = createTestApp(registerTasksRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Counter to generate unique variant names across tests. */
let variantCounter = 0;

/** Builds a valid create-task-variant request body with a unique name. */
function buildVariantBody(overrides: Record<string, unknown> = {}) {
  variantCounter += 1;
  return {
    name: `Test Variant ${variantCounter}`,
    description: 'A test variant created by integration tests',
    status: 'draft',
    parameters: [{ name: 'difficulty', value: 'easy' }],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /v1/tasks/:taskId/variants
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/tasks/:taskId/variants', () => {
  const taskId = () => baseFixture.task.id;
  const path = () => `/v1/tasks/${taskId()}/variants`;

  describe('authorization', () => {
    it('superAdmin tier can create a task variant', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).post(path()).set('Authorization', 'Bearer token').send(buildVariantBody());

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.data.id).toEqual(expect.any(String));
    });

    it('siteAdmin tier is forbidden from creating task variants', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app).post(path()).set('Authorization', 'Bearer token').send(buildVariantBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('admin tier is forbidden from creating task variants', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app).post(path()).set('Authorization', 'Bearer token').send(buildVariantBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('educator tier is forbidden from creating task variants', async () => {
      authenticateAs(tiers.educator);
      const res = await request(app).post(path()).set('Authorization', 'Bearer token').send(buildVariantBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('student tier is forbidden from creating task variants', async () => {
      authenticateAs(tiers.student);
      const res = await request(app).post(path()).set('Authorization', 'Bearer token').send(buildVariantBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });

    it('caregiver tier is forbidden from creating task variants', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app).post(path()).set('Authorization', 'Bearer token').send(buildVariantBody());

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('POST', path()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when task does not exist', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .post(`/v1/tasks/${faker.string.uuid()}/variants`)
        .set('Authorization', 'Bearer token')
        .send(buildVariantBody());

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 409 when variant name already exists for the task', async () => {
      const duplicateName = `Duplicate Variant ${Date.now()}`;

      // Create the first variant
      authenticateAs(tiers.superAdmin);
      const first = await request(app)
        .post(path())
        .set('Authorization', 'Bearer token')
        .send(buildVariantBody({ name: duplicateName }));

      expect(first.status).toBe(StatusCodes.CREATED);

      // Attempt to create another with the same name
      authenticateAs(tiers.superAdmin);
      const second = await request(app)
        .post(path())
        .set('Authorization', 'Bearer token')
        .send(buildVariantBody({ name: duplicateName }));

      expect(second.status).toBe(StatusCodes.CONFLICT);
      expect(second.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
    });
  });
});
