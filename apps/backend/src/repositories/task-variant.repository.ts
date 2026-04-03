import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Column, SQL } from 'drizzle-orm';
import { eq, and, or, ilike, asc, desc, count, sql } from 'drizzle-orm';
import type { TaskVariant } from '../db/schema';
import { taskVariants } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type * as CoreDbSchema from '../db/schema/core';
import type { TaskVariantSortFieldType, TaskVariantStatus } from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';

/**
 * Explicit mapping from API sort field names to task variant table columns.
 * This ensures only valid columns are used for sorting, even if API validation is bypassed.
 */
const TASK_VARIANT_SORT_COLUMNS: Record<TaskVariantSortFieldType, Column> = {
  createdAt: taskVariants.createdAt,
  updatedAt: taskVariants.updatedAt,
  name: taskVariants.name,
  status: taskVariants.status,
};

/**
 * Options for listing task variants.
 */
export interface ListTaskVariantsOptions {
  page: number;
  perPage: number;
  orderBy?: {
    field: TaskVariantSortFieldType;
    direction: SortOrder;
  };
  search?: string;
  status?: TaskVariantStatus;
}

/**
 * Filter for listing task variants.
 */
export interface ListTaskVariantsFilter {
  taskId: string;
  /** Optional status to filter by. If not provided, returns all variants. */
  status?: TaskVariantStatus;
}

/**
 * Repository for task variant-related database operations.
 *
 * Provides CRUD operations for task variants (assessment configurations) in the system.
 * Extends BaseRepository with task variant-specific query methods.
 */
export class TaskVariantRepository extends BaseRepository<TaskVariant, typeof taskVariants> {
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

  /**
   * Retrieves the taskId associated with a given task variant ID.
   *
   * @param taskVariantId - The UUID of the task variant
   * @returns Object containing taskId if found, or null if not found
   *
   * @example
   * ```typescript
   * const result = await repository.getTaskIdByVariantId('variant-uuid');
   * if (!result) {
   *   throw new Error('Invalid taskVariantId');
   * }
   * console.log(result.taskId);
   * ```
   */
  async getTaskIdByVariantId(taskVariantId: string): Promise<{ taskId: string } | null> {
    const results = await this.get({
      where: eq(taskVariants.id, taskVariantId),
      limit: 1,
    });

    const variant = results[0];
    if (!variant) return null;

    return { taskId: variant.taskId };
  }

  /**
   * List task variants for a given task with optional filtering and sorting.
   *
   * @param filter - Filter containing taskId and optional status filter
   * @param options - Pagination, sorting, and search options
   * @returns Paginated result with task variants
   */
  async listByTaskId(
    filter: ListTaskVariantsFilter,
    options: ListTaskVariantsOptions,
  ): Promise<PaginatedResult<TaskVariant>> {
    const { taskId, status } = filter;
    const { page, perPage, orderBy, search } = options;
    const offset = (page - 1) * perPage;

    // Build where conditions
    const conditions: SQL[] = [];

    // Always filter by taskId
    conditions.push(eq(taskVariants.taskId, taskId));

    // Status filter (if provided)
    if (status) {
      conditions.push(eq(taskVariants.status, status));
    }

    // Search filter (name or description)
    if (search) {
      const escapeLikePattern = (value: string): string =>
        value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const escapedSearch = escapeLikePattern(search);
      const searchPattern = `%${escapedSearch}%`;
      conditions.push(
        or(ilike(taskVariants.name, searchPattern), ilike(taskVariants.description, searchPattern)) as SQL,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count query
    const countResult = await this.db.select({ count: count() }).from(taskVariants).where(whereClause);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Use explicit column mapping for type safety
    const sortField = orderBy?.field as TaskVariantSortFieldType | undefined;
    const sortColumn = (sortField && TASK_VARIANT_SORT_COLUMNS[sortField]) ?? taskVariants.name;
    const sortDirection = (orderBy?.direction ?? SortOrder.ASC) === SortOrder.ASC ? asc(sortColumn) : desc(sortColumn);

    // Data query
    const dataResult = await this.db
      .select()
      .from(taskVariants)
      .where(whereClause)
      .orderBy(sortDirection, asc(taskVariants.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult,
      totalItems,
    };
  }
}
