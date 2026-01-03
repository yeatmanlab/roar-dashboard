import { eq, ilike, or, asc, desc, count as drizzleCount, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { administrations, type Administration } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type {
  PaginationQuery,
  SearchQuery,
  SortQuery,
  PaginatedResult,
  ADMINISTRATION_SORT_FIELDS,
} from '@roar-dashboard/api-contract';

/**
 * Sort field type derived from api-contract.
 */
export type AdministrationSortField = (typeof ADMINISTRATION_SORT_FIELDS)[number];

/**
 * Query options for administration repository methods.
 */
export type AdministrationQueryOptions = PaginationQuery & SearchQuery & SortQuery<AdministrationSortField>;

/**
 * Administration Repository
 *
 * Provides data access methods for the administrations table.
 * Focused on CRUD operations - access control handled by AuthorizationRepository.
 */
export class AdministrationRepository {
  constructor(private readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Get all administrations with pagination, search, and sorting.
   */
  async getAll(options: AdministrationQueryOptions): Promise<PaginatedResult<Administration>> {
    const { page, perPage, search, sortBy, sortOrder } = options;
    const offset = (page - 1) * perPage;

    const whereClause = this.buildSearchClause(search);
    const orderClause = this.buildOrderClause(sortBy, sortOrder);

    // Count
    let countQuery = this.db.select({ count: drizzleCount() }).from(administrations);
    if (whereClause) {
      countQuery = countQuery.where(whereClause) as typeof countQuery;
    }
    const [countResult] = await countQuery;
    const totalItems = countResult?.count ?? 0;

    // Items
    let query = this.db.select().from(administrations);
    if (whereClause) {
      query = query.where(whereClause) as typeof query;
    }
    const items = await query.orderBy(orderClause).limit(perPage).offset(offset);

    return { items, totalItems };
  }

  /**
   * Get administrations by IDs with pagination, search, and sorting.
   */
  async getByIds(ids: string[], options: AdministrationQueryOptions): Promise<PaginatedResult<Administration>> {
    if (ids.length === 0) {
      return { items: [], totalItems: 0 };
    }

    const { page, perPage, search, sortBy, sortOrder } = options;
    const offset = (page - 1) * perPage;

    const whereClause = this.buildWhereClause(ids, search);
    const orderClause = this.buildOrderClause(sortBy, sortOrder);

    // Count
    const [countResult] = await this.db.select({ count: drizzleCount() }).from(administrations).where(whereClause);
    const totalItems = countResult?.count ?? 0;

    // Items
    const items = await this.db
      .select()
      .from(administrations)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(perPage)
      .offset(offset);

    return { items, totalItems };
  }

  /**
   * Get a single administration by ID.
   */
  async get(id: string): Promise<Administration | null> {
    const [result] = await this.db.select().from(administrations).where(eq(administrations.id, id)).limit(1);
    return result ?? null;
  }

  /**
   * Build where clause combining ID filter and search.
   */
  private buildWhereClause(ids: string[], search?: string): SQL {
    const idClause = inArray(administrations.id, ids);
    const searchClause = this.buildSearchClause(search);

    if (searchClause) {
      return or(idClause, searchClause) as SQL;
    }
    return idClause;
  }

  /**
   * Build search clause for name fields.
   */
  private buildSearchClause(search?: string): SQL | undefined {
    if (!search) return undefined;
    return or(ilike(administrations.nameInternal, `%${search}%`), ilike(administrations.namePublic, `%${search}%`));
  }

  /**
   * Build order clause from sortBy and sortOrder.
   */
  private buildOrderClause(sortBy: AdministrationSortField, sortOrder: 'asc' | 'desc') {
    const direction = sortOrder === 'asc' ? asc : desc;
    switch (sortBy) {
      case 'name':
        return direction(administrations.nameInternal);
      case 'dateStart':
        return direction(administrations.dateStart);
      case 'dateEnd':
        return direction(administrations.dateEnd);
      case 'createdAt':
      default:
        return direction(administrations.createdAt);
    }
  }
}
