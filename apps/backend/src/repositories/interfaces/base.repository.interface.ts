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
 * Params for retrieving a document by ID.
 */
export interface BaseGetByIdParams extends BaseParams {
  /** The document ID to retrieve. */
  id: string;
}

/**
 * Params for retrieving documents using a where clause.
 */
export interface BaseGetByWhereParams extends BaseParams {
  /** The Drizzle SQL where clause */
  where: SQL;
}

/**
 * Parameters for retrieving all entities from a repository.
 */
export interface BaseGetAllParams extends BaseParams {
  /** Optional Drizzle SQL where clause. */
  where?: SQL;
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
 * Result type that includes the entity with its ID.
 */
export type Result<T> = T & { id: string };

/**
 * Base repository interface that defines standard operations for data access.
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
export interface BaseRepository<T> {
  /** Retrieves an entity by its ID. */
  get(params: BaseGetParams & { id: string }): Promise<Result<T> | null>;

  /** Retrieves entities based on provided where clause. */
  get(params: BaseGetParams & { where: SQL }): Promise<Result<T>[]>;

  /** Retrieves entities based on provided parameters. */
  get(params: BaseGetParams): Promise<Result<T> | Result<T>[] | null>;

  /** Retrieves all entities with optional where clause. */
  getAll(params: BaseGetAllParams): Promise<Result<T>[]>;

  /** Creates a new entity in the repository. */
  create(params: BaseCreateParams<T>): Promise<Result<T>>;

  /** Updates an existing entity in the repository. */
  update(params: BaseUpdateParams<T>): Promise<void>;

  /** Updates an existing entity in the repository if the data has changed. */
  updateIfChanged(params: BaseUpdateParams<T>): Promise<void>;

  /** Deletes an entity from the repository. */
  delete(params: BaseDeleteParams): Promise<void>;

  /** Runs a transaction within the repository. */
  runTransaction<R>(params: BaseRunTransactionParams<R>): Promise<R>;

  /** Counts entities based on provided where clause. */
  count(params: BaseCountParams): Promise<number>;
}
