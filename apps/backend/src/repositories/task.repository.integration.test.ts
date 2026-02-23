/**
 * Integration tests for TaskRepository.
 *
 * Tests custom methods (getBySlug) against the real database.
 * Base CRUD operations are covered by BaseRepository tests.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskRepository } from './task.repository';

describe('TaskRepository', () => {
  let repository: TaskRepository;

  beforeAll(() => {
    repository = new TaskRepository();
  });

  describe('getBySlug', () => {
    it('returns task when slug exists', async () => {
      const task = await TaskFactory.create({
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
      await TaskFactory.create({ slug: 'lowercase-slug' });

      const result = await repository.getBySlug('LOWERCASE-SLUG');

      expect(result).toBeNull();
    });
  });
});
