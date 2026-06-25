import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { administrationTaskVariants, taskVariants, tasks } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { Condition } from '../types/condition';

/**
 * Task data for an administration (enriched with task and variant details).
 */
export interface AdministrationTask {
  taskId: string;
  taskName: string;
  variantId: string;
  variantName: string | null;
  orderIndex: number;
}

/**
 * Task data for an administration including the raw assignment/optionality
 * conditions stored on the `administration_task_variants` junction row.
 *
 * INTERNAL ONLY: the `conditions*` fields are consumed by the service layer to
 * evaluate per-student `assigned`/`optional` state. They are NOT part of the
 * API response — the service strips them before the controller transforms the
 * task into its contract shape.
 */
export interface AdministrationTaskWithConditions extends AdministrationTask {
  conditionsAssignment: Condition | null;
  conditionsRequirements: Condition | null;
}

/**
 * AdministrationTaskVariant Repository
 *
 * Provides data access methods for the administration_task_variants junction table.
 * Includes enrichment queries that join with task_variants and tasks tables
 * to provide complete task information for administrations.
 */
export class AdministrationTaskVariantRepository {
  constructor(private readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Get tasks (with variant and task details) for multiple administrations.
   *
   * Joins administration_task_variants with task_variants and tasks to provide
   * enriched task data including task name and variant name. The raw
   * assignment/optionality conditions (`conditionsAssignment`,
   * `conditionsRequirements`) are also selected so the service can evaluate
   * per-student `assigned`/`optional` state; these are internal and must not be
   * exposed in the API response.
   *
   * @param administrationIds - Array of administration IDs
   * @returns Map of administration ID to array of tasks (with conditions), ordered by orderIndex
   */
  async getByAdministrationIds(administrationIds: string[]): Promise<Map<string, AdministrationTaskWithConditions[]>> {
    if (administrationIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        administrationId: administrationTaskVariants.administrationId,
        taskId: taskVariants.taskId,
        taskName: tasks.name,
        variantId: administrationTaskVariants.taskVariantId,
        variantName: taskVariants.name,
        orderIndex: administrationTaskVariants.orderIndex,
        conditionsAssignment: administrationTaskVariants.conditionsAssignment,
        conditionsRequirements: administrationTaskVariants.conditionsRequirements,
      })
      .from(administrationTaskVariants)
      .innerJoin(taskVariants, eq(administrationTaskVariants.taskVariantId, taskVariants.id))
      .innerJoin(tasks, eq(taskVariants.taskId, tasks.id))
      .where(inArray(administrationTaskVariants.administrationId, administrationIds))
      .orderBy(administrationTaskVariants.administrationId, administrationTaskVariants.orderIndex);

    const result = new Map<string, AdministrationTaskWithConditions[]>();

    for (const row of rows) {
      const adminTasks = result.get(row.administrationId) ?? [];
      adminTasks.push({
        taskId: row.taskId,
        taskName: row.taskName,
        variantId: row.variantId,
        variantName: row.variantName,
        orderIndex: row.orderIndex,
        // jsonb columns infer as `unknown`; the conditions are persisted in the
        // Condition shape, so narrow them here for the service-layer evaluator.
        conditionsAssignment: row.conditionsAssignment as Condition | null,
        conditionsRequirements: row.conditionsRequirements as Condition | null,
      });
      result.set(row.administrationId, adminTasks);
    }

    return result;
  }
}
