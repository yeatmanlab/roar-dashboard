import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { administrations, type Administration } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type { PaginationQuery, SortQuery, ADMINISTRATION_SORT_FIELDS } from '@roar-dashboard/api-contract';
import { BaseRepository, type PaginatedResult } from './base.repository';
import type { BasePaginatedQueryParams } from './interfaces/base.repository.interface';

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
}
