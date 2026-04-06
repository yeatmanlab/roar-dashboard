/**
 * Route integration tests for GET /v1/task-variants.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization behavior:
 *   - superAdmin:  200 — only tier with access
 *   - siteAdmin:   403
 *   - admin:       403
 *   - educator:    403
 *   - student:     403
 *   - caregiver:   403
 *   - unauthenticated: 401
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import { authenticateAs, createTestApp, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { TaskVariantParameterFactory } from '../test-support/factories/task-variant-parameter.factory';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

const PATH = '/v1/task-variants';

let app: express.Application;
let tiers: TierUsers;

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerTaskVariantsRoutes } = await import('./task-variants');
  app = createTestApp(registerTaskVariantsRoutes);
  tiers = await createTierUsers(baseFixture.district.id);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/task-variants
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/task-variants', () => {
  describe('authorization', () => {
    it('superAdmin tier receives 200', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(PATH).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
    });

    it('siteAdmin tier receives 403', async () => {
      authenticateAs(tiers.siteAdmin);
      const res = await request(app).get(PATH).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('admin tier receives 403', async () => {
      authenticateAs(tiers.admin);
      const res = await request(app).get(PATH).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('educator tier receives 403', async () => {
      authenticateAs(tiers.educator);
      const res = await request(app).get(PATH).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('student tier receives 403', async () => {
      authenticateAs(tiers.student);
      const res = await request(app).get(PATH).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('caregiver tier receives 403', async () => {
      authenticateAs(tiers.caregiver);
      const res = await request(app).get(PATH).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('unauthenticated request receives 401', async () => {
      const res = await request(app).get(PATH);

      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('response structure', () => {
    it('returns paginated items with all expected fields', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get(PATH).set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.pagination).toMatchObject({
        page: 1,
        perPage: expect.any(Number),
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('returns only published variants', async () => {
      const task = await TaskFactory.create();
      await TaskVariantFactory.create({ taskId: task.id, status: 'draft' });
      await TaskVariantFactory.create({ taskId: task.id, status: 'deprecated' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(PATH)
        .query({ 'filter[]': `task.id:eq:${task.id}` })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toHaveLength(0);
    });

    it('returns variant fields and denormalized task fields on each item', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(PATH)
        .query({ 'filter[]': `task.id:eq:${baseFixture.task.id}` })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      const item = res.body.data.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('taskId');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('status', 'published');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('updatedAt');
      expect(item).toHaveProperty('taskName', baseFixture.task.name);
      expect(item).toHaveProperty('taskSlug', baseFixture.task.slug);
      expect(item).toHaveProperty('taskImage');
    });

    it('returns ISO date strings for timestamps', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(PATH)
        .query({ 'filter[]': `task.id:eq:${baseFixture.task.id}` })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const item = res.body.data.items[0];
      expect(new Date(item.createdAt).toISOString()).toBe(item.createdAt);
    });
  });

  describe('embed=parameters', () => {
    it('does not include parameters field when embed is not requested', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(PATH)
        .query({ 'filter[]': `task.id:eq:${baseFixture.task.id}` })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items[0]).not.toHaveProperty('parameters');
    });

    it('includes parameters on each item when embed=parameters is requested', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      await TaskVariantParameterFactory.create({ taskVariantId: variant.id, name: 'difficulty', value: 'easy' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(PATH)
        .query({ 'filter[]': `task.id:eq:${task.id}`, embed: 'parameters' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].parameters).toEqual([{ name: 'difficulty', value: 'easy' }]);
    });

    it('returns an empty parameters array for variants with no parameters', async () => {
      const task = await TaskFactory.create();
      await TaskVariantFactory.create({ taskId: task.id, status: 'published' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(PATH)
        .query({ 'filter[]': `task.id:eq:${task.id}`, embed: 'parameters' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.items[0].parameters).toEqual([]);
    });
  });

  describe('search', () => {
    it('returns variants matching a partial variant name', async () => {
      const task = await TaskFactory.create();
      const matching = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Phonological Awareness Standard',
        status: 'published',
      });
      const nonMatching = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Unrelated',
        status: 'published',
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(PATH)
        .query({ 'filter[]': `task.id:eq:${task.id}`, search: 'Awareness' })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const ids = res.body.data.items.map((v: { id: string }) => v.id);
      expect(ids).toContain(matching.id);
      expect(ids).not.toContain(nonMatching.id);
    });
  });

  describe('filtering', () => {
    it('filters results to a specific task by task.id', async () => {
      const taskA = await TaskFactory.create();
      const taskB = await TaskFactory.create();
      const variantA = await TaskVariantFactory.create({ taskId: taskA.id, status: 'published' });
      await TaskVariantFactory.create({ taskId: taskB.id, status: 'published' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get(PATH)
        .query({ 'filter[]': `task.id:eq:${taskA.id}` })
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(StatusCodes.OK);
      const ids = res.body.data.items.map((v: { id: string }) => v.id);
      expect(ids).toContain(variantA.id);
      expect(ids.every((id: string) => id !== taskB.id)).toBe(true);
    });
  });
});
