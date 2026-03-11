/**
 * Integration tests for TaskRepository.
 *
 * Tests custom methods (getBySlug, listAll) against the real database
 * with the base fixture's task and any additional tasks created during tests.
 *
 * Base CRUD operations are covered by BaseRepository tests.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskRepository } from './task.repository';

describe('TaskRepository', () => {
  let repository: TaskRepository;

  beforeAll(() => {
    repository = new TaskRepository();
  });

  describe('getBySlug', () => {
    it('returns task from base fixture when slug exists', async () => {
      const result = await repository.getBySlug(baseFixture.task.slug);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.task.id);
      expect(result!.name).toBe(baseFixture.task.name);
    });

    it('returns null when slug does not exist', async () => {
      const result = await repository.getBySlug('nonexistent-slug-12345');

      expect(result).toBeNull();
    });

    it('returns correct task when multiple tasks exist', async () => {
      const task1 = await TaskFactory.create({ slug: 'task-alpha' });
      const task2 = await TaskFactory.create({ slug: 'task-beta' });
      const task3 = await TaskFactory.create({ slug: 'task-gamma' });

      const result = await repository.getBySlug('task-beta');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(task2.id);
      expect(result!.slug).toBe('task-beta');
      expect(result!.id).not.toBe(task1.id);
      expect(result!.id).not.toBe(task3.id);
    });

    it('is case-sensitive for slug matching', async () => {
      const task = await TaskFactory.create({ slug: 'lowercase-slug' });

      const result = await repository.getBySlug('LOWERCASE-SLUG');

      expect(result).toBeNull();

      // Verify the lowercase version works
      const correctResult = await repository.getBySlug(task.slug);
      expect(correctResult).not.toBeNull();
    });
  });

  describe('listAll', () => {
    describe('pagination', () => {
      it('returns paginated results with correct totalItems', async () => {
        // Base fixture already has at least 1 task
        const result = await repository.listAll({ page: 1, perPage: 100 });

        expect(result.totalItems).toBeGreaterThanOrEqual(1);
        expect(result.items.length).toBeGreaterThanOrEqual(1);

        // Verify base fixture task is included
        const ids = result.items.map((t) => t.id);
        expect(ids).toContain(baseFixture.task.id);
      });

      it('respects perPage limit', async () => {
        const result = await repository.listAll({ page: 1, perPage: 2 });

        expect(result.items.length).toBeLessThanOrEqual(2);
        expect(result.totalItems).toBeGreaterThanOrEqual(1);
      });

      it('returns empty items when page exceeds total', async () => {
        const result = await repository.listAll({ page: 1000, perPage: 10 });

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBeGreaterThanOrEqual(1);
      });
    });

    describe('sorting', () => {
      it('applies orderBy name ascending', async () => {
        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          orderBy: { field: 'name', direction: 'asc' },
        });

        expect(result.items.length).toBeGreaterThan(0);
        for (let i = 1; i < result.items.length; i++) {
          expect(result.items[i - 1]!.name.toLowerCase() <= result.items[i]!.name.toLowerCase()).toBe(true);
        }
      });

      it('applies orderBy createdAt descending', async () => {
        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          orderBy: { field: 'createdAt', direction: 'desc' },
        });

        expect(result.items.length).toBeGreaterThan(0);
        for (let i = 1; i < result.items.length; i++) {
          expect(result.items[i - 1]!.createdAt >= result.items[i]!.createdAt).toBe(true);
        }
      });

      it('applies orderBy slug descending', async () => {
        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          orderBy: { field: 'slug', direction: 'desc' },
        });

        expect(result.items.length).toBeGreaterThan(0);
        for (let i = 1; i < result.items.length; i++) {
          expect(result.items[i - 1]!.slug.toLowerCase() >= result.items[i]!.slug.toLowerCase()).toBe(true);
        }
      });

      it('maintains stable order with secondary sort on id', async () => {
        // Create tasks with same name to test tiebreaker
        await TaskFactory.create({ slug: 'stable-sort-1', name: 'Identical Name For Sort' });
        await TaskFactory.create({ slug: 'stable-sort-2', name: 'Identical Name For Sort' });

        const result1 = await repository.listAll({
          page: 1,
          perPage: 100,
          orderBy: { field: 'name', direction: 'asc' },
        });

        const result2 = await repository.listAll({
          page: 1,
          perPage: 100,
          orderBy: { field: 'name', direction: 'asc' },
        });

        // Order should be consistent across queries
        const order1 = result1.items.filter((t) => t.slug === 'stable-sort-1' || t.slug === 'stable-sort-2');
        const order2 = result2.items.filter((t) => t.slug === 'stable-sort-1' || t.slug === 'stable-sort-2');

        expect(order1.map((t) => t.id)).toEqual(order2.map((t) => t.id));
      });
    });

    describe('slug filter', () => {
      it('returns only task with exact slug match', async () => {
        const task = await TaskFactory.create({ slug: 'exact-match-slug-test' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: task.slug,
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.slug).toBe(task.slug);
        expect(result.totalItems).toBe(1);
      });

      it('returns base fixture task when filtering by its slug', async () => {
        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: baseFixture.task.slug,
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.id).toBe(baseFixture.task.id);
      });

      it('returns empty when slug does not exist', async () => {
        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: 'nonexistent-slug-xyz-123',
        });

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('is case-sensitive for slug filter', async () => {
        const task = await TaskFactory.create({ slug: 'case-sensitive-slug-test' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: task.slug.toUpperCase(),
        });

        expect(result.items).toHaveLength(0);
      });
    });

    describe('search filter', () => {
      it('searches by name (case-insensitive)', async () => {
        const task = await TaskFactory.create({ slug: 'search-name-test', name: 'Unique Reading Assessment XYZ' });

        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          search: 'unique reading',
        });

        expect(result.items.some((t) => t.id === task.id)).toBe(true);
      });

      it('searches by description (case-insensitive)', async () => {
        const task = await TaskFactory.create({
          slug: 'search-desc-test',
          name: 'Task With Description',
          description: 'This is a unique phonics assessment XYZ',
        });

        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          search: 'UNIQUE PHONICS',
        });

        expect(result.items.some((t) => t.id === task.id)).toBe(true);
      });

      it('returns tasks matching either name or description', async () => {
        const task1 = await TaskFactory.create({
          slug: 'search-both-name',
          name: 'Vocabulary XYZ Test',
          description: 'Tests word knowledge',
        });
        const task2 = await TaskFactory.create({
          slug: 'search-both-desc',
          name: 'Word Reading',
          description: 'Tests vocabulary XYZ skills',
        });

        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          search: 'vocabulary xyz',
        });

        // Both should match - one in name, one in description
        expect(result.items.some((t) => t.id === task1.id)).toBe(true);
        expect(result.items.some((t) => t.id === task2.id)).toBe(true);
      });

      it('returns empty when search has no matches', async () => {
        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          search: 'xyznonexistent123abc',
        });

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('can find base fixture task by name', async () => {
        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          search: baseFixture.task.name,
        });

        expect(result.items.some((t) => t.id === baseFixture.task.id)).toBe(true);
      });
    });

    describe('combined filters', () => {
      it('applies both slug and search filters', async () => {
        const task1 = await TaskFactory.create({ slug: 'combined-filter-1', name: 'Combined Reading Task' });
        await TaskFactory.create({ slug: 'combined-filter-2', name: 'Combined Reading Task' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: task1.slug,
          search: 'Combined Reading',
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.id).toBe(task1.id);
      });

      it('returns empty when slug matches but search does not', async () => {
        const task = await TaskFactory.create({ slug: 'slug-no-search-match', name: 'Math Task Only' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: task.slug,
          search: 'Reading',
        });

        expect(result.items).toHaveLength(0);
      });
    });

    describe('edge cases', () => {
      it('handles special characters in search', async () => {
        const task = await TaskFactory.create({
          slug: 'special-char-task-test',
          name: 'Test % and _',
          description: 'Has % and _ characters',
        });

        // SQL LIKE special characters should be handled
        const result = await repository.listAll({
          page: 1,
          perPage: 100,
          search: '% and _',
        });

        expect(result.items.some((t) => t.id === task.id)).toBe(true);
      });
    });
  });
});
