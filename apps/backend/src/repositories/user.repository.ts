import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
import type { User } from '../db/schema';
import { users, userOrgs, userClasses, userGroups, userFamilies, orgs } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';
import { UserAccessControls } from './access-controls/user.access-controls';
import { isEnrollmentActive, isActiveInFamily } from './utils/enrollment.utils';
import { logger } from '../logger';

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
   * Get all active entity memberships for a user.
   *
   * Returns the IDs and entity types (district, school, class, group, family) that
   * the user currently belongs to, filtered by active enrollment/membership status.
   * Used by the service layer to batch-check FGA permissions across all entities.
   *
   * Org types are resolved by joining against the orgs table. Only `district` and
   * `school` org types are currently supported in the FGA model. Other org types
   * (national, state, local, department) are not yet used in ROAR — if encountered,
   * they are logged as warnings and excluded from results. When the org hierarchy is
   * extended to support these types, add corresponding FGA types and update this method.
   *
   * @param userId - The user ID to look up memberships for
   * @returns Array of { entityType, entityId } for all active memberships
   */
  async getUserEntityMemberships(
    userId: string,
  ): Promise<{ entityType: 'district' | 'school' | 'class' | 'group' | 'family'; entityId: string }[]> {
    const [orgRows, classRows, groupRows, familyRows] = await Promise.all([
      this.db
        .select({ entityId: userOrgs.orgId, orgType: orgs.orgType })
        .from(userOrgs)
        .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
        .where(and(eq(userOrgs.userId, userId), isEnrollmentActive(userOrgs))),
      this.db
        .select({ entityId: userClasses.classId })
        .from(userClasses)
        .where(and(eq(userClasses.userId, userId), isEnrollmentActive(userClasses))),
      this.db
        .select({ entityId: userGroups.groupId })
        .from(userGroups)
        .where(and(eq(userGroups.userId, userId), isEnrollmentActive(userGroups))),
      this.db
        .select({ entityId: userFamilies.familyId })
        .from(userFamilies)
        .where(and(eq(userFamilies.userId, userId), isActiveInFamily(userFamilies))),
    ]);

    // Map org types to FGA entity types. Only district and school are supported in the
    // FGA model today. Other org types (national, state, local, department) are not yet
    // used in ROAR — log a warning and skip them so the user gets a safe denial rather
    // than a false grant.
    const FGA_SUPPORTED_ORG_TYPES = new Set(['district', 'school']);
    const orgMemberships: { entityType: 'district' | 'school'; entityId: string }[] = [];
    for (const row of orgRows) {
      if (FGA_SUPPORTED_ORG_TYPES.has(row.orgType)) {
        orgMemberships.push({ entityType: row.orgType as 'district' | 'school', entityId: row.entityId });
      } else {
        logger.warn(
          { userId, orgId: row.entityId, orgType: row.orgType },
          'Skipping org membership with unsupported FGA org type',
        );
      }
    }

    return [
      ...orgMemberships,
      ...classRows.map((r) => ({ entityType: 'class' as const, entityId: r.entityId })),
      ...groupRows.map((r) => ({ entityType: 'group' as const, entityId: r.entityId })),
      ...familyRows.map((r) => ({ entityType: 'family' as const, entityId: r.entityId })),
    ];
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
