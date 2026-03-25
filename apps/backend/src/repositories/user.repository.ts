import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import { users, type User } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';
import { UserAccessControls } from './access-controls/user.access-controls';

/**
 * User Repository
 *
 * Provides data access methods for the users table using Drizzle ORM.
 * Extends BaseRepository for standard CRUD operations.
 * Uses CoreDbClient by default, but accepts a custom DB client for testing.
 */
export class UserRepository extends BaseRepository<User, typeof users> {
  private readonly accessControls: UserAccessControls;

  constructor(
    db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient,
    accessControls: UserAccessControls = new UserAccessControls(db),
  ) {
    super(db, users);
    this.accessControls = accessControls;
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

  /**
   * Get a single user by ID, only if the user is authorized to access it.
   *
   * Combines a direct lookup with an access control check. Returns the user
   * if found AND the user is authorized to access it, null otherwise (prevents existence leaking).
   *
   * @param accessControlFilter - User ID and allowed roles
   * @param id - The user ID to look up.
   * @returns The user record if found, null otherwise.
   */
  async getAuthorizedById(accessControlFilter: AccessControlFilter, id: string): Promise<User | null> {
    const accessibleUsers = this.accessControls.buildAccessibleUserIdsQuery(accessControlFilter).as('accessible_users');
    const result = await this.db
      .select({ user: users })
      .from(users)
      .innerJoin(accessibleUsers, eq(users.id, accessibleUsers.userId))
      .where(eq(users.id, id))
      .limit(1);

    const [user] = result;
    return user?.user ?? null;
  }
}
