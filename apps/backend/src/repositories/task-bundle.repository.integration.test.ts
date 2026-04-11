/**
 * Integration tests for TaskBundleRepository.
 *
 * Tests listAll against the real database with seeded data.
 * Covers pagination, search (bundle fields + cross-table via EXISTS subquery), sorting, and filter.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { TaskBundleFactory } from '../test-support/factories/task-bundle.factory';
import { TaskBundleVariantFactory } from '../test-support/factories/task-bundle-variant.factory';
import { TaskBundleRepository } from './task-bundle.repository';

describe('TaskBundleRepository', () => {
  let repository: TaskBundleRepository;

  beforeAll(() => {
    repository = new TaskBundleRepository();
  });

  const defaultOptions = {
    page: 1,
    perPage: 25,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
    filters: [],
  };

  describe('listAll', () => {
    describe('basic listing', () => {
      it('returns a bundle that was created', async () => {
        const bundle = await TaskBundleFactory.create();

        const result = await repository.listAll(defaultOptions);

        expect(result.totalItems).toBeGreaterThan(0);
        expect(result.items.map((b) => b.id)).toContain(bundle.id);
      });

      it('returns empty result when no bundles exist matching a slug filter', async () => {
        const result = await repository.listAll({
          ...defaultOptions,
          filters: [{ field: 'taskBundle.slug', operator: 'eq', value: 'nonexistent-bundle-xyz' }],
        });

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });
    });

    describe('pagination', () => {
      it('paginates correctly across pages', async () => {
        // Create three bundles with a name prefix unique to this test
        const prefix = 'PaginationBundle';
        const b1 = await TaskBundleFactory.create({ name: `${prefix} Alpha` });
        const b2 = await TaskBundleFactory.create({ name: `${prefix} Beta` });
        const b3 = await TaskBundleFactory.create({ name: `${prefix} Gamma` });

        const page1 = await repository.listAll({
          ...defaultOptions,
          search: prefix,
          perPage: 2,
          page: 1,
        });
        const page2 = await repository.listAll({
          ...defaultOptions,
          search: prefix,
          perPage: 2,
          page: 2,
        });

        expect(page1.totalItems).toBe(3);
        expect(page1.items).toHaveLength(2);
        expect(page2.items).toHaveLength(1);

        const allIds = [...page1.items.map((b) => b.id), ...page2.items.map((b) => b.id)];
        expect(new Set(allIds).size).toBe(3);
        expect(allIds).toContain(b1.id);
        expect(allIds).toContain(b2.id);
        expect(allIds).toContain(b3.id);
      });

      it('returns correct totalItems regardless of page size', async () => {
        const prefix = 'TotalBundle';
        await TaskBundleFactory.create({ name: `${prefix} One` });
        await TaskBundleFactory.create({ name: `${prefix} Two` });

        const result = await repository.listAll({
          ...defaultOptions,
          search: prefix,
          perPage: 1,
          page: 1,
        });

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(1);
      });
    });

    describe('sorting', () => {
      it('sorts by name ascending', async () => {
        const prefix = 'SortNameAscBundle';
        await TaskBundleFactory.create({ name: `${prefix} Zebra` });
        await TaskBundleFactory.create({ name: `${prefix} Apple` });
        await TaskBundleFactory.create({ name: `${prefix} Mango` });

        const result = await repository.listAll({
          ...defaultOptions,
          search: prefix,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        const names = result.items.map((b) => b.name);
        expect(names).toEqual([...names].sort());
      });

      it('sorts by name descending', async () => {
        const prefix = 'SortNameDescBundle';
        await TaskBundleFactory.create({ name: `${prefix} Zebra` });
        await TaskBundleFactory.create({ name: `${prefix} Apple` });

        const result = await repository.listAll({
          ...defaultOptions,
          search: prefix,
          sortBy: 'name',
          sortOrder: 'desc',
        });

        const names = result.items.map((b) => b.name);
        expect(names[0]!.localeCompare(names[names.length - 1]!)).toBeGreaterThan(0);
      });

      it('sorts by slug ascending', async () => {
        const b1 = await TaskBundleFactory.create({ slug: 'sort-slug-aaa', name: 'Sort Slug AAA' });
        const b2 = await TaskBundleFactory.create({ slug: 'sort-slug-zzz', name: 'Sort Slug ZZZ' });

        const result = await repository.listAll({
          ...defaultOptions,
          filters: [{ field: 'taskBundle.slug', operator: 'in', value: `${b1.slug},${b2.slug}` }],
          sortBy: 'slug',
          sortOrder: 'asc',
        });

        expect(result.items[0]!.slug).toBe('sort-slug-aaa');
        expect(result.items[1]!.slug).toBe('sort-slug-zzz');
      });
    });

    describe('search', () => {
      it('matches bundles by name (partial, case-insensitive)', async () => {
        const bundle = await TaskBundleFactory.create({ name: 'UniqueBundleNameABC' });
        await TaskBundleFactory.create({ name: 'UnrelatedBundle' });

        const result = await repository.listAll({
          ...defaultOptions,
          search: 'bundlenameabc',
        });

        expect(result.items.map((b) => b.id)).toContain(bundle.id);
      });

      it('matches bundles by description (partial, case-insensitive)', async () => {
        const bundle = await TaskBundleFactory.create({ description: 'UniqueBundleDescriptionXYZ' });

        const result = await repository.listAll({
          ...defaultOptions,
          search: 'bundledescriptionxyz',
        });

        expect(result.items.map((b) => b.id)).toContain(bundle.id);
      });

      it('matches bundles whose variants include a task with a matching slug', async () => {
        const task = await TaskFactory.create({ slug: 'unique-search-slug-qwerty' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
        const bundle = await TaskBundleFactory.create();
        await TaskBundleVariantFactory.create({
          taskBundleId: bundle.id,
          taskVariantId: variant.id,
          sortOrder: 0,
        });
        // Bundle with no variants (should not match)
        const otherBundle = await TaskBundleFactory.create();

        const result = await repository.listAll({
          ...defaultOptions,
          search: 'unique-search-slug-qwerty',
        });

        const ids = result.items.map((b) => b.id);
        expect(ids).toContain(bundle.id);
        expect(ids).not.toContain(otherBundle.id);
      });

      it('matches bundles whose variants include a matching variant name', async () => {
        const task = await TaskFactory.create();
        const variant = await TaskVariantFactory.create({
          taskId: task.id,
          name: 'UniqueVariantNameForSearch',
          status: 'published',
        });
        const bundle = await TaskBundleFactory.create({ name: 'SearchByVariantBundle' });
        await TaskBundleVariantFactory.create({
          taskBundleId: bundle.id,
          taskVariantId: variant.id,
          sortOrder: 0,
        });
        const otherBundle = await TaskBundleFactory.create({ name: 'SearchByVariantBundleOther' });

        const result = await repository.listAll({
          ...defaultOptions,
          search: 'UniqueVariantNameForSearch',
        });

        const ids = result.items.map((b) => b.id);
        expect(ids).toContain(bundle.id);
        expect(ids).not.toContain(otherBundle.id);
      });

      it('does not duplicate a bundle that matches via multiple variants', async () => {
        // A bundle with two variants that both match the search should appear only once
        const task = await TaskFactory.create({ slug: 'dedup-search-slug-bundle' });
        const variant1 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
        const variant2 = await TaskVariantFactory.create({ taskId: task.id, status: 'published' });
        const bundle = await TaskBundleFactory.create({ name: 'DedupSearchBundle' });
        await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: variant1.id, sortOrder: 0 });
        await TaskBundleVariantFactory.create({ taskBundleId: bundle.id, taskVariantId: variant2.id, sortOrder: 1 });

        const result = await repository.listAll({
          ...defaultOptions,
          search: 'dedup-search-slug-bundle',
        });

        const matchingBundles = result.items.filter((b) => b.id === bundle.id);
        expect(matchingBundles).toHaveLength(1);
      });

      it('returns empty result when search matches nothing', async () => {
        const result = await repository.listAll({
          ...defaultOptions,
          search: 'ThisStringCannotPossiblyMatchAnythingInTheDatabase99999',
        });

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });
    });

    describe('filter', () => {
      it('filters by exact slug match', async () => {
        const bundle = await TaskBundleFactory.create();
        await TaskBundleFactory.create(); // Sibling that should not appear

        const result = await repository.listAll({
          ...defaultOptions,
          filters: [{ field: 'taskBundle.slug', operator: 'eq', value: bundle.slug }],
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(bundle.id);
      });

      it('returns empty result when slug filter matches nothing', async () => {
        const result = await repository.listAll({
          ...defaultOptions,
          filters: [{ field: 'taskBundle.slug', operator: 'eq', value: 'no-such-slug-exists' }],
        });

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });
    });
  });
});
