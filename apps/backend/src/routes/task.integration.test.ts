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
import { TaskVariantRepository } from '../repositories/task-variant.repository';
import { TaskVariantParameterRepository } from '../repositories/task-variant-parameter.repository';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;
let taskVariantRepository: TaskVariantRepository;
let taskVariantParameterRepository: TaskVariantParameterRepository;

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerTasksRoutes } = await import('./task');

  app = createTestApp(registerTasksRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
  taskVariantRepository = new TaskVariantRepository();
  taskVariantParameterRepository = new TaskVariantParameterRepository();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /v1/tasks/:taskId/variants/:variantId
  // ═══════════════════════════════════════════════════════════════════════════

  describe('PATCH /v1/tasks/:taskId/variants/:variantId', () => {
    const taskId = () => baseFixture.task.id;
    const variantId = () => baseFixture.variantForAllGrades.id;
    const path = () => `/v1/tasks/${taskId()}/variants/${variantId()}`;

    describe('authorization', () => {
      it('superAdmin tier can update a task variant', async () => {
        authenticateAs(tiers.superAdmin);
        const res = await request(app)
          .patch(path())
          .set('Authorization', 'Bearer token')
          .send({ description: 'Updated description' });

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data.success).toBe(true);
      });

      it('siteAdmin tier is forbidden from updating task variants', async () => {
        authenticateAs(tiers.siteAdmin);
        const res = await request(app)
          .patch(path())
          .set('Authorization', 'Bearer token')
          .send({ description: 'Updated description' });

        expect(res.status).toBe(StatusCodes.FORBIDDEN);
        expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      });

      it('admin tier is forbidden from updating task variants', async () => {
        authenticateAs(tiers.admin);
        const res = await request(app)
          .patch(path())
          .set('Authorization', 'Bearer token')
          .send({ description: 'Updated description' });

        expect(res.status).toBe(StatusCodes.FORBIDDEN);
        expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      });

      it('educator tier is forbidden from updating task variants', async () => {
        authenticateAs(tiers.educator);
        const res = await request(app)
          .patch(path())
          .set('Authorization', 'Bearer token')
          .send({ description: 'Updated description' });

        expect(res.status).toBe(StatusCodes.FORBIDDEN);
        expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      });

      it('student tier is forbidden from updating task variants', async () => {
        authenticateAs(tiers.student);
        const res = await request(app)
          .patch(path())
          .set('Authorization', 'Bearer token')
          .send({ description: 'Updated description' });

        expect(res.status).toBe(StatusCodes.FORBIDDEN);
        expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      });

      it('caregiver tier is forbidden from updating task variants', async () => {
        authenticateAs(tiers.caregiver);
        const res = await request(app)
          .patch(path())
          .set('Authorization', 'Bearer token')
          .send({ description: 'Updated description' });

        expect(res.status).toBe(StatusCodes.FORBIDDEN);
        expect(res.body.error.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      });
    });

    describe('partial updates', () => {
      it('can update only the name', async () => {
        // Capture current state before update
        const variantBeforeUpdate = await taskVariantRepository.getById({ id: variantId() });
        expect(variantBeforeUpdate).not.toBeNull();

        const uniqueName = `Updated Name ${Date.now()}`;
        authenticateAs(tiers.superAdmin);
        const res = await request(app).patch(path()).set('Authorization', 'Bearer token').send({ name: uniqueName });

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data.success).toBe(true);

        // Verify database state
        const updatedVariant = await taskVariantRepository.getById({ id: variantId() });
        expect(updatedVariant).not.toBeNull();
        expect(updatedVariant!.name).toBe(uniqueName);

        // Verify other fields were not changed
        expect(updatedVariant!.description).toBe(variantBeforeUpdate!.description);
        expect(updatedVariant!.status).toBe(variantBeforeUpdate!.status);
        expect(updatedVariant!.taskId).toBe(variantBeforeUpdate!.taskId);
      });

      it('can update only the description', async () => {
        // Capture current state before update
        const variantBeforeUpdate = await taskVariantRepository.getById({ id: variantId() });
        expect(variantBeforeUpdate).not.toBeNull();

        const newDescription = 'Only description changed';
        authenticateAs(tiers.superAdmin);
        const res = await request(app)
          .patch(path())
          .set('Authorization', 'Bearer token')
          .send({ description: newDescription });

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data.success).toBe(true);

        // Verify database state
        const updatedVariant = await taskVariantRepository.getById({ id: variantId() });
        expect(updatedVariant).not.toBeNull();
        expect(updatedVariant!.description).toBe(newDescription);

        // Verify other fields were not changed
        expect(updatedVariant!.name).toBe(variantBeforeUpdate!.name);
        expect(updatedVariant!.status).toBe(variantBeforeUpdate!.status);
        expect(updatedVariant!.taskId).toBe(variantBeforeUpdate!.taskId);
      });

      it('can update only the status', async () => {
        // Capture current state before update
        const variantBeforeUpdate = await taskVariantRepository.getById({ id: variantId() });
        expect(variantBeforeUpdate).not.toBeNull();

        const newStatus = 'published';
        authenticateAs(tiers.superAdmin);
        const res = await request(app).patch(path()).set('Authorization', 'Bearer token').send({ status: newStatus });

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data.success).toBe(true);

        // Verify database state
        const updatedVariant = await taskVariantRepository.getById({ id: variantId() });
        expect(updatedVariant).not.toBeNull();
        expect(updatedVariant!.status).toBe(newStatus);

        // Verify other fields were not changed
        expect(updatedVariant!.name).toBe(variantBeforeUpdate!.name);
        expect(updatedVariant!.description).toBe(variantBeforeUpdate!.description);
        expect(updatedVariant!.taskId).toBe(variantBeforeUpdate!.taskId);
      });

      it('can update only the parameters', async () => {
        // Capture current state before update
        const variantBeforeUpdate = await taskVariantRepository.getById({ id: variantId() });
        expect(variantBeforeUpdate).not.toBeNull();

        const newParameters = [{ name: 'newParam', value: 'newValue' }];
        authenticateAs(tiers.superAdmin);
        const res = await request(app)
          .patch(path())
          .set('Authorization', 'Bearer token')
          .send({ parameters: newParameters });

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data.success).toBe(true);

        // Verify database state
        const updatedVariant = await taskVariantRepository.getById({ id: variantId() });
        expect(updatedVariant).not.toBeNull();

        // Verify parameters were updated
        const updatedParameters = await taskVariantParameterRepository.getByTaskVariantId(variantId());
        expect(updatedParameters).toHaveLength(1);
        expect(updatedParameters[0]!.name).toBe('newParam');
        expect(updatedParameters[0]!.value).toBe('newValue');

        // Verify other fields were not changed
        expect(updatedVariant!.name).toBe(variantBeforeUpdate!.name);
        expect(updatedVariant!.description).toBe(variantBeforeUpdate!.description);
        expect(updatedVariant!.status).toBe(variantBeforeUpdate!.status);
        expect(updatedVariant!.taskId).toBe(variantBeforeUpdate!.taskId);
      });

      it('can delete all parameters by sending empty array', async () => {
        // Capture current state before update
        const variantBeforeUpdate = await taskVariantRepository.getById({ id: variantId() });
        expect(variantBeforeUpdate).not.toBeNull();

        // First, ensure there are some parameters
        const parametersBefore = await taskVariantParameterRepository.getByTaskVariantId(variantId());
        // If there are no parameters, add some first
        if (parametersBefore.length === 0) {
          authenticateAs(tiers.superAdmin);
          await request(app)
            .patch(path())
            .set('Authorization', 'Bearer token')
            .send({ parameters: [{ name: 'tempParam', value: 'tempValue' }] });
        }

        // Now delete all parameters by sending empty array
        authenticateAs(tiers.superAdmin);
        const res = await request(app).patch(path()).set('Authorization', 'Bearer token').send({ parameters: [] });

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data.success).toBe(true);

        // Verify database state
        const updatedVariant = await taskVariantRepository.getById({ id: variantId() });
        expect(updatedVariant).not.toBeNull();

        // Verify all parameters were deleted
        const updatedParameters = await taskVariantParameterRepository.getByTaskVariantId(variantId());
        expect(updatedParameters).toHaveLength(0);

        // Verify other fields were not changed
        expect(updatedVariant!.name).toBe(variantBeforeUpdate!.name);
        expect(updatedVariant!.description).toBe(variantBeforeUpdate!.description);
        expect(updatedVariant!.status).toBe(variantBeforeUpdate!.status);
        expect(updatedVariant!.taskId).toBe(variantBeforeUpdate!.taskId);
      });

      it('can update multiple fields at once', async () => {
        const uniqueName = `Multi Update ${Date.now()}`;
        const newDescription = 'Multi-field update';
        const newStatus = 'published';
        const newParameters = [{ name: 'multiParam', value: 'multiValue' }];

        authenticateAs(tiers.superAdmin);
        const res = await request(app).patch(path()).set('Authorization', 'Bearer token').send({
          name: uniqueName,
          description: newDescription,
          status: newStatus,
          parameters: newParameters,
        });

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data.success).toBe(true);

        // Verify database state
        const updatedVariant = await taskVariantRepository.getById({ id: variantId() });
        expect(updatedVariant).not.toBeNull();
        expect(updatedVariant!.name).toBe(uniqueName);
        expect(updatedVariant!.description).toBe(newDescription);
        expect(updatedVariant!.status).toBe(newStatus);

        // Verify parameters were updated
        const updatedParameters = await taskVariantParameterRepository.getByTaskVariantId(variantId());
        expect(updatedParameters).toHaveLength(1);
        expect(updatedParameters[0]!.name).toBe('multiParam');
        expect(updatedParameters[0]!.value).toBe('multiValue');
      });
    });

    describe('error cases', () => {
      it('returns 401 when unauthenticated', async () => {
        const res = await expectRoute('PATCH', path()).unauthenticated().toReturn(401);

        expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
      });

      it('returns 404 when task does not exist', async () => {
        authenticateAs(tiers.superAdmin);
        const res = await request(app)
          .patch(`/v1/tasks/${faker.string.uuid()}/variants/${variantId()}`)
          .set('Authorization', 'Bearer token')
          .send({ description: 'Updated' });

        expect(res.status).toBe(StatusCodes.NOT_FOUND);
        expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });

      it('returns 404 when variant does not exist', async () => {
        authenticateAs(tiers.superAdmin);
        const res = await request(app)
          .patch(`/v1/tasks/${taskId()}/variants/${faker.string.uuid()}`)
          .set('Authorization', 'Bearer token')
          .send({ description: 'Updated' });

        expect(res.status).toBe(StatusCodes.NOT_FOUND);
        expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });

      it('returns 404 when variant exists but belongs to different task', async () => {
        // Create a variant for the base task
        authenticateAs(tiers.superAdmin);
        const createRes = await request(app)
          .post(`/v1/tasks/${taskId()}/variants`)
          .set('Authorization', 'Bearer token')
          .send(buildVariantBody());

        expect(createRes.status).toBe(StatusCodes.CREATED);
        const createdVariantId = createRes.body.data.id;

        // Try to update it using a different task ID
        authenticateAs(tiers.superAdmin);
        const updateRes = await request(app)
          .patch(`/v1/tasks/${faker.string.uuid()}/variants/${createdVariantId}`)
          .set('Authorization', 'Bearer token')
          .send({ description: 'Should fail' });

        expect(updateRes.status).toBe(StatusCodes.NOT_FOUND);
        expect(updateRes.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      });

      it('returns 409 when updating name to duplicate', async () => {
        const duplicateName = `Duplicate Update ${Date.now()}`;

        // Create first variant with unique name
        authenticateAs(tiers.superAdmin);
        const first = await request(app)
          .post(`/v1/tasks/${taskId()}/variants`)
          .set('Authorization', 'Bearer token')
          .send(buildVariantBody({ name: duplicateName }));

        expect(first.status).toBe(StatusCodes.CREATED);

        // Create second variant with different name
        authenticateAs(tiers.superAdmin);
        const second = await request(app)
          .post(`/v1/tasks/${taskId()}/variants`)
          .set('Authorization', 'Bearer token')
          .send(buildVariantBody());

        expect(second.status).toBe(StatusCodes.CREATED);
        const secondVariantId = second.body.data.id;

        // Try to update second variant's name to duplicate first
        authenticateAs(tiers.superAdmin);
        const updateRes = await request(app)
          .patch(`/v1/tasks/${taskId()}/variants/${secondVariantId}`)
          .set('Authorization', 'Bearer token')
          .send({ name: duplicateName });

        expect(updateRes.status).toBe(StatusCodes.CONFLICT);
        expect(updateRes.body.error.code).toBe(ApiErrorCode.RESOURCE_CONFLICT);
      });

      it('allows updating name to same name (no-op)', async () => {
        const originalName = `Same Name Update ${Date.now()}`;

        // Create variant
        authenticateAs(tiers.superAdmin);
        const createRes = await request(app)
          .post(`/v1/tasks/${taskId()}/variants`)
          .set('Authorization', 'Bearer token')
          .send(buildVariantBody({ name: originalName }));

        expect(createRes.status).toBe(StatusCodes.CREATED);
        const createdVariantId = createRes.body.data.id;

        // Update to same name should succeed
        authenticateAs(tiers.superAdmin);
        const updateRes = await request(app)
          .patch(`/v1/tasks/${taskId()}/variants/${createdVariantId}`)
          .set('Authorization', 'Bearer token')
          .send({ name: originalName });

        expect(updateRes.status).toBe(StatusCodes.OK);
        expect(updateRes.body.data.success).toBe(true);
      });
    });
  });
});
