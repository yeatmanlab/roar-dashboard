import { eq, count as drizzleCount, asc, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTable } from 'drizzle-orm/pg-core';
import type {
  IBaseRepository,
  BaseGetByIdParams,
  BaseGetParams,
  BaseGetAllParams,
  BaseCreateParams,
  BaseCreateManyParams,
  BaseUpdateParams,
  BaseDeleteParams,
  BaseRunTransactionParams,
  BaseCountParams,
  PaginatedResult,
} from './interfaces/base.repository.interface';

// Re-export PaginatedResult for convenience
export type { PaginatedResult } from './interfaces/base.repository.interface';

/**
 * Abstract base repository for Drizzle ORM.
 *
 * Provides standard CRUD operations for any Drizzle PgTable.
 * All tables are expected to have a UUID `id` column as primary key.
 *
 * This base repository is aligned with `stanford-roar-firebase-functions/packages/core` BaseRepository pattern to
 * ensure consistency across both codebases and allow easier porting of logic.
 *
 * @typeParam TEntity - The select type of the entity (from $inferSelect)
 * @typeParam TTable - The Drizzle PgTable reference
 * @typeParam TInsert - The insert type of the entity (from $inferInsert)
 *
 * @example
 * ```typescript
 * export class UserRepository extends BaseRepository<User, typeof users> {
 *   constructor(db = CoreDbClient) {
 *     super(db, users);
 *   }
 *
 *   // Custom methods beyond CRUD
 *   async findByAuthId(authId: string): Promise<User | null> { ... }
 * }
 * ```
 */
export abstract class BaseRepository<
  TEntity extends Record<string, unknown>,
  TTable extends PgTable,
  TInsert extends Record<string, unknown> = TEntity,
