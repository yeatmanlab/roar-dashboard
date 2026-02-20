import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { taskVariantParameters, type TaskVariantParameter, type NewTaskVariantParameter } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';
import { BaseCreateManyParams } from './interfaces/base.repository.interface';

/**
 * Repository for task variant parameter-related database operations.
 *
 * Provides CRUD operations for task variant parameters (assessment configuration values).
 * Parameters are key-value pairs that customize how a task variant behaves.
 * Extends BaseRepository with task variant parameter-specific query methods.
 */
export class TaskVariantParameterRepository extends BaseRepository<TaskVariantParameter, typeof taskVariantParameters> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, taskVariantParameters);
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
    const { transaction } = params;
    const db = transaction ?? this.db;

    if (!params.data || params.data.length === 0) {
      return [];
    }

    await db.insert(taskVariantParameters).values(params.data);

    // Return taskVariantId as id to maintain interface typing, or empty string if not provided
    return params.data.map((p) => ({ id: p.taskVariantId ?? '' }));
  }
}
