import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import { taskVariants, type TaskVariant, type NewTaskVariant } from '../db/schema';
import { getCoreDbClient } from '../db/clients';
import { BaseRepository } from './base.repository';
import type * as CoreDbSchema from '../db/schema/core';

/**
 * Repository for task variant-related database operations.
 *
 * Provides CRUD operations for task variants (assessment configurations) in the system.
 * Extends BaseRepository with task variant-specific query methods.
 */
export class TaskVariantRepository extends BaseRepository<TaskVariant, typeof taskVariants, NewTaskVariant> {
  constructor(db?: NodePgDatabase<typeof CoreDbSchema>) {
    super(db ?? getCoreDbClient(), taskVariants);
  }

  /**
   * Retrieves all task variants for a given task.
   *
   * @param taskId - The UUID of the parent task
   * @returns Array of task variants for the task, or empty array if none found
   *
   * @example
   * ```typescript
   * const variants = await taskVariantRepository.getByTaskId('task-uuid');
   * console.log(`Found ${variants.length} variants`);
   * ```
   */
  async getByTaskId(taskId: string): Promise<TaskVariant[]> {
    const results = await this.get({
      where: eq(taskVariants.taskId, taskId),
    });

    return results;
  }

  /**
   * Retrieves a task variant by task ID and name combination.
   *
   * This enforces the unique constraint: variant names are unique per task.
   *
   * @param taskId - The UUID of the parent task
   * @param name - The name of the task variant
   * @returns The task variant if found, or null if not found
   *
   * @example
   * ```typescript
   * const existing = await repository.getByTaskIdAndName('task-uuid', 'easy-mode');
   * if (existing) {
   *   throw new Error('Variant already exists for this task');
   * }
   * ```
   */
  async getByTaskIdAndName({ taskId, name }: { taskId: string; name: string }): Promise<TaskVariant | null> {
    const whereClause = and(eq(taskVariants.taskId, taskId), sql`lower(${taskVariants.name}) = lower(${name})`);

    const results = await this.get({
      where: whereClause!, // Non-null assertion: and() with two valid conditions always returns SQL
      limit: 1,
    });

    return results[0] ?? null;
  }
}