> implements IBaseRepository<TEntity, TInsert>
{
  /**
   * Type-safe table reference for Drizzle queries.
   *
   * Why `any`? Drizzle's PgTable type uses complex conditional types that don't resolve
   * correctly with TypeScript generics. When accessing dynamic column names (e.g., `table.id`
   * or `table[orderBy.field]`), TypeScript can't infer the column type from the generic TTable.
   * This cast allows runtime column access while maintaining type safety at the API boundary.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly typedTable: PgTable & Record<string, any>;

  /**
   * @param db - Drizzle database client. Uses `any` for schema type because repositories
   *             may use different database schemas (core vs assessment) and Drizzle's
   *             NodePgDatabase type requires the exact schema type parameter.
   * @param table - The Drizzle table reference for this repository
   */
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected readonly db: NodePgDatabase<any>,
    protected readonly table: TTable,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.typedTable = table as PgTable & Record<string, any>;
  }

  /**
   * Retrieves an entity by its primary key. Returns null if not found.
   */
  async getById(params: BaseGetByIdParams): Promise<TEntity | null> {
    const idColumn = this.typedTable.id as Parameters<typeof eq>[0];
    const [entity] = await this.db.select().from(this.typedTable).where(eq(idColumn, params.id)).limit(1);
    return (entity as TEntity) ?? null;
  }

  /**
   * Retrieves an entity by ID or where clause.
   */
  async get(params: BaseGetParams & { id: string }): Promise<TEntity | null>;
  async get(params: BaseGetParams & { where: SQL }): Promise<TEntity[]>;
  async get(params: BaseGetParams): Promise<TEntity | TEntity[] | null>;
  async get(params: BaseGetParams): Promise<TEntity | TEntity[] | null> {
    if (params.id) {
      const idColumn = this.typedTable.id as Parameters<typeof eq>[0];
      const [entity] = await this.db.select().from(this.typedTable).where(eq(idColumn, params.id)).limit(1);
      return (entity as TEntity) ?? null;
    }

    if (params.where) {
      const query = this.db.select().from(this.typedTable).$dynamic();
      query.where(params.where);

      if (params.limit) {
        query.limit(params.limit);
      }

      return (await query) as TEntity[];
    }

    return null;
  }

  /**
   * Retrieves all entities with pagination, optional filtering, and ordering.
   */
  async getAll(params: BaseGetAllParams): Promise<PaginatedResult<TEntity>> {
    const { where, page, perPage, orderBy } = params;
    const offset = this.calculateOffset(page, perPage);

    // Count query
    const countQuery = this.db.select({ count: drizzleCount() }).from(this.typedTable).$dynamic();
    if (where) {
      countQuery.where(where);
    }
    const [countResult] = await countQuery;
    const totalItems = countResult?.count ?? 0;

    // Items query
    const itemsQuery = this.db.select().from(this.typedTable).$dynamic();
    if (where) {
      itemsQuery.where(where);
    }
    if (orderBy) {
      const column = this.typedTable[orderBy.field] as Parameters<typeof asc>[0];
      itemsQuery.orderBy(this.buildOrderClause(column, orderBy.direction));
    }
    itemsQuery.limit(perPage).offset(offset);
    const items = (await itemsQuery) as TEntity[];

    return { items, totalItems };
  }

  /**
   * Creates a new entity.
   */
  async create(params: BaseCreateParams<TInsert>): Promise<{ id: string } | undefined> {
    const { transaction } = params;
    const db = transaction ?? this.db;

    const [entity] = await db
      .insert(this.typedTable)
      .values(params.data as TInsert)
      .returning({ id: this.typedTable.id });

    return entity;
  }

  /**
   * Creates multiple entities in a single operation.
   *
   * This method faithfully returns what the database created without validation.
   * It is the caller's responsibility to verify the result matches expectations.
   *
   * @param params - Create parameters with array of entity data
   * @returns Array of created entity IDs. May be empty or contain fewer items than input
   *          if database constraints, triggers, or other issues prevent some insertions.
   *
   * @example
   * ```typescript
   * const result = await repo.createMany({ data: [item1, item2, item3] });
   *
   * // Caller validates at service layer based on business rules
   * if (result.length !== 3) {
   *   throw new ApiError('Failed to create all items', {
   *     context: { expected: 3, created: result.length }
   *   });
   * }
   * ```
   */
  async createMany(params: BaseCreateManyParams<TInsert>): Promise<{ id: string }[]> {
    const { transaction } = params;
    const db = transaction ?? this.db;

    if (!params.data || params.data.length === 0) {
      return [];
    }

    const entities = await db.insert(this.typedTable).values(params.data).returning({ id: this.typedTable.id });

    return entities;
  }

  /**
   * Updates an existing entity.
   */
  async update(params: BaseUpdateParams<TEntity>): Promise<void> {
    const idColumn = this.typedTable.id as Parameters<typeof eq>[0];
    await this.db.update(this.typedTable).set(params.data).where(eq(idColumn, params.id));
  }

  /**
   * Deletes an entity by ID.
   */
  async delete(params: BaseDeleteParams): Promise<void> {
    const idColumn = this.typedTable.id as Parameters<typeof eq>[0];
    await this.db.delete(this.typedTable).where(eq(idColumn, params.id));
  }

  /**
   * Runs a transaction.
   */
  async runTransaction<R>(params: BaseRunTransactionParams<R>): Promise<R> {
    return await this.db.transaction(async (tx) => {
      return await params.fn(tx);
    });
  }

  /**
   * Counts entities matching the where clause.
   */
  async count(params: BaseCountParams): Promise<number> {
    const query = this.db.select({ count: drizzleCount() }).from(this.typedTable).$dynamic();

    if (params.where) {
      query.where(params.where);
    }

    const [result] = await query;
    return result?.count ?? 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Protected helper methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Calculate offset for pagination.
   */
  protected calculateOffset(page: number, perPage: number): number {
    return (page - 1) * perPage;
  }

  /**
   * Build order clause from column and direction.
   */
  protected buildOrderClause(column: Parameters<typeof asc>[0], direction: 'asc' | 'desc'): SQL {
    return direction === 'asc' ? asc(column) : desc(column);
  }
}
