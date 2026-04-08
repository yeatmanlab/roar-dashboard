import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import type { TaskVariantParameter, NewTaskVariantParameter } from '../db/schema';
import { taskVariantParameters } from '../db/schema';
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
   * Retrieves all parameters for multiple task variants in a single query.
   *
   * This is more efficient than calling getByTaskVariantId for each variant
   * when you need parameters for multiple variants at once.
   *
   * @param taskVariantIds - Array of task variant UUIDs
   * @returns Array of parameters for all specified variants
   *
   * @example
   * ```typescript
   * const params = await repository.getByTaskVariantIds(['variant-1', 'variant-2']);
   * // Group by variant ID if needed
   * const paramsByVariant = params.reduce((acc, p) => {
   *   (acc[p.taskVariantId] ??= []).push(p);
   *   return acc;
   * }, {});
   * ```
   */
  async getByTaskVariantIds(taskVariantIds: string[]): Promise<TaskVariantParameter[]> {
    if (taskVariantIds.length === 0) {
      return [];
    }

    const results = await this.get({
      where: inArray(taskVariantParameters.taskVariantId, taskVariantIds),
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

  /**
   * Deletes all parameters for a given task variant.
   *
   * @param params - Object containing taskVariantId and optional transaction
   * @param params.taskVariantId - The UUID of the task variant
   * @param params.transaction - Optional transaction object for atomic operations
   *
   * @example
   * ```typescript
   * await repository.deleteByTaskVariantId({ taskVariantId: 'variant-uuid', transaction: tx });
   * ```
   */
  async deleteByTaskVariantId(params: {
    taskVariantId: string;
    transaction?: NodePgDatabase<typeof CoreDbSchema>;
  }): Promise<void> {
    const db = params.transaction ?? this.db;
    await db.delete(taskVariantParameters).where(eq(taskVariantParameters.taskVariantId, params.taskVariantId));
  }
}
