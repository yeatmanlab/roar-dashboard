import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { taskBundleVariants, taskVariants, tasks } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { TaskVariantStatus } from '@roar-dashboard/api-contract';

/**
 * A task bundle variant row joined with its parent task and task variant fields.
 * Returned by `getVariantsWithTaskDetailsByBundleIds`.
 */
export interface TaskBundleVariantWithTaskDetails {
  taskBundleId: string;
  taskVariantId: string;
  sortOrder: number;
  // From task_variants
  taskId: string;
  taskVariantName: string | null;
  description: string | null;
  status: TaskVariantStatus;
  createdAt: Date;
  updatedAt: Date | null;
  // From tasks
  taskSlug: string;
  taskName: string;
  taskImage: string | null;
}

/**
 * TaskBundleVariant Repository
 *
 * Provides read-only access to the task_bundle_variants junction table.
 * This is a standalone class (not extending BaseRepository) because the table
 * uses a composite primary key and the primary use case is a bulk join read
 * across task_bundle_variants, task_variants, and tasks.
 */
export class TaskBundleVariantRepository {
  constructor(private readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Retrieves all variants (with task and task variant details) for multiple task bundles.
   *
   * Joins task_bundle_variants → task_variants → tasks to enrich each entry with
   * the task slug, task name, variant name, and full variant metadata.
   *
   * Results are ordered by taskBundleId first, then by sortOrder within each bundle,
   * matching the expected presentation order.
   *
   * @param bundleIds - Array of task bundle UUIDs
   * @returns Array of enriched variant rows across all specified bundles
   */
  async getVariantsWithTaskDetailsByBundleIds(bundleIds: string[]): Promise<TaskBundleVariantWithTaskDetails[]> {
    if (bundleIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        taskBundleId: taskBundleVariants.taskBundleId,
        taskVariantId: taskBundleVariants.taskVariantId,
        sortOrder: taskBundleVariants.sortOrder,
        taskId: taskVariants.taskId,
        taskVariantName: taskVariants.name,
        description: taskVariants.description,
        status: taskVariants.status,
        createdAt: taskVariants.createdAt,
        updatedAt: taskVariants.updatedAt,
        taskSlug: tasks.slug,
        taskName: tasks.name,
        taskImage: tasks.image,
      })
      .from(taskBundleVariants)
      .innerJoin(taskVariants, eq(taskBundleVariants.taskVariantId, taskVariants.id))
      .innerJoin(tasks, eq(taskVariants.taskId, tasks.id))
      .where(inArray(taskBundleVariants.taskBundleId, bundleIds))
      .orderBy(taskBundleVariants.taskBundleId, taskBundleVariants.sortOrder);

    return rows satisfies TaskBundleVariantWithTaskDetails[];
  }
}
