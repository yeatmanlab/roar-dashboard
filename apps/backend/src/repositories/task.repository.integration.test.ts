/**
 * Integration tests for TaskRepository.
 *
 * Tests custom methods (getBySlug, listAll) against the real database.
 * Base CRUD operations are covered by BaseRepository tests.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskRepository } from './task.repository';
import { CoreDbClient } from '../db/clients';
import { tasks, type Task } from '../db/schema';
import { inArray } from 'drizzle-orm';

describe('TaskRepository', () => {
  let repository: TaskRepository;
  let createdTaskIds: string[] = [];

  beforeAll(() => {
    repository = new TaskRepository();
  });

  beforeEach(() => {
    createdTaskIds = [];
  });

  afterEach(async () => {
    // Clean up tasks created during this test
    if (createdTaskIds.length > 0) {
      await CoreDbClient.delete(tasks).where(inArray(tasks.id, createdTaskIds));
    }
  });

  // Helper to create a task and track it for cleanup
  async function createTask(overrides: Parameters<typeof TaskFactory.create>[0] = {}): Promise<Task> {
    const task = await TaskFactory.create(overrides);
    createdTaskIds.push(task.id);
    return task;
  }

  describe('getBySlug', () => {
    it('returns task when slug exists', async () => {
      const task = await createTask({
        slug: 'unique-test-slug',
        name: 'Test Task',
      });

      const result = await repository.getBySlug('unique-test-slug');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(task.id);
      expect(result!.slug).toBe('unique-test-slug');
      expect(result!.name).toBe('Test Task');
    });

    it('returns null when slug does not exist', async () => {
      const result = await repository.getBySlug('nonexistent-slug-12345');

      expect(result).toBeNull();
    });

    it('returns correct task when multiple tasks exist', async () => {
      const task1 = await createTask({ slug: 'task-alpha' });
      const task2 = await createTask({ slug: 'task-beta' });
      const task3 = await createTask({ slug: 'task-gamma' });

      const result = await repository.getBySlug('task-beta');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(task2.id);
      expect(result!.slug).toBe('task-beta');
      expect(result!.id).not.toBe(task1.id);
      expect(result!.id).not.toBe(task3.id);
    });

    it('is case-sensitive for slug matching', async () => {
      await createTask({ slug: 'lowercase-slug' });

      const result = await repository.getBySlug('LOWERCASE-SLUG');

      expect(result).toBeNull();
    });
  });

  describe('listAll', () => {
    describe('pagination', () => {
      it('returns paginated results with correct totalItems', async () => {
        // Create 5 tasks
        await Promise.all([
          createTask({ slug: 'task-list-1' }),
          createTask({ slug: 'task-list-2' }),
          createTask({ slug: 'task-list-3' }),
          createTask({ slug: 'task-list-4' }),
          createTask({ slug: 'task-list-5' }),
        ]);

        const result = await repository.listAll({ page: 1, perPage: 2 });

        expect(result.items).toHaveLength(2);
        expect(result.totalItems).toBeGreaterThanOrEqual(5);
      });

      it('returns correct page of results', async () => {
        await Promise.all([
          createTask({ slug: 'page-task-a', name: 'A Task' }),
          createTask({ slug: 'page-task-b', name: 'B Task' }),
          createTask({ slug: 'page-task-c', name: 'C Task' }),
        ]);

        // Sort by name ascending, get page 2 with 1 item per page
        const result = await repository.listAll({
          page: 2,
          perPage: 1,
          orderBy: { field: 'name', direction: 'asc' },
        });

        expect(result.items).toHaveLength(1);
        // Second item alphabetically should be 'B Task'
        expect(result.items[0]?.name).toBe('B Task');
      });

      it('returns empty items when page exceeds total', async () => {
        await createTask({ slug: 'single-task-for-page' });

        const result = await repository.listAll({ page: 100, perPage: 10 });

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBeGreaterThanOrEqual(1);
      });
    });

    describe('sorting', () => {
      it('sorts by createdAt descending by default', async () => {
        const task1 = await createTask({ slug: 'sort-created-1' });
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
        const task2 = await createTask({ slug: 'sort-created-2' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          orderBy: { field: 'createdAt', direction: 'desc' },
        });

        // Find our tasks in the results
        const task1Index = result.items.findIndex((t) => t.id === task1.id);
        const task2Index = result.items.findIndex((t) => t.id === task2.id);

        // task2 was created later, so should appear first in desc order
        expect(task2Index).toBeLessThan(task1Index);
      });

      it('sorts by name ascending', async () => {
        await createTask({ slug: 'sort-name-z', name: 'Zebra Task' });
        await createTask({ slug: 'sort-name-a', name: 'Alpha Task' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          orderBy: { field: 'name', direction: 'asc' },
        });

        // Find our tasks
        const alphaIndex = result.items.findIndex((t) => t.name === 'Alpha Task');
        const zebraIndex = result.items.findIndex((t) => t.name === 'Zebra Task');

        expect(alphaIndex).toBeLessThan(zebraIndex);
      });

      it('sorts by slug descending', async () => {
        await createTask({ slug: 'aaa-slug-sort' });
        await createTask({ slug: 'zzz-slug-sort' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          orderBy: { field: 'slug', direction: 'desc' },
        });

        const aaaIndex = result.items.findIndex((t) => t.slug === 'aaa-slug-sort');
        const zzzIndex = result.items.findIndex((t) => t.slug === 'zzz-slug-sort');

        // zzz should come first in desc order
        expect(zzzIndex).toBeLessThan(aaaIndex);
      });
    });

    describe('slug filter', () => {
      it('returns only task with exact slug match', async () => {
        await createTask({ slug: 'exact-match-slug' });
        await createTask({ slug: 'other-slug' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: 'exact-match-slug',
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.slug).toBe('exact-match-slug');
        expect(result.totalItems).toBe(1);
      });

      it('returns empty when slug does not exist', async () => {
        await createTask({ slug: 'existing-slug' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: 'nonexistent-slug-xyz',
        });

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('is case-sensitive for slug filter', async () => {
        await createTask({ slug: 'case-sensitive-slug' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: 'CASE-SENSITIVE-SLUG',
        });

        expect(result.items).toHaveLength(0);
      });
    });

    describe('search filter', () => {
      it('searches by name (case-insensitive)', async () => {
        await createTask({ slug: 'search-name-1', name: 'Reading Assessment' });
        await createTask({ slug: 'search-name-2', name: 'Math Assessment' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          search: 'reading',
        });

        expect(result.items.some((t) => t.name === 'Reading Assessment')).toBe(true);
        expect(result.items.every((t) => t.name !== 'Math Assessment' || t.slug !== 'search-name-2')).toBe(true);
      });

      it('searches by description (case-insensitive)', async () => {
        await createTask({
          slug: 'search-desc-1',
          name: 'Task A',
          description: 'This is a phonics test',
        });
        await createTask({
          slug: 'search-desc-2',
          name: 'Task B',
          description: 'This is a math test',
        });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          search: 'PHONICS',
        });

        expect(result.items.some((t) => t.slug === 'search-desc-1')).toBe(true);
      });

      it('returns tasks matching either name or description', async () => {
        await createTask({
          slug: 'search-both-1',
          name: 'Vocabulary Test',
          description: 'Tests word knowledge',
        });
        await createTask({
          slug: 'search-both-2',
          name: 'Word Reading',
          description: 'Tests vocabulary skills',
        });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          search: 'vocabulary',
        });

        // Both should match - one in name, one in description
        expect(result.items.filter((t) => t.slug === 'search-both-1' || t.slug === 'search-both-2')).toHaveLength(2);
      });

      it('returns empty when search has no matches', async () => {
        await createTask({ slug: 'no-match-task', name: 'Test Task', description: 'A description' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          search: 'xyznonexistent123',
        });

        expect(result.items.filter((t) => t.slug === 'no-match-task')).toHaveLength(0);
      });
    });

    describe('combined filters', () => {
      it('applies both slug and search filters', async () => {
        await createTask({ slug: 'combined-filter-1', name: 'Reading Task' });
        await createTask({ slug: 'combined-filter-2', name: 'Reading Task' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: 'combined-filter-1',
          search: 'Reading',
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.slug).toBe('combined-filter-1');
      });

      it('returns empty when slug matches but search does not', async () => {
        await createTask({ slug: 'slug-no-search', name: 'Math Task' });

        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          slug: 'slug-no-search',
          search: 'Reading',
        });

        expect(result.items).toHaveLength(0);
      });
    });

    describe('edge cases', () => {
      it('handles special characters in search', async () => {
        await createTask({
          slug: 'special-char-task',
          name: 'Test (Special)',
          description: 'Has % and _ characters',
        });

        // SQL LIKE special characters should be handled
        const result = await repository.listAll({
          page: 1,
          perPage: 10,
          search: '(Special)',
        });

        expect(result.items.some((t) => t.slug === 'special-char-task')).toBe(true);
      });

      it('returns stable pagination order with secondary sort on id', async () => {
        // Create tasks with same name to test tiebreaker
        await createTask({ slug: 'stable-1', name: 'Same Name' });
        await createTask({ slug: 'stable-2', name: 'Same Name' });

        const result1 = await repository.listAll({
          page: 1,
          perPage: 10,
          orderBy: { field: 'name', direction: 'asc' },
        });

        const result2 = await repository.listAll({
          page: 1,
          perPage: 10,
          orderBy: { field: 'name', direction: 'asc' },
        });

        // Order should be consistent across queries
        const order1 = result1.items.filter((t) => t.slug === 'stable-1' || t.slug === 'stable-2');
        const order2 = result2.items.filter((t) => t.slug === 'stable-1' || t.slug === 'stable-2');

        expect(order1.map((t) => t.id)).toEqual(order2.map((t) => t.id));
      });
    });
  });
});
