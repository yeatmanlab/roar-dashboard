import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { administrations, administrationTaskVariants, taskVariants, tasks, type Administration } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { PaginationQuery, SortQuery, ADMINISTRATION_SORT_FIELDS } from '@roar-dashboard/api-contract';
import { BaseRepository, type PaginatedResult } from './base.repository';
import type { BasePaginatedQueryParams } from './interfaces/base.repository.interface';

/**
 * Task data for an administration.
 */
export interface AdministrationTask {
  taskId: string;
  taskName: string;
  variantId: string;
  variantName: string | null;
  orderIndex: number;
}

/**
 * Sort field type derived from api-contract.
 */
export type AdministrationSortField = (typeof ADMINISTRATION_SORT_FIELDS)[number];

/**
 * Query options for administration repository methods (API contract format).
 */
export type AdministrationQueryOptions = PaginationQuery & SortQuery<AdministrationSortField>;

/**
 * Administration Repository
 *
 * Provides data access methods for the administrations table.
 * Extends BaseRepository for standard CRUD operations.
 * Focused on data access - access control handled by AuthorizationRepository.
 */
export class AdministrationRepository extends BaseRepository<Administration, typeof administrations> {
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, administrations);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom methods (not part of BaseRepository)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get administrations by IDs with pagination and sorting.
   */
  async getByIds(ids: string[], options: BasePaginatedQueryParams): Promise<PaginatedResult<Administration>> {
    if (ids.length === 0) {
      return { items: [], totalItems: 0 };
    }

    return super.getAll({
      where: inArray(administrations.id, ids),
      ...options,
    });
  }

  /**
   * Get tasks (task variants) for multiple administrations.
   *
   * @param administrationIds - Array of administration IDs
   * @returns Map of administration ID to array of tasks, ordered by orderIndex
   */
  async getTasksByAdministrationIds(administrationIds: string[]): Promise<Map<string, AdministrationTask[]>> {
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
