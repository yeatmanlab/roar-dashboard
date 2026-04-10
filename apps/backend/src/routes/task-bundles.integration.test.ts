/**
 * Route integration tests for GET /v1/task-bundles.
 *
 * Tests the full HTTP lifecycle: middleware → controller → service → repository → DB.
 * Only Firebase token verification is mocked — everything else runs for real.
 *
 * Authorization:
 *   - superAdmin:  200 (isSuperAdmin=true bypasses all access control)
 *   - siteAdmin:   403
 *   - admin:       403
 *   - educator:    403
 *   - student:     403
 *   - caregiver:   403
 *   - unauthenticated: 401
 *
 * Each section covers authorization, then functional behaviour.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type express from 'express';
import request from 'supertest';
import { authenticateAs, createTestApp, createRouteHelper, createTierUsers } from '../test-support/route-test.helper';
import type { TierUsers } from '../test-support/route-test.helper';
import { baseFixture } from '../test-support/fixtures';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { TaskBundleFactory } from '../test-support/factories/task-bundle.factory';
import { TaskBundleVariantFactory } from '../test-support/factories/task-bundle-variant.factory';
import { TaskVariantParameterRepository } from '../repositories/task-variant-parameter.repository';

// ═══════════════════════════════════════════════════════════════════════════
// Test setup
// ═══════════════════════════════════════════════════════════════════════════

let app: express.Application;
let expectRoute: ReturnType<typeof createRouteHelper>;
let tiers: TierUsers;
let taskVariantParameterRepository: TaskVariantParameterRepository;

beforeAll(async () => {
  // Route modules must be imported dynamically — they instantiate services at
  // import time, which capture CoreDbClient by value. This must happen after
  // vitest.setup.ts initializes the DB pools.
  const { registerTaskBundlesRoutes } = await import('./task-bundles');
  app = createTestApp(registerTaskBundlesRoutes);
  expectRoute = createRouteHelper(app);
  tiers = await createTierUsers(baseFixture.district.id);
  taskVariantParameterRepository = new TaskVariantParameterRepository();
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /v1/task-bundles
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/task-bundles', () => {
  describe('authorization', () => {
    it('returns 200 for super admin', async () => {
      const res = await expectRoute('GET', '/v1/task-bundles').as(tiers.superAdmin).toReturn(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('returns 403 for site admin', async () => {
      const res = await expectRoute('GET', '/v1/task-bundles').as(tiers.siteAdmin).toReturn(403);
      expect(res.status).toBe(403);
    });

    it('returns 403 for admin', async () => {
      const res = await expectRoute('GET', '/v1/task-bundles').as(tiers.admin).toReturn(403);
      expect(res.status).toBe(403);
    });

    it('returns 403 for educator', async () => {
      const res = await expectRoute('GET', '/v1/task-bundles').as(tiers.educator).toReturn(403);
      expect(res.status).toBe(403);
    });

    it('returns 403 for student', async () => {
      const res = await expectRoute('GET', '/v1/task-bundles').as(tiers.student).toReturn(403);
      expect(res.status).toBe(403);
    });

    it('returns 403 for caregiver', async () => {
      const res = await expectRoute('GET', '/v1/task-bundles').as(tiers.caregiver).toReturn(403);
      expect(res.status).toBe(403);
    });

    it('returns 401 without authentication', async () => {
      const res = await expectRoute('GET', '/v1/task-bundles').unauthenticated().toReturn(401);
      expect(res.status).toBe(401);
    });
  });

  describe('response shape', () => {
    it('returns paginated envelope with items and pagination metadata', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app).get('/v1/task-bundles').set('Authorization', 'Bearer token').expect(200);

      expect(res.body.data).toMatchObject({
        items: expect.any(Array),
        pagination: {
          page: expect.any(Number),
          perPage: expect.any(Number),
          totalItems: expect.any(Number),
          totalPages: expect.any(Number),
        },
      });
    });

    it('returns each bundle with required fields and a variants array', async () => {
      const bundle = await TaskBundleFactory.create({ name: 'ResponseShapeBundle' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: `taskBundle.slug:eq:${bundle.slug}` })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items).toHaveLength(1);
      const item = res.body.data.items[0];
      expect(item.id).toBe(bundle.id);
      expect(item.slug).toBe(bundle.slug);
      expect(item.name).toBe(bundle.name);
      expect(item.description).toBe(bundle.description);
      expect(item.image).toBe(bundle.image);
      expect(item.createdAt).toEqual(expect.any(String));
      // updatedAt is null on fresh inserts (set by trigger only on updates)
      expect(item.updatedAt === null || typeof item.updatedAt === 'string').toBe(true);
      expect(item.taskVariants).toBeInstanceOf(Array);
    });

    it('includes task and variant fields in the base variant summary', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'SummaryVariant',
        status: 'published',
      });
      const bundle = await TaskBundleFactory.create({ name: 'BaseVariantShapeBundle' });
      await TaskBundleVariantFactory.create({
        taskBundleId: bundle.id,
        taskVariantId: variant.id,
        sortOrder: 0,
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: `taskBundle.slug:eq:${bundle.slug}` })
        .set('Authorization', 'Bearer token')
        .expect(200);

      const item = res.body.data.items[0];
      expect(item.taskVariants).toHaveLength(1);
      const v = item.taskVariants[0];
      expect(v.taskVariantId).toBe(variant.id);
      expect(v.taskSlug).toBe(task.slug);
      expect(v.taskName).toBe(task.name);
      expect(v.taskVariantName).toBe(variant.name);
      expect(v.sortOrder).toBe(0);
      // Embed fields must NOT be present in the base response
      expect(v.parameters).toBeUndefined();
    });

    it('orders variants by sortOrder within each bundle', async () => {
      const task = await TaskFactory.create();
      const v1 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const v2 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const v3 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const bundle = await TaskBundleFactory.create({ name: 'SortOrderBundle' });
      // Create in reverse order to verify sortOrder drives the result
      await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: v3.id, sortOrder: 2 });
      await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: v1.id, sortOrder: 0 });
      await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: v2.id, sortOrder: 1 });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: `taskBundle.slug:eq:${bundle.slug}` })
        .set('Authorization', 'Bearer token')
        .expect(200);

      const variants = res.body.data.items[0].taskVariants;
      expect(variants[0].taskVariantId).toBe(v1.id);
      expect(variants[1].taskVariantId).toBe(v2.id);
      expect(variants[2].taskVariantId).toBe(v3.id);
    });
  });

  describe('pagination', () => {
    it('respects page and perPage query parameters', async () => {
      const prefix = 'RoutePageBundle';
      await TaskBundleFactory.create({ name: `${prefix} 1` });
      await TaskBundleFactory.create({ name: `${prefix} 2` });
      await TaskBundleFactory.create({ name: `${prefix} 3` });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ search: prefix, page: 1, perPage: 2 })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.pagination.totalItems).toBe(3);
      expect(res.body.data.pagination.totalPages).toBe(2);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.perPage).toBe(2);
    });

    it('returns empty items array on a page beyond the last page', async () => {
      const bundle = await TaskBundleFactory.create({ name: 'BeyondLastPageBundle' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: `taskBundle.slug:eq:${bundle.slug}`, page: 99, perPage: 25 })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(1);
    });
  });

  describe('sorting', () => {
    it('sorts by name ascending (default)', async () => {
      const prefix = 'RouteSortBundle';
      await TaskBundleFactory.create({ name: `${prefix} Zebra` });
      await TaskBundleFactory.create({ name: `${prefix} Apple` });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ search: prefix, sortBy: 'name', sortOrder: 'asc' })
        .set('Authorization', 'Bearer token')
        .expect(200);

      const names = res.body.data.items.map((b: { name: string }) => b.name);
      const appleIdx = names.indexOf(`${prefix} Apple`);
      const zebraIdx = names.indexOf(`${prefix} Zebra`);
      expect(appleIdx).toBeLessThan(zebraIdx);
    });

    it('sorts by slug descending', async () => {
      await TaskBundleFactory.create({ slug: 'route-sort-slug-aaa', name: 'Route Sort Slug AAA' });
      await TaskBundleFactory.create({ slug: 'route-sort-slug-zzz', name: 'Route Sort Slug ZZZ' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({
          filter: `taskBundle.slug:in:route-sort-slug-aaa,route-sort-slug-zzz`,
          sortBy: 'slug',
          sortOrder: 'desc',
        })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items[0].slug).toBe('route-sort-slug-zzz');
      expect(res.body.data.items[1].slug).toBe('route-sort-slug-aaa');
    });
  });

  describe('search', () => {
    it('returns bundles matching by bundle name', async () => {
      const bundle = await TaskBundleFactory.create({ name: 'RouteSearchNameBundle' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ search: 'RouteSearchNameBundle' })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items.map((b: { id: string }) => b.id)).toContain(bundle.id);
    });

    it('returns bundles matching by task slug in their variants', async () => {
      const task = await TaskFactory.create({ slug: 'route-search-task-slug-unique' });
      const variant = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const bundle = await TaskBundleFactory.create({ name: 'RouteSearchTaskSlugBundle' });
      await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: variant.id, sortOrder: 0 });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ search: 'route-search-task-slug-unique' })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items.map((b: { id: string }) => b.id)).toContain(bundle.id);
    });

    it('returns empty items when search matches nothing', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ search: 'ImpossibleSearchTermThatMatchesNothing99999' })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.pagination.totalItems).toBe(0);
    });
  });

  describe('filter', () => {
    it('filters by exact slug using structured filter syntax', async () => {
      const bundle = await TaskBundleFactory.create({ name: 'RouteFilterSlugBundle' });
      await TaskBundleFactory.create({ name: 'RouteFilterSlugBundleOther' });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: `taskBundle.slug:eq:${bundle.slug}` })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(bundle.id);
    });

    it('returns 400 for an invalid filter operator', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: 'taskBundle.slug:badoperator:foo' })
        .set('Authorization', 'Bearer token')
        .expect(400);
      expect(res.status).toBe(400);
    });

    it('returns 400 for an unknown filter field', async () => {
      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: 'unknownField:eq:foo' })
        .set('Authorization', 'Bearer token')
        .expect(400);
      expect(res.status).toBe(400);
    });
  });

  describe('embed: taskVariantDetails', () => {
    it('includes full variant details and parameters when embed=taskVariantDetails', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'EmbedVariant',
        description: 'Embed test variant',
        status: 'published',
      });
      const bundle = await TaskBundleFactory.create({ name: 'EmbedDetailsBundle' });
      await TaskBundleVariantFactory.create({
        taskBundleId: bundle.id,
        taskVariantId: variant.id,
        sortOrder: 0,
      });
      // Add a parameter to the variant
      await taskVariantParameterRepository.createMany({
        data: [{ taskVariantId: variant.id, name: 'difficulty', value: 'easy' }],
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: `taskBundle.slug:eq:${bundle.slug}`, embed: 'taskVariantDetails' })
        .set('Authorization', 'Bearer token')
        .expect(200);

      const v = res.body.data.items[0].taskVariants[0];
      // Base fields still present
      expect(v.taskVariantId).toBe(variant.id);
      expect(v.taskSlug).toBe(task.slug);
      expect(v.taskVariantName).toBe('EmbedVariant');
      // Embed fields now present
      expect(v.taskId).toBe(task.id);
      expect(v.description).toBe('Embed test variant');
      expect(v.status).toBe('published');
      expect(v.createdAt).toEqual(expect.any(String));
      expect(v.parameters).toEqual([{ name: 'difficulty', value: 'easy' }]);
    });

    it('includes empty parameters array for variants with no parameters when embedded', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const bundle = await TaskBundleFactory.create({ name: 'EmbedNoParamsBundle' });
      await TaskBundleVariantFactory.create({
        taskBundleId: bundle.id,
        taskVariantId: variant.id,
        sortOrder: 0,
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: `taskBundle.slug:eq:${bundle.slug}`, embed: 'taskVariantDetails' })
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(res.body.data.items[0].taskVariants[0].parameters).toEqual([]);
    });

    it('does not include embed fields when embed is not specified', async () => {
      const task = await TaskFactory.create();
      const variant = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
      const bundle = await TaskBundleFactory.create({ name: 'NoEmbedBundle' });
      await TaskBundleVariantFactory.create({
        taskBundleId: bundle.id,
        taskVariantId: variant.id,
        sortOrder: 0,
      });

      authenticateAs(tiers.superAdmin);
      const res = await request(app)
        .get('/v1/task-bundles')
        .query({ filter: `taskBundle.slug:eq:${bundle.slug}` })
        .set('Authorization', 'Bearer token')
        .expect(200);

      const v = res.body.data.items[0].taskVariants[0];
      expect(v.parameters).toBeUndefined();
      expect(v.taskId).toBeUndefined();
      expect(v.status).toBeUndefined();
    });
  });
});
