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
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { TaskFactory } from '../test-support/factories/task.factory';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;
let taskVariantRepository: TaskVariantRepository;
let taskVariantParameterRepository: TaskVariantParameterRepository;
let testTaskId: string;
let testVariantId: string;

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

  // Create test fixtures for getTaskVariant tests
  const testTask = await TaskFactory.create();
  testTaskId = testTask.id;
  const testVariant = await TaskVariantFactory.create({ taskId: testTask.id });
  testVariantId = testVariant.id;
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
// GET /v1/tasks/:taskId
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/tasks/:taskId', () => {
  const taskId = () => baseFixture.task.id;
  const path = () => `/v1/tasks/${taskId()}`;

  describe('authorization', () => {
    it('superAdmin tier can get a task by ID', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.id).toBe(taskId());
      expect(res.body.data.slug).toBe(baseFixture.task.slug);
      expect(res.body.data.name).toBe(baseFixture.task.name);
    });

    it('siteAdmin tier can get a task by ID', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.id).toBe(taskId());
    });

    it('admin tier can get a task by ID', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.id).toBe(taskId());
    });

    it('educator tier can get a task by ID', async () => {
      authenticateAs(tiers.educator);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.id).toBe(taskId());
    });

    it('student tier can get a task by ID', async () => {
      authenticateAs(tiers.student);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.id).toBe(taskId());
    });

    it('caregiver tier can get a task by ID', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.id).toBe(taskId());
    });
  });

  describe('response structure', () => {
    it('returns all expected task fields', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toMatchObject({
        id: taskId(),
        slug: baseFixture.task.slug,
        name: baseFixture.task.name,
        nameSimple: baseFixture.task.nameSimple,
        nameTechnical: baseFixture.task.nameTechnical,
      });
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('image');
      expect(res.body.data).toHaveProperty('tutorialVideo');
      expect(res.body.data).toHaveProperty('taskConfig');
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
    });

    it('returns ISO date strings for timestamps', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      // createdAt should be a valid ISO date string
      expect(new Date(res.body.data.createdAt).toISOString()).toBe(res.body.data.createdAt);
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', path()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when task does not exist', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(`/v1/tasks/${faker.string.uuid()}`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 400 when taskId is not a valid UUID', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get('/v1/tasks/not-a-valid-uuid').set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });
});

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

      expect(res.status).toBe(StatusCodes.NO_CONTENT);
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

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

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

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

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

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

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

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

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

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

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

    it('can clear name by setting it to null', async () => {
      // First ensure the variant has a name set
      const uniqueName = `Name Before Null ${Date.now()}`;
      authenticateAs(tiers.superAdmin);
      await request(app).patch(path()).set('Authorization', 'Bearer token').send({ name: uniqueName });

      const variantWithName = await taskVariantRepository.getById({ id: variantId() });
      expect(variantWithName!.name).toBe(uniqueName);

      // Clear the name by setting it to null
      authenticateAs(tiers.superAdmin);
      const res = await request(app).patch(path()).set('Authorization', 'Bearer token').send({ name: null });

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

      // Verify name is null in the database
      const updatedVariant = await taskVariantRepository.getById({ id: variantId() });
      expect(updatedVariant).not.toBeNull();
      expect(updatedVariant!.name).toBeNull();

      // Verify other fields were not changed
      expect(updatedVariant!.description).toBe(variantWithName!.description);
      expect(updatedVariant!.status).toBe(variantWithName!.status);
      expect(updatedVariant!.taskId).toBe(variantWithName!.taskId);
    });

    it('can clear description by setting it to null', async () => {
      // First ensure the variant has a description set
      const newDescription = `Description Before Null ${Date.now()}`;
      authenticateAs(tiers.superAdmin);
      await request(app).patch(path()).set('Authorization', 'Bearer token').send({ description: newDescription });

      const variantWithDescription = await taskVariantRepository.getById({ id: variantId() });
      expect(variantWithDescription!.description).toBe(newDescription);

      // Clear the description by setting it to null
      authenticateAs(tiers.superAdmin);
      const res = await request(app).patch(path()).set('Authorization', 'Bearer token').send({ description: null });

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

      // Verify description is null in the database
      const updatedVariant = await taskVariantRepository.getById({ id: variantId() });
      expect(updatedVariant).not.toBeNull();
      expect(updatedVariant!.description).toBeNull();

      // Verify other fields were not changed
      expect(updatedVariant!.name).toBe(variantWithDescription!.name);
      expect(updatedVariant!.status).toBe(variantWithDescription!.status);
      expect(updatedVariant!.taskId).toBe(variantWithDescription!.taskId);
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

      expect(res.status).toBe(StatusCodes.NO_CONTENT);

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

      expect(updateRes.status).toBe(StatusCodes.NO_CONTENT);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/tasks/:taskId/variants
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/tasks/:taskId/variants', () => {
  const taskId = () => baseFixture.task.id;
  const path = () => `/v1/tasks/${taskId()}/variants`;

  describe('authorization and status filtering', () => {
    it('super admin can see all variants regardless of status', async () => {
      const draftVariant = await TaskVariantFactory.create({
        taskId: taskId(),
        name: `Draft Variant ${Date.now()}`,
        status: 'draft',
      });
      const publishedVariant = await TaskVariantFactory.create({
        taskId: taskId(),
        name: `Published Variant ${Date.now()}`,
        status: 'published',
      });
      const deprecatedVariant = await TaskVariantFactory.create({
        taskId: taskId(),
        name: `Deprecated Variant ${Date.now()}`,
        status: 'deprecated',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const variantIds = res.body.data.items.map((v: { id: string }) => v.id);
      expect(variantIds).toContain(draftVariant.id);
      expect(variantIds).toContain(publishedVariant.id);
      expect(variantIds).toContain(deprecatedVariant.id);
    });

    it('super admin can filter by status query param', async () => {
      const testTask = await TaskFactory.create({ slug: `status-filter-test-${Date.now()}` });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Draft ${Date.now()}`,
        status: 'draft',
      });
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Published ${Date.now()}`,
        status: 'published',
      });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Deprecated ${Date.now()}`,
        status: 'deprecated',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants`)
        .query({ status: 'published' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(publishedVariant.id);
    });

    it('super admin can filter by draft status', async () => {
      const testTask = await TaskFactory.create({ slug: `draft-filter-test-${Date.now()}` });
      const draftVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Draft ${Date.now()}`,
        status: 'draft',
      });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Published ${Date.now()}`,
        status: 'published',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants`)
        .query({ status: 'draft' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(draftVariant.id);
    });

    it('non-super admin status filter is ignored (always returns published)', async () => {
      const testTask = await TaskFactory.create({ slug: `ignore-status-test-${Date.now()}` });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Draft ${Date.now()}`,
        status: 'draft',
      });
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Published ${Date.now()}`,
        status: 'published',
      });

      // Even if non-super admin tries to filter by draft, they should only see published
      authenticateAs(tiers.admin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants`)
        .query({ status: 'draft' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe(publishedVariant.id);
    });

    it('siteAdmin tier can only see published variants', async () => {
      // Create a task with known variants for this test
      const testTask = await TaskFactory.create({ slug: `site-admin-test-${Date.now()}` });
      const draftVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Draft ${Date.now()}`,
        status: 'draft',
      });
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Published ${Date.now()}`,
        status: 'published',
      });

      authenticateAs(tiers.siteAdmin);
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const variantIds = res.body.data.items.map((v: { id: string }) => v.id);
      expect(variantIds).toContain(publishedVariant.id);
      expect(variantIds).not.toContain(draftVariant.id);
    });

    it('admin tier can only see published variants', async () => {
      const testTask = await TaskFactory.create({ slug: `admin-test-${Date.now()}` });
      const draftVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Draft ${Date.now()}`,
        status: 'draft',
      });
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Published ${Date.now()}`,
        status: 'published',
      });

      authenticateAs(tiers.admin);
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const variantIds = res.body.data.items.map((v: { id: string }) => v.id);
      expect(variantIds).toContain(publishedVariant.id);
      expect(variantIds).not.toContain(draftVariant.id);
    });

    it('educator tier can only see published variants', async () => {
      const testTask = await TaskFactory.create({ slug: `educator-test-${Date.now()}` });
      const draftVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Draft ${Date.now()}`,
        status: 'draft',
      });
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Published ${Date.now()}`,
        status: 'published',
      });

      authenticateAs(tiers.educator);
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const variantIds = res.body.data.items.map((v: { id: string }) => v.id);
      expect(variantIds).toContain(publishedVariant.id);
      expect(variantIds).not.toContain(draftVariant.id);
    });

    it('student tier can only see published variants', async () => {
      const testTask = await TaskFactory.create({ slug: `student-test-${Date.now()}` });
      const draftVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Draft ${Date.now()}`,
        status: 'draft',
      });
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Published ${Date.now()}`,
        status: 'published',
      });

      authenticateAs(tiers.student);
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const variantIds = res.body.data.items.map((v: { id: string }) => v.id);
      expect(variantIds).toContain(publishedVariant.id);
      expect(variantIds).not.toContain(draftVariant.id);
    });

    it('caregiver tier can only see published variants', async () => {
      const testTask = await TaskFactory.create({ slug: `caregiver-test-${Date.now()}` });
      const draftVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Draft ${Date.now()}`,
        status: 'draft',
      });
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Published ${Date.now()}`,
        status: 'published',
      });

      authenticateAs(tiers.caregiver);
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const variantIds = res.body.data.items.map((v: { id: string }) => v.id);
      expect(variantIds).toContain(publishedVariant.id);
      expect(variantIds).not.toContain(draftVariant.id);
    });
  });

  describe('response structure', () => {
    it('returns paginated response with correct structure', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(path()).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.pagination).toHaveProperty('page');
      expect(res.body.data.pagination).toHaveProperty('perPage');
      expect(res.body.data.pagination).toHaveProperty('totalItems');
      expect(res.body.data.pagination).toHaveProperty('totalPages');
    });

    it('returns all expected variant fields', async () => {
      const testTask = await TaskFactory.create({ slug: `fields-test-${Date.now()}` });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Fields Test ${Date.now()}`,
        description: 'Test description',
        status: 'published',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      const variant = res.body.data.items[0];
      expect(variant).toHaveProperty('id');
      expect(variant).toHaveProperty('taskId');
      expect(variant).toHaveProperty('name');
      expect(variant).toHaveProperty('description');
      expect(variant).toHaveProperty('status');
      expect(variant).toHaveProperty('createdAt');
      expect(variant).toHaveProperty('updatedAt');
      // Task fields should be included
      expect(variant).toHaveProperty('taskName');
      expect(variant).toHaveProperty('taskSlug');
      expect(variant).toHaveProperty('taskImage');
      // Parameters should be included
      expect(variant).toHaveProperty('parameters');
      expect(Array.isArray(variant.parameters)).toBe(true);
    });

    it('returns correct task info for each variant', async () => {
      const taskName = `Task Name ${Date.now()}`;
      const taskSlug = `task-slug-${Date.now()}`;
      const taskImage = 'https://example.com/image.png';
      const testTask = await TaskFactory.create({ name: taskName, slug: taskSlug, image: taskImage });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Variant ${Date.now()}`,
        status: 'published',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      const variant = res.body.data.items[0];
      expect(variant.taskName).toBe(taskName);
      expect(variant.taskSlug).toBe(taskSlug);
      expect(variant.taskImage).toBe(taskImage);
    });

    it('returns variant parameters as array of name-value objects', async () => {
      const testTask = await TaskFactory.create({ slug: `params-test-${Date.now()}` });

      // Create variant via API to also create parameters
      authenticateAs(tiers.superAdmin);
      const createRes = await request(app)
        .post(`/v1/tasks/${testTask.id}/variants`)
        .set('Authorization', 'Bearer token')
        .send({
          name: `Params Variant ${Date.now()}`,
          description: 'Variant with parameters',
          status: 'published',
          parameters: [
            { name: 'difficulty', value: 'hard' },
            { name: 'timeLimit', value: 120 },
            { name: 'hints', value: true },
          ],
        });

      expect(createRes.status).toBe(StatusCodes.CREATED);

      // Fetch variants and verify parameters
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      const variant = res.body.data.items[0];
      expect(Array.isArray(variant.parameters)).toBe(true);
      expect(variant.parameters).toEqual(
        expect.arrayContaining([
          { name: 'difficulty', value: 'hard' },
          { name: 'timeLimit', value: 120 },
          { name: 'hints', value: true },
        ]),
      );
    });
  });

  describe('pagination', () => {
    it('respects perPage limit', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(path()).query({ perPage: 2 }).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.perPage).toBe(2);
    });

    it('returns correct page', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(path()).query({ page: 1, perPage: 1 }).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.pagination.page).toBe(1);
    });
  });

  describe('search', () => {
    it('searches by variant name', async () => {
      const uniqueName = `UniqueSearchName${Date.now()}`;
      const testTask = await TaskFactory.create({ slug: `search-name-test-${Date.now()}` });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: uniqueName,
        status: 'published',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants`)
        .query({ search: uniqueName })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items.some((v: { name: string }) => v.name === uniqueName)).toBe(true);
    });

    it('searches by variant description', async () => {
      const uniqueDescription = `UniqueSearchDescription${Date.now()}`;
      const testTask = await TaskFactory.create({ slug: `search-desc-test-${Date.now()}` });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: `Variant ${Date.now()}`,
        description: uniqueDescription,
        status: 'published',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants`)
        .query({ search: uniqueDescription })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items.some((v: { description: string }) => v.description === uniqueDescription)).toBe(true);
    });

    it('search is case-insensitive', async () => {
      const uniqueName = `CaseInsensitiveTest${Date.now()}`;
      const testTask = await TaskFactory.create({ slug: `case-test-${Date.now()}` });
      await TaskVariantFactory.create({
        taskId: testTask.id,
        name: uniqueName,
        status: 'published',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants`)
        .query({ search: uniqueName.toLowerCase() })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.some((v: { name: string }) => v.name === uniqueName)).toBe(true);
    });
  });

  describe('sorting', () => {
    it('sorts by name ascending by default', async () => {
      const testTask = await TaskFactory.create({ slug: `sort-test-${Date.now()}` });
      await TaskVariantFactory.create({ taskId: testTask.id, name: 'ZZZ Variant', status: 'published' });
      await TaskVariantFactory.create({ taskId: testTask.id, name: 'AAA Variant', status: 'published' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(`/v1/tasks/${testTask.id}/variants`).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
      // First item should be alphabetically before or equal to second
      const names = res.body.data.items.map((v: { name: string }) => v.name);
      for (let i = 1; i < names.length; i++) {
        expect(names[i - 1].toLowerCase() <= names[i].toLowerCase()).toBe(true);
      }
    });

    it('sorts by createdAt descending when specified', async () => {
      const testTask = await TaskFactory.create({ slug: `sort-created-test-${Date.now()}` });
      await TaskVariantFactory.create({ taskId: testTask.id, name: 'First Created', status: 'published' });
      await TaskVariantFactory.create({ taskId: testTask.id, name: 'Second Created', status: 'published' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants`)
        .query({ sortBy: 'createdAt', sortOrder: 'desc' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
      const createdAts = res.body.data.items.map((v: { createdAt: string }) => new Date(v.createdAt).getTime());
      for (let i = 1; i < createdAts.length; i++) {
        expect(createdAts[i - 1] >= createdAts[i]).toBe(true);
      }
    });
  });

  describe('error cases', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await expectRoute('GET', path()).unauthenticated().toReturn(401);

      expect(res.body.error.code).toBe(ApiErrorCode.AUTH_REQUIRED);
    });

    it('returns 404 when task does not exist', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${faker.string.uuid()}/variants`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.error.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
    });

    it('returns 400 when taskId is not a valid UUID', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get('/v1/tasks/not-a-valid-uuid/variants').set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/tasks/:taskId/variants/:variantId
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/tasks/:taskId/variants/:variantId', () => {
  describe('successful retrieval', () => {
    it('returns 200 with variant when accessed by task UUID', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTaskId}/variants/${testVariantId}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toHaveProperty('id', testVariantId);
      expect(res.body.data).toHaveProperty('taskId', testTaskId);
    });

    it('returns 200 with variant when accessed by task slug', async () => {
      const testTask = await TaskFactory.create({ slug: `get-variant-test-${Date.now()}` });
      const testVariant = await TaskVariantFactory.create({ taskId: testTask.id });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.slug}/variants/${testVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toHaveProperty('id', testVariant.id);
      expect(res.body.data).toHaveProperty('taskId', testTask.id);
    });

    it('returns all expected variant fields', async () => {
      const testTask = await TaskFactory.create();
      const testVariant = await TaskVariantFactory.create({ taskId: testTask.id });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${testVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('taskId');
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
      expect(res.body.data).toHaveProperty('taskName');
      expect(res.body.data).toHaveProperty('taskSlug');
      expect(res.body.data).toHaveProperty('taskImage');
      expect(res.body.data).toHaveProperty('parameters');
    });

    it('returns ISO date strings for timestamps', async () => {
      const testTask = await TaskFactory.create();
      const testVariant = await TaskVariantFactory.create({ taskId: testTask.id });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${testVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      if (res.body.data.updatedAt) {
        expect(res.body.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('returns variant parameters as array of name-value objects', async () => {
      const testTask = await TaskFactory.create();
      authenticateAs(tiers.superAdmin);
      const createRes = await request(app)
        .post(`/v1/tasks/${testTask.id}/variants`)
        .set('Authorization', 'Bearer token')
        .send({
          name: `variant-with-params-${Date.now()}`,
          description: 'Test variant with parameters',
          status: 'published',
          parameters: [
            { name: 'difficulty', value: 'hard' },
            { name: 'timeLimit', value: 60 },
            { name: 'shuffleItems', value: true },
          ],
        });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${createRes.body.data.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.body.data.parameters).toHaveLength(3);
      expect(res.body.data.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'difficulty', value: 'hard' }),
          expect.objectContaining({ name: 'timeLimit', value: 60 }),
          expect.objectContaining({ name: 'shuffleItems', value: true }),
        ]),
      );
    });

    it('returns correct task info denormalized with variant', async () => {
      const testTask = await TaskFactory.create({
        name: 'Reading Task',
        slug: 'reading-task',
        image: 'https://example.com/image.jpg',
      });
      const testVariant = await TaskVariantFactory.create({ taskId: testTask.id });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${testVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.body.data.taskName).toBe('Reading Task');
      expect(res.body.data.taskSlug).toBe('reading-task');
      expect(res.body.data.taskImage).toBe('https://example.com/image.jpg');
    });
  });

  describe('authorization and status filtering', () => {
    it('super admin can see published variant', async () => {
      const testTask = await TaskFactory.create();
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        status: 'published',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${publishedVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('published');
    });

    it('super admin can see draft variant', async () => {
      const testTask = await TaskFactory.create();
      const draftVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        status: 'draft',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${draftVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('draft');
    });

    it('super admin can see deprecated variant', async () => {
      const testTask = await TaskFactory.create();
      const deprecatedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        status: 'deprecated',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${deprecatedVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('deprecated');
    });

    it('non-super admin can see published variant', async () => {
      const testTask = await TaskFactory.create();
      const publishedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        status: 'published',
      });

      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${publishedVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.status).toBe('published');
    });

    it('non-super admin cannot see draft variant', async () => {
      const testTask = await TaskFactory.create();
      const draftVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        status: 'draft',
      });

      authenticateAs(tiers.educator);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${draftVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });

    it('non-super admin cannot see deprecated variant', async () => {
      const testTask = await TaskFactory.create();
      const deprecatedVariant = await TaskVariantFactory.create({
        taskId: testTask.id,
        status: 'deprecated',
      });

      authenticateAs(tiers.student);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/${deprecatedVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });
  });

  describe('error cases', () => {
    it('returns 404 when task does not exist', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/00000000-0000-0000-0000-000000000000/variants/${testVariantId}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });

    it('returns 404 when variant does not exist', async () => {
      const testTask = await TaskFactory.create();

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${testTask.id}/variants/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });

    it('returns 404 when variant belongs to different task', async () => {
      const task1 = await TaskFactory.create();
      const task2 = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({ taskId: task2.id });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(`/v1/tasks/${task1.id}/variants/${variant.id}`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });
  });

  describe('lookup by slug', () => {
    it('task slug is case-sensitive', async () => {
      const uniqueSlug = `reading-task-${Date.now()}`;
      const testTask = await TaskFactory.create({ slug: uniqueSlug });
      const testVariant = await TaskVariantFactory.create({ taskId: testTask.id });

      authenticateAs(tiers.superAdmin);

      // Test with correct lowercase slug - should succeed
      const resLower = await request(app)
        .get(`/v1/tasks/${uniqueSlug}/variants/${testVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(resLower.status).toBe(StatusCodes.OK);
      expect(resLower.body.data.id).toBe(testVariant.id);

      // Test with uppercase - should fail (not found)
      const resUpper = await request(app)
        .get(`/v1/tasks/${uniqueSlug.toUpperCase()}/variants/${testVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(resUpper.status).toBe(StatusCodes.NOT_FOUND);

      // Test with mixed case - should fail (not found)
      const resMixed = await request(app)
        .get(`/v1/tasks/${uniqueSlug.charAt(0).toUpperCase()}${uniqueSlug.slice(1)}/variants/${testVariant.id}`)
        .set('Authorization', 'Bearer token');

      expect(resMixed.status).toBe(StatusCodes.NOT_FOUND);
    });
  });
});
