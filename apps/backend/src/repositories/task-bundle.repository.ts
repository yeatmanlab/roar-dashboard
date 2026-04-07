import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Column, SQL } from 'drizzle-orm';
import { and, asc, count, desc, ilike, or, sql } from 'drizzle-orm';
import type { TaskBundle } from '../db/schema';
import { taskBundles, taskBundleVariants, taskVariants, tasks } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type { PaginatedResult } from './base.repository';
import { BaseRepository } from './base.repository';
import type * as CoreDbSchema from '../db/schema/core';
import type { TaskBundleSortFieldType } from '@roar-dashboard/api-contract';
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
 * Explicit mapping from API sort field names to task bundle table columns.
 * Ensures only valid columns are used for sorting, even if API validation is bypassed.
 */
const TASK_BUNDLE_SORT_COLUMNS: Record<TaskBundleSortFieldType, Column> = {
  name: taskBundles.name,
  slug: taskBundles.slug,
  createdAt: taskBundles.createdAt,
  updatedAt: taskBundles.updatedAt,
};

/**
 * Allowed filter fields for the task bundle list, mapped to Drizzle column references.
 */
const TASK_BUNDLE_FILTER_COLUMNS: FilterFieldMap = {
  'taskBundle.slug': taskBundles.slug,
};

/**
 * Options for listing task bundles.
 */
export interface ListTaskBundlesOptions {
  page: number;
  perPage: number;
  sortBy: TaskBundleSortFieldType;
  sortOrder: SortOrder;
  search?: string;
  filters: ParsedFilter[];
}

/**
 * Repository for task bundle-related database operations.
 *
 * Provides paginated listing of task bundles with support for free-text search
 * across bundle fields and cross-table search via EXISTS subqueries into the
 * task_bundle_variants, task_variants, and tasks tables.
 *
 * Extends BaseRepository for standard CRUD operations.
 */
export class TaskBundleRepository extends BaseRepository<TaskBundle, typeof taskBundles> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, taskBundles);
  }

  /**
   * List task bundles with optional search, filtering, and sorting.
   *
   * Search is applied across:
   * - task_bundles.name and task_bundles.description (bundle-level fields)
   * - tasks.slug for any associated task variants (via EXISTS subquery)
   * - task_variants.name for any associated task variants (via EXISTS subquery)
   *
   * The EXISTS subquery avoids the cartesian product that a direct JOIN would
   * produce for bundles with multiple variants, keeping pagination correct.
   *
   * @param options - Pagination, sort, search, and filter options
   * @returns Paginated result with task bundles
   */
  async listAll(options: ListTaskBundlesOptions): Promise<PaginatedResult<TaskBundle>> {
    const { page, perPage, sortBy, sortOrder, search, filters } = options;
    const offset = (page - 1) * perPage;

    const conditions: SQL[] = [];

    // Free-text search: bundle fields directly, cross-table fields via EXISTS subquery
    if (search) {
      const searchPattern = `%${escapeLikePattern(search)}%`;
      conditions.push(
        or(
          ilike(taskBundles.name, searchPattern),
          ilike(taskBundles.description, searchPattern),
          // EXISTS subquery for variant name and task slug — avoids JOIN-induced row duplication
          sql`EXISTS (
            SELECT 1
            FROM ${taskBundleVariants}
            INNER JOIN ${taskVariants} ON ${taskBundleVariants.taskVariantId} = ${taskVariants.id}
            INNER JOIN ${tasks} ON ${taskVariants.taskId} = ${tasks.id}
            WHERE ${taskBundleVariants.taskBundleId} = ${taskBundles.id}
              AND (
                ${taskVariants.name} ILIKE ${searchPattern}
                OR ${tasks.slug} ILIKE ${searchPattern}
              )
          )`,
        ) as SQL,
      );
    }

    // Structured filter expressions (e.g. taskBundle.slug:eq:some-slug)
    const filterCondition = buildFilterConditions(filters, TASK_BUNDLE_FILTER_COLUMNS);
    if (filterCondition) {
      conditions.push(filterCondition);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count query
    const countResult = await this.db.select({ count: count() }).from(taskBundles).where(whereClause);

    const totalItems = countResult[0]?.count ?? 0;

    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const sortColumn = TASK_BUNDLE_SORT_COLUMNS[sortBy] ?? taskBundles.name;
    const sortDirection = sortOrder === SortOrder.ASC ? asc(sortColumn) : desc(sortColumn);

    const dataResult = await this.db
      .select()
      .from(taskBundles)
      .where(whereClause)
      .orderBy(sortDirection, asc(taskBundles.id))
      .limit(perPage)
      .offset(offset);

    return { items: dataResult, totalItems };
  }
}
