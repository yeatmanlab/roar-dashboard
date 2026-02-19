import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { administrationTaskVariants, taskVariants, tasks } from '../db/schema';
import { getCoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';

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
 * AdministrationTaskVariant Repository
 *
 * Provides data access methods for the administration_task_variants junction table.
 * Includes enrichment queries that join with task_variants and tasks tables
 * to provide complete task information for administrations.
 */
export class AdministrationTaskVariantRepository {
  private readonly db: NodePgDatabase<typeof CoreDbSchema>;

  constructor(db?: NodePgDatabase<typeof CoreDbSchema>) {
    this.db = db ?? getCoreDbClient();
  }

  /**
   * Get tasks (with variant and task details) for multiple administrations.
   *
   * Joins administration_task_variants with task_variants and tasks to provide
   * enriched task data including task name and variant name.
   *
   * @param administrationIds - Array of administration IDs
   * @returns Map of administration ID to array of tasks, ordered by orderIndex
   */
  async getByAdministrationIds(administrationIds: string[]): Promise<Map<string, AdministrationTask[]>> {
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
      })
      .from(administrationTaskVariants)
      .innerJoin(taskVariants, eq(administrationTaskVariants.taskVariantId, taskVariants.id))
      .innerJoin(tasks, eq(taskVariants.taskId, tasks.id))
      .where(inArray(administrationTaskVariants.administrationId, administrationIds))
      .orderBy(administrationTaskVariants.administrationId, administrationTaskVariants.orderIndex);

    const result = new Map<string, AdministrationTask[]>();

    for (const row of rows) {
      const adminTasks = result.get(row.administrationId) ?? [];
      adminTasks.push({
        taskId: row.taskId,
        taskName: row.taskName,
        variantId: row.variantId,
        variantName: row.variantName,
        orderIndex: row.orderIndex,
      });
      result.set(row.administrationId, adminTasks);
    }

    return result;
  }
}
