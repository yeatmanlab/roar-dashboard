import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as CoreDbSchema from '../db/schema/core';
import { eq } from 'drizzle-orm';
import { tasks, type Task, type NewTask } from '../db/schema';
import { getCoreDbClient } from '../db/clients';
import { BaseRepository } from './base.repository';

/**
 * Repository for task-related database operations.
 *
 * Provides CRUD operations for tasks (assessments) in the system.
 * Extends BaseRepository with task-specific query methods.
 */
export class TaskRepository extends BaseRepository<Task, typeof tasks, NewTask> {
  constructor(db?: NodePgDatabase<typeof CoreDbSchema>) {
    super(db ?? getCoreDbClient(), tasks);
  }

  /**
   * Retrieves a task by its unique slug.
   *
   * Slugs are unique identifiers in a URL-friendly format (e.g., 'swr', 'letter-task').
   *
   * @param slug - The unique slug of the task to retrieve
   * @returns The task with the given slug, or null if not found
   *
   * @example
   * ```typescript
   * const task = await taskRepository.getBySlug('swr');
   * if (task) {
   *   console.log(task.name); // "Single Word Reading"
   * }
   * ```
   */
  async getBySlug(slug: string): Promise<Task | null> {
    const results = await this.get({
      where: eq(tasks.slug, slug),
      limit: 1,
    });

    return results[0] ?? null;
  }
}
