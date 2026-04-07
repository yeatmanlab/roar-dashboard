import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as CoreDbSchema from '../db/schema/core';
import type { Column, SQL } from 'drizzle-orm';
import { eq, and, or, ilike, asc, desc, count } from 'drizzle-orm';
import type { Task } from '../db/schema';
import { tasks } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type { TaskSortFieldType } from '@roar-dashboard/api-contract';
import { SortOrder } from '@roar-dashboard/api-contract';
import { escapeLikePattern } from '../utils/escape-like-pattern.util';

/**
 * Explicit mapping from API sort field names to task table columns.
 * This ensures only valid columns are used for sorting, even if API validation is bypassed.
 */
const TASK_SORT_COLUMNS: Record<TaskSortFieldType, Column> = {
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  name: tasks.name,
  slug: tasks.slug,
};

/**
 * Options for listing tasks.
 */
export interface ListTasksOptions {
  page: number;
  perPage: number;
  orderBy?: {
    field: TaskSortFieldType;
    direction: SortOrder;
  };
  slug?: string;
  search?: string;
}

/**
 * Repository for task-related database operations.
 *
 * Provides CRUD operations for tasks (assessments) in the system.
 * Extends BaseRepository with task-specific query methods.
 */
export class TaskRepository extends BaseRepository<Task, typeof tasks> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, tasks);
  }

  /**
   * Retrieves a task by its unique slug.
   *
   * Slugs are unique identifiers in a URL-friendly format (e.g., 'swr', 'letter-task').
   *
   * @param slug - The unique slug of the task to retrieve
   * @returns The task with the given slug, or null if not found
   *
   * @example
   * ```typescript
   * const task = await taskRepository.getBySlug('swr');
   * if (task) {
   *   console.log(task.name); // "Single Word Reading"
   * }
   * ```
   */
  async getBySlug(slug: string): Promise<Task | null> {
    const results = await this.get({
      where: eq(tasks.slug, slug),
      limit: 1,
    });

    return results[0] ?? null;
  }

  /**
   * List all tasks with optional filtering and sorting.
   *
   * Tasks are global resources (not tied to org hierarchy), so there is no
   * authorization filtering. All authenticated users can view all tasks.
   *
   * @param options - Pagination, sorting, and filter options
   * @returns Paginated result with tasks
   */
  async listAll(options: ListTasksOptions): Promise<PaginatedResult<Task>> {
    const { page, perPage, orderBy, slug, search } = options;
    const offset = (page - 1) * perPage;

    // Build where conditions
    const conditions: SQL[] = [];

    // Exact slug match filter
    if (slug) {
      conditions.push(eq(tasks.slug, slug));
    }

    // Search filter (name or description)
    if (search) {
      const escapedSearch = escapeLikePattern(search);
      const searchPattern = `%${escapedSearch}%`;
      conditions.push(or(ilike(tasks.name, searchPattern), ilike(tasks.description, searchPattern)) as SQL);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count query
    const countResult = await this.db.select({ count: count() }).from(tasks).where(whereClause);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    // Use explicit column mapping for type safety
    // Cast is safe because API contract validates the sort field before reaching repository
    const sortField = orderBy?.field as TaskSortFieldType | undefined;
    const sortColumn = (sortField && TASK_SORT_COLUMNS[sortField]) ?? tasks.name;
    const sortDirection = (orderBy?.direction ?? SortOrder.ASC) === SortOrder.ASC ? asc(sortColumn) : desc(sortColumn);

    // Data query
    const dataResult = await this.db
      .select()
      .from(tasks)
      .where(whereClause)
      .orderBy(sortDirection, asc(tasks.id))
      .limit(perPage)
      .offset(offset);

    return {
      items: dataResult,
      totalItems,
    };
  }
}
