import { eq, and, or, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { User, NewUser, NewUserOrg, NewUserClass, NewUserGroup, NewUserFamily } from '../db/schema';
import { EntityType } from '../types/entity-type';
import { users, userOrgs, userClasses, userGroups, userFamilies, orgs, classes } from '../db/schema';
import { CoreDbClient } from '../db/clients';
import type { CoreTransaction } from '../db/clients';
import type * as CoreDbSchema from '../db/schema/core';
import { BaseRepository } from './base.repository';
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
  constructor(db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {
    super(db, users);
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
  async getUserEntityMemberships(userId: string): Promise<{ entityType: EntityType; entityId: string }[]> {
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
    const FGA_SUPPORTED_ORG_TYPES: ReadonlySet<string> = new Set([EntityType.DISTRICT, EntityType.SCHOOL]);
    const orgMemberships: { entityType: EntityType; entityId: string }[] = [];
    for (const row of orgRows) {
      if (FGA_SUPPORTED_ORG_TYPES.has(row.orgType)) {
        // The type assertion here is safe because we are filtering by supported types
        // (strictly 'school' or 'district'), but TypeScript can't infer that statically.
        orgMemberships.push({ entityType: row.orgType as EntityType, entityId: row.entityId });
      } else {
        logger.warn(
          { userId, orgId: row.entityId, orgType: row.orgType },
          'Skipping org membership with unsupported FGA org type',
        );
      }
    }

    return [
      ...orgMemberships,
      ...classRows.map((r) => ({ entityType: EntityType.CLASS, entityId: r.entityId })),
      ...groupRows.map((r) => ({ entityType: EntityType.GROUP, entityId: r.entityId })),
      ...familyRows.map((r) => ({ entityType: EntityType.FAMILY, entityId: r.entityId })),
    ];
  }

  /**
   * Resolve the parent school ID for an active class.
   *
   * Returns null if the class doesn't exist, the class is rostered out, or the parent
   * school is rostered out. All three are treated identically — callers should return
   * 422 without distinguishing between them.
   *
   * The service layer also uses the returned school ID to check `can_create_users` on
   * the parent school (not the class itself), because the FGA model does not define
   * `can_create_users` on the `class` type.
   *
   * @param classId - UUID of the class
   * @returns The parent school's org ID, or null if the class or school is unavailable
   */
  async findClassParentSchool(classId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ schoolId: classes.schoolId })
      .from(classes)
      .innerJoin(orgs, and(eq(orgs.id, classes.schoolId), isNull(orgs.rosteringEnded)))
      .where(and(eq(classes.id, classId), isNull(classes.rosteringEnded)))
      .limit(1);
    return row?.schoolId ?? null;
  }

  /**
   * Create a user row and all junction-table memberships in a single DB transaction.
   *
   * Inserts the `users` row and all `user_orgs`, `user_classes`, `user_groups`, and
   * `user_families` rows within the supplied transaction.
   *
   * The caller is responsible for managing the transaction lifecycle. Use
   * `runTransaction` to open one:
   *
   * ```typescript
   * await repository.runTransaction({
   *   fn: (tx) => repository.createWithMemberships(userData, orgs, classes, groups, families, tx),
   * });
   * ```
   *
   * Firebase Auth creation and FGA tuple writes always happen outside this method.
   *
   * @param userData - The user fields to insert (excluding system-managed fields)
   * @param orgMemberships - Rows to insert into `user_orgs`
   * @param classMemberships - Rows to insert into `user_classes`
   * @param groupMemberships - Rows to insert into `user_groups`
   * @param familyMemberships - Rows to insert into `user_families`
   * @param transaction - The active transaction to execute writes within
   * @returns The newly created user's ID
   */
  async createWithMemberships(
    userData: Omit<NewUser, 'id'>,
    orgMemberships: Omit<NewUserOrg, 'userId'>[],
    classMemberships: Omit<NewUserClass, 'userId'>[],
    groupMemberships: Omit<NewUserGroup, 'userId'>[],
    familyMemberships: Omit<NewUserFamily, 'userId'>[],
    transaction: CoreTransaction,
  ): Promise<{ id: string }> {
    const [created] = await transaction.insert(users).values(userData).returning({ id: users.id });

    if (!created) {
      throw new Error('User insert returned no rows');
    }

    const { id: userId } = created;

    if (orgMemberships.length > 0) {
      await transaction.insert(userOrgs).values(orgMemberships.map((m) => ({ ...m, userId })));
    }

    if (classMemberships.length > 0) {
      await transaction.insert(userClasses).values(classMemberships.map((m) => ({ ...m, userId })));
    }

    if (groupMemberships.length > 0) {
      await transaction.insert(userGroups).values(groupMemberships.map((m) => ({ ...m, userId })));
    }

    if (familyMemberships.length > 0) {
      await transaction.insert(userFamilies).values(familyMemberships.map((m) => ({ ...m, userId })));
    }

    return { id: userId };
  }

  /**
   * Check whether a user with the given email, username, or assessmentPid already exists.
   * Note that this method does not filter by a user's rostering status, so it will return true for users who are inactive.
   *
   * Used for pre-flight uniqueness checks before writing to Firebase Auth or the DB,
   * to surface 409 Conflict early without initiating any external writes.
   *
   * @param params - At least one of email, username, or assessmentPid must be provided
   * @returns true if a matching row exists
   */
  async existsByUniqueFields({
    email,
    username,
    assessmentPid,
  }: {
    email?: string;
    username?: string;
    assessmentPid?: string;
  }): Promise<boolean> {
    const conditions = [
      email ? eq(users.email, email) : null,
      username ? eq(users.username, username) : null,
      assessmentPid ? eq(users.assessmentPid, assessmentPid) : null,
    ].filter((c) => c !== null);

    if (conditions.length === 0) return false;

    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(or(...conditions))
      .limit(1);

    return row !== undefined;
  }
}
