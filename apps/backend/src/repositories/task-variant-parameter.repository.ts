import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type { BaseCreateManyParams } from './interfaces/base.repository.interface';
import { taskVariantParameters, type TaskVariantParameter, type NewTaskVariantParameter } from '../db/schema';
import { getCoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';

/**
 * Repository for task variant parameter-related database operations.
 *
 * Provides CRUD operations for task variant parameters (assessment configuration values).
 * Parameters are key-value pairs that customize how a task variant behaves.
 * Extends BaseRepository with task variant parameter-specific query methods.
 */
export class TaskVariantParameterRepository extends BaseRepository<
  TaskVariantParameter,
  typeof taskVariantParameters,
  NewTaskVariantParameter
> {
  constructor(db?: NodePgDatabase<typeof CoreDbSchema>) {
    super(db ?? getCoreDbClient(), taskVariantParameters);
  }

  /**
   * Retrieves all parameters for a given task variant.
   *
   * Parameters are key-value pairs stored as JSONB that configure the variant's behavior
   * (e.g., difficulty settings, time limits, enabled features).
   *
   * @param taskVariantId - The UUID of the task variant
   * @returns Array of parameters for the variant, or empty array if none exist
   *
   * @example
   * ```typescript
   * const params = await repository.getByTaskVariantId('variant-uuid');
   * params.forEach(p => {
   *   console.log(`${p.name}: ${JSON.stringify(p.value)}`);
   * });
   * // Output:
   * // difficulty: "easy"
   * // timeLimit: 120
   * // hintsEnabled: true
   * ```
   */
  async getByTaskVariantId(taskVariantId: string): Promise<TaskVariantParameter[]> {
    const results = await this.get({
      where: eq(taskVariantParameters.taskVariantId, taskVariantId),
    });

    return results;
  }

  /**
   * Creates multiple task variant parameters.
   *
   * Overrides base createMany because this table uses a composite primary key (taskVariantId, name)
   * instead of a single id column. Returns placeholder objects to satisfy the base interface.
   */
  override async createMany(params: BaseCreateManyParams<NewTaskVariantParameter>): Promise<{ id: string }[]> {
    if (!params.data || params.data.length === 0) {
      return [];
    }

    const db = params.transaction ?? this.db;
    await db.insert(taskVariantParameters).values(params.data);

    // Return placeholder array with same length (service only checks length)
    return params.data.map(() => ({ id: '' }));
  }
}
