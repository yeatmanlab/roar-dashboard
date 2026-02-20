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

  /**
   * Optional order by expressions. Can be:
   * - A single object with field and direction (legacy format for simple sorts)
   * - An array of SQL order expressions for multiple sorts (e.g., [desc(col), asc(id)])
   */
  orderBy?: { field: string; direction: 'asc' | 'desc' } | SQL[];
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
 * If no data is provided, a new entity will be created with a generated ID.
 */
export interface BaseCreateParams<T> {
  /** Optional data for the entity to be created. */
  data?: Partial<T>;

  /** Optional transaction context for the operation. */
  transaction?: Transaction;
}

/**
 * Parameters for updating an entity in a repository.
 */
export interface BaseUpdateParams<T> {
  /** ID of the entity to be updated. */
  id: string;

  /** Data for the entity to be updated. */
  data: Partial<T>;

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
 * @typeParam T - The type of entity managed by the repository.
 *
 * @see {@link BaseGetParams} - Base params for retrieving data entities.
 * @see {@link BaseGetAllParams} - Base params for retrieving all data entities.
 * @see {@link BaseCreateParams} - Base params for creating an entity.
 * @see {@link BaseUpdateParams} - Base params for updating an entity.
 * @see {@link BaseDeleteParams} - Base params for deleting an entity.
 * @see {@link BaseRunTransactionParams} - Parameters for running a transaction in a repository.
 */
export interface IBaseRepository<T> {
  /** Retrieves an entity by its ID. Returns null if not found. */
  getById(params: BaseGetByIdParams): Promise<T | null>;

  /** Retrieves an entity by its ID. */
  get(params: BaseGetParams & { id: string }): Promise<T | null>;

  /** Retrieves entities based on provided where clause. */
  get(params: BaseGetParams & { where: SQL }): Promise<T[]>;

  /** Retrieves entities based on provided parameters. */
  get(params: BaseGetParams): Promise<T | T[] | null>;

  /** Retrieves all entities with pagination, optional where clause, and ordering. */
  getAll(params: BaseGetAllParams): Promise<PaginatedResult<T>>;

  /** Creates a new entity in the repository. */
  create(params: BaseCreateParams<T>): Promise<T>;

  /** Updates an existing entity in the repository. */
  update(params: BaseUpdateParams<T>): Promise<void>;

  /** Deletes an entity from the repository. */
  delete(params: BaseDeleteParams): Promise<void>;

  /** Runs a transaction within the repository. */
  runTransaction<R>(params: BaseRunTransactionParams<R>): Promise<R>;

  /** Counts entities based on provided where clause. */
  count(params: BaseCountParams): Promise<number>;
}
