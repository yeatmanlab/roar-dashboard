import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { taskVariants, type TaskVariant, type NewTaskVariant } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import { BaseRepository } from './base.repository';
import type * as CoreDbSchema from '../db/schema/core';

/**
 * Repository for task variant-related database operations.
 *
 * Provides CRUD operations for task variants (assessment configurations) in the system.
 * Extends BaseRepository with task variant-specific query methods.
 */
export class TaskVariantRepository extends BaseRepository<TaskVariant, typeof taskVariants, NewTaskVariant> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, taskVariants);
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
   * Retrieves a task variant by its unique name.
   *
   * Task variant names are unique per task (enforced by database constraint).
   *
   * @param variantName - The name of the task variant to retrieve
   * @returns The task variant with the given name, or null if not found
   *
   * @example
   * ```typescript
   * const variant = await taskVariantRepository.getByName('easy-mode');
   * if (variant) {
   *   console.log(variant.description);
   * }
   * ```
   */
  async getByName(variantName: string): Promise<TaskVariant | null> {
    const results = await this.get({
      where: eq(taskVariants.name, variantName),
      limit: 1,
    });

    return results[0] ?? null;
  }
}
