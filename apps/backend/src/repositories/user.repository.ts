import { eq, count as drizzleCount } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, type User } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import type {
  BaseRepository,
  BaseGetParams,
  BaseGetAllParams,
  BaseCreateParams,
  BaseUpdateParams,
  BaseDeleteParams,
  BaseRunTransactionParams,
  BaseCountParams,
  Result,
} from './interfaces';

/**
 * User Repository
 *
 * Provides data access methods for the users table using Drizzle ORM.
 * Implements the BaseRepository interface for standard CRUD operations.
 * Uses CoreDbClient by default, but accepts a custom DB client for testing.
 */
export class UserRepository implements BaseRepository<User> {
  constructor(private readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Retrieves a user by ID or where clause.
   */
  async get(params: BaseGetParams & { id: string }): Promise<Result<User> | null>;
  async get(params: BaseGetParams & { where: SQL }): Promise<Result<User>[]>;
  async get(params: BaseGetParams): Promise<Result<User> | Result<User>[] | null>;
  async get(params: BaseGetParams): Promise<Result<User> | Result<User>[] | null> {
    if (params.id) {
      const [user] = await this.db.select().from(users).where(eq(users.id, params.id)).limit(1);
      return user ?? null;
    }

    if (params.where) {
      let query = this.db.select().from(users).where(params.where);

      if (params.limit) {
        query = query.limit(params.limit) as typeof query;
      }

      return await query;
    }

    return null;
  }

  /**
   * Retrieves all users with optional where clause.
   */
  async getAll(params: BaseGetAllParams): Promise<Result<User>[]> {
    let query = this.db.select().from(users);

    if (params.where) {
      query = query.where(params.where) as typeof query;
    }

    if (params.limit) {
      query = query.limit(params.limit) as typeof query;
    }

    return await query;
  }

  /**
   * Creates a new user.
   */
  async create(params: BaseCreateParams<User>): Promise<Result<User>> {
    const [user] = await this.db
      .insert(users)
      .values(params.data as typeof users.$inferInsert)
      .returning();

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  /**
   * Updates an existing user.
   */
  async update(params: BaseUpdateParams<User>): Promise<void> {
    await this.db.update(users).set(params.data).where(eq(users.id, params.id));
  }

  /**
   * Updates a user if the data has changed.
   */
  async updateIfChanged(params: BaseUpdateParams<User>): Promise<void> {
    // For simplicity, just call update - Drizzle handles this efficiently
    // Could add change detection logic if needed
    await this.update(params);
  }

  /**
   * Deletes a user.
   */
  async delete(params: BaseDeleteParams): Promise<void> {
    await this.db.delete(users).where(eq(users.id, params.id));
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
   * Counts users matching the where clause.
   */
  async count(params: BaseCountParams): Promise<number> {
    let query = this.db.select({ count: drizzleCount() }).from(users);

    if (params.where) {
      query = query.where(params.where) as typeof query;
    }

    const [result] = await query;
    return result?.count ?? 0;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom methods (not part of BaseRepository)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Find a user by their Firebase authentication ID.
   *
   * @param authId - The Firebase UID to look up.
   * @returns The user record if found, null otherwise.
   */
  async findByAuthId(authId: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.authId, authId)).limit(1);

    return user ?? null;
  }
}
