import type { SQL } from 'drizzle-orm';

/**
 * Generic transaction type for database operations.
 * This will be implemented by specific database adapters (e.g., Drizzle).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Transaction = any;

/**
 * Base parameters for repository operations.
 */
export interface BaseParams {
  /** Optional transaction context for the operation. */
  transaction?: Transaction;

  /** Optional limit for the number of results. */
  limit?: number;

  /** Optional fields to select from the entities. */
  select?: string[];

  /** Optional order by field */
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Parameters for retrieving data from a repository.
 *
 * If id is provided, retrieve a specific entity.
 * If where is provided, retrieve entities that match the condition.
 * If transaction is provided, execute the operation within the transaction.
 * If limit is provided, limit the number of results.
 * If select is provided, select specific fields from the entities.
 */
export interface BaseGetParams extends BaseParams {
  /** ID for specific entity retrieval. */
  id?: string;

  /** Drizzle SQL where clause for entity retrieval. */
  where?: SQL;
}

/**
 * Params for retrieving an entity by its primary key.
 */
export interface BaseGetByIdParams extends BaseParams {
  /** The entity's UUID primary key. */
  id: string;
}

/**
 * Params for retrieving entities using a where clause.
 */
export interface BaseGetByWhereParams extends BaseParams {
  /** The Drizzle SQL where clause. */
  where: SQL;
}

/**
 * Shared pagination parameters for paginated queries.
 * Used by both getAll() and getByIds() methods.
 */
export interface BasePaginatedQueryParams {
  /** Page number (1-indexed). Required for paginated queries. */
  page: number;

  /** Number of items per page. Required for paginated queries. */
  perPage: number;

  /** Optional order by field and direction. */
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Parameters for retrieving all entities from a repository.
 * Supports pagination, filtering, and ordering.
 */
export interface BaseGetAllParams extends BasePaginatedQueryParams {
  /** Optional Drizzle SQL where clause. */
  where?: SQL;

  /** Optional transaction context for the operation. */
  transaction?: Transaction;

  /** Optional limit for the number of results. */
  limit?: number;

  /** Optional fields to select from the entities. */
  select?: string[];
}

/**
 * Result of a paginated query.
 */
export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
}

/**
 * Parameters for counting entities in a repository.
 */
export interface BaseCountParams extends BaseParams {
  /** Optional Drizzle SQL where clause for counting. */
  where?: SQL;
}

/**
 * Parameters for creating a new entity in a repository.
 *
 * @typeParam TInsert - The insert type (from Drizzle's $inferInsert), which correctly
 *                      types optional fields for insertion.
 */
export interface BaseCreateParams<TInsert> {
  /** Data for the entity to be created (uses the Drizzle insert type). */
  data: TInsert;

  /** Optional transaction context for the operation. */
  transaction?: Transaction;
}

export interface BaseCreateManyParams<T> {
  /** Data for the entities to be created. */
  data: Partial<T>[];

  /** Optional transaction context for the operation. */
  transaction?: Transaction;
}

/**
 * Parameters for updating an entity in a repository.
 *
 * @typeParam TInsert - The insert type (from Drizzle's $inferInsert), which correctly
 *                      types optional fields for updates.
 */
export interface BaseUpdateParams<TInsert> {
  /** ID of the entity to be updated. */
  id: string;

  /** Data for the entity to be updated (partial insert type). */
  data: Partial<TInsert>;

  /** Optional transaction context for the operation. */
  transaction?: Transaction;
}

/**
 * Parameters for deleting an entity in a repository.
 */
export interface BaseDeleteParams {
  /** ID of the entity to be deleted. */
  id: string;

  /** Optional transaction context for the operation. */
  transaction?: Transaction;
}

/**
 * Parameters for running a transaction in a repository.
 */
export interface BaseRunTransactionParams<R> {
  /** Function to be executed within the transaction. */
  fn: (transaction: Transaction) => Promise<R>;
  /** Number of retries on transaction failure. */
  retries?: number;
  /** Timeout in milliseconds. */
  timeout?: number;
}

/**
 * Base repository interface that defines standard operations for data access.
 *
 * All entities are expected to have an `id` field (UUID primary key).
 * Unlike Firestore's Result<T> wrapper, Drizzle entities already include the id.
 *
 * @typeParam TEntity - The select type of the entity (from Drizzle's $inferSelect).
 * @typeParam TInsert - The insert type of the entity (from Drizzle's $inferInsert). Defaults to TEntity.
 *
 * @see {@link BaseGetParams} - Base params for retrieving data entities.
 * @see {@link BaseGetAllParams} - Base params for retrieving all data entities.
 * @see {@link BaseCreateParams} - Base params for creating an entity.
 * @see {@link BaseUpdateParams} - Base params for updating an entity.
 * @see {@link BaseDeleteParams} - Base params for deleting an entity.
 * @see {@link BaseRunTransactionParams} - Parameters for running a transaction in a repository.
 */
export interface IBaseRepository<TEntity, TInsert = TEntity> {
  /** Retrieves an entity by its ID. Returns null if not found. */
  getById(params: BaseGetByIdParams): Promise<TEntity | null>;

  /** Retrieves an entity by its ID. */
  get(params: BaseGetParams & { id: string }): Promise<TEntity | null>;

  /** Retrieves entities based on provided where clause. */
  get(params: BaseGetParams & { where: SQL }): Promise<TEntity[]>;

  /** Retrieves entities based on provided parameters. */
  get(params: BaseGetParams): Promise<TEntity | TEntity[] | null>;

  /** Retrieves all entities with pagination, optional where clause, and ordering. */
  getAll(params: BaseGetAllParams): Promise<PaginatedResult<TEntity>>;

  /** Creates a new entity in the repository. */
  create(params: BaseCreateParams<TInsert>): Promise<TEntity>;

  /** Creates multiple entities in the repository. */
  createMany(params: BaseCreateManyParams<TInsert>): Promise<{ id: string }[]>;

  /** Updates an existing entity in the repository. */
  update(params: BaseUpdateParams<TInsert>): Promise<void>;

  /** Deletes an entity from the repository. */
  delete(params: BaseDeleteParams): Promise<void>;

  /** Runs a transaction within the repository. */
  runTransaction<R>(params: BaseRunTransactionParams<R>): Promise<R>;

  /** Counts entities based on provided where clause. */
  count(params: BaseCountParams): Promise<number>;
}
