import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Column, SQL } from 'drizzle-orm';
import { eq, and, or, ilike, asc, desc, count, sql } from 'drizzle-orm';
import type { TaskVariant } from '../db/schema';
import { taskVariants, tasks } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type * as CoreDbSchema from '../db/schema/core';
import type {
  TaskVariantSortFieldType,
  TaskVariantStatus,
  TaskVariantsSortFieldType,
} from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import type { ParsedFilter } from '../types/filter';
import type { FilterFieldMap } from '../utils/build-filter-conditions.util';
import { buildFilterConditions } from '../utils/build-filter-conditions.util';

/**
 * Escapes SQL LIKE/ILIKE pattern special characters so user input is treated as literal text.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

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
 * Explicit mapping from API sort field names to columns for the cross-task variant list.
 */
const TASK_VARIANTS_SORT_COLUMNS: Record<TaskVariantsSortFieldType, Column> = {
  'variant.name': taskVariants.name,
  'variant.createdAt': taskVariants.createdAt,
  'variant.updatedAt': taskVariants.updatedAt,
  'task.name': tasks.name,
  'task.slug': tasks.slug,
};

/**
 * Allowed filter fields for the cross-task variant list, mapped to Drizzle column references.
 */
const TASK_VARIANTS_FILTER_COLUMNS: FilterFieldMap = {
  'task.id': tasks.id,
  'task.slug': tasks.slug,
};

/**
 * A published task variant joined with its parent task fields.
 * Returned by `listAllPublished`.
 */
export interface TaskVariantWithTaskDetails {
  id: string;
  taskId: string;
  name: string | null;
  description: string | null;
  status: TaskVariantStatus;
  createdAt: Date;
  updatedAt: Date | null;
  taskName: string;
  taskSlug: string;
  taskImage: string | null;
}

/**
 * Options for the cross-task published variant list.
 */
export interface ListAllPublishedOptions {
  page: number;
  perPage: number;
  sortBy: TaskVariantsSortFieldType;
  sortOrder: SortOrder;
  search?: string;
  filters: ParsedFilter[];
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

  /**
   * List all published task variants across all tasks.
   *
   * Performs an INNER JOIN against the tasks table to include denormalized task fields.
   * Always filters to `status = 'published'`. Supports free-text search across variant
   * name, variant description, task name, task slug, and task description. Supports
   * structured filter expressions and dotted-notation sorting.
   *
   * @param options - Pagination, sort, search, and filter options
   * @returns Paginated result with variant + task details
   */
  async listAllPublished(options: ListAllPublishedOptions): Promise<PaginatedResult<TaskVariantWithTaskDetails>> {
    const { page, perPage, sortBy, sortOrder, search, filters } = options;
    const offset = (page - 1) * perPage;

    const conditions: SQL[] = [];

    // Always restrict to published variants
    conditions.push(eq(taskVariants.status, 'published'));

    // Free-text search across variant and task fields
    if (search) {
      const searchPattern = `%${escapeLikePattern(search)}%`;
      conditions.push(
        or(
          ilike(taskVariants.name, searchPattern),
          ilike(taskVariants.description, searchPattern),
          ilike(tasks.name, searchPattern),
          ilike(tasks.slug, searchPattern),
          ilike(tasks.description, searchPattern),
        ) as SQL,
      );
    }

    // Structured filter expressions
    const filterCondition = buildFilterConditions(filters, TASK_VARIANTS_FILTER_COLUMNS);
    if (filterCondition) {
      conditions.push(filterCondition);
    }

    const whereClause = and(...conditions);

    // Count query
    const countResult = await this.db
      .select({ count: count() })
      .from(taskVariants)
      .innerJoin(tasks, eq(taskVariants.taskId, tasks.id))
      .where(whereClause);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortColumn = TASK_VARIANTS_SORT_COLUMNS[sortBy] ?? taskVariants.name;
    const sortDirection = sortOrder === SortOrder.ASC ? asc(sortColumn) : desc(sortColumn);

    const dataResult = await this.db
      .select({
        id: taskVariants.id,
        taskId: taskVariants.taskId,
        name: taskVariants.name,
        description: taskVariants.description,
        status: taskVariants.status,
        createdAt: taskVariants.createdAt,
        updatedAt: taskVariants.updatedAt,
        taskName: tasks.name,
        taskSlug: tasks.slug,
        taskImage: tasks.image,
      })
      .from(taskVariants)
      .innerJoin(tasks, eq(taskVariants.taskId, tasks.id))
      .where(whereClause)
      .orderBy(sortDirection, asc(taskVariants.id))
      .limit(perPage)
      .offset(offset);

    return { items: dataResult as TaskVariantWithTaskDetails[], totalItems };
  }
}
