import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users, type User } from '../db/schema';
import { getCoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';

/**
 * User Repository
 *
 * Provides data access methods for the users table using Drizzle ORM.
 * Extends BaseRepository for standard CRUD operations.
 * Uses CoreDbClient by default, but accepts a custom DB client for testing.
 */
export class UserRepository extends BaseRepository<User, typeof users> {
  constructor(db?: NodePgDatabase<typeof CoreDbSchema>) {
    super(db ?? getCoreDbClient(), users);
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
    const [user] = await this.db.select().from(this.table).where(eq(users.authId, authId)).limit(1);

    return user ?? null;
  }
}
