import { eq, and, or, isNull, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { User, NewUser, NewUserOrg, NewUserClass, NewUserGroup, NewUserFamily } from '../db/schema';
import { EntityType } from '../types/entity-type';
import type { UserRole } from '../enums/user-role.enum';
import type { UserFamilyRole } from '../enums/user-family-role.enum';
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

  /**
   * Find all users whose email matches any in the provided list, case-insensitively.
   *
   * Used by the bulk-import pre-flight to classify each row as create vs. update/unenroll by
   * existence. Matching is case-insensitive to mirror the legacy classification (Firebase Auth
   * treats emails case-insensitively) and to avoid misclassifying a cased variant as a new create
   * that would then collide at Firebase. Rostered-out users are included — their email still
   * occupies the unique field — so a re-import resolves to the existing user rather than a create.
   *
   * @param emails - The emails to look up.
   * @returns The matching user records (may be fewer than the input when some don't exist).
   *
   * @NOTE The `lower(email)` predicate won't use the plain email index. For the bulk-import batch
   *   size (≤100) against admin-initiated requests this is acceptable; a functional index on
   *   `lower(email)` (or normalizing emails to lowercase on write) would remove the scan at scale.
   */
  async findByEmails(emails: string[]): Promise<User[]> {
    if (emails.length === 0) return [];

    const lowered = emails.map((email) => email.toLowerCase());

    return this.db
      .select()
      .from(users)
      .where(inArray(sql<string>`lower(${users.email})`, lowered));
  }

  /**
   * End all of a user's currently-active enrollments by stamping the end date on every open junction
   * row across orgs, classes, groups, and families.
   *
   * Used by the bulk-import unenroll bin, which — matching the legacy `batchImportUpdate` — ends ALL
   * of a user's enrollments (not just the memberships named in the request). Already-ended rows are
   * left untouched so their original end date is preserved.
   *
   * @param userId - The user whose enrollments to end.
   * @param transaction - Optional transaction so the caller can archive the user and clean up FGA in
   *   the same unit of work.
   */
  async endAllEnrollments(userId: string, transaction?: CoreTransaction): Promise<void> {
    const db = transaction ?? this.db;
    const endedAt = new Date();

    // Sequential (not Promise.all) so this is safe inside a single transaction/connection.
    await db
      .update(userOrgs)
      .set({ enrollmentEnd: endedAt })
      .where(and(eq(userOrgs.userId, userId), isNull(userOrgs.enrollmentEnd)));
    await db
      .update(userClasses)
      .set({ enrollmentEnd: endedAt })
      .where(and(eq(userClasses.userId, userId), isNull(userClasses.enrollmentEnd)));
    await db
      .update(userGroups)
      .set({ enrollmentEnd: endedAt })
      .where(and(eq(userGroups.userId, userId), isNull(userGroups.enrollmentEnd)));
    await db
      .update(userFamilies)
      .set({ leftOn: endedAt })
      .where(and(eq(userFamilies.userId, userId), isNull(userFamilies.leftOn)));
  }

  /**
   * Return a user's active memberships with their roles, across orgs, classes, groups, and families.
   *
   * Mirrors {@link getUserEntityMemberships} (same active-enrollment filtering and org-type mapping)
   * but additionally returns the role, which the unenroll flow needs to reconstruct the FGA tuples to
   * delete. Org memberships with FGA-unsupported org types are dropped (logged by
   * {@link getUserEntityMemberships}).
   *
   * @param userId - The user to look up.
   * @returns Active memberships as `{ entityType, entityId, role }`.
   */
  async getActiveMembershipsWithRoles(
    userId: string,
  ): Promise<{ entityType: EntityType; entityId: string; role: string }[]> {
    const [orgRows, classRows, groupRows, familyRows] = await Promise.all([
      this.db
        .select({ entityId: userOrgs.orgId, orgType: orgs.orgType, role: userOrgs.role })
        .from(userOrgs)
        .innerJoin(orgs, eq(userOrgs.orgId, orgs.id))
        .where(and(eq(userOrgs.userId, userId), isEnrollmentActive(userOrgs))),
      this.db
        .select({ entityId: userClasses.classId, role: userClasses.role })
        .from(userClasses)
        .where(and(eq(userClasses.userId, userId), isEnrollmentActive(userClasses))),
      this.db
        .select({ entityId: userGroups.groupId, role: userGroups.role })
        .from(userGroups)
        .where(and(eq(userGroups.userId, userId), isEnrollmentActive(userGroups))),
      this.db
        .select({ entityId: userFamilies.familyId, role: userFamilies.role })
        .from(userFamilies)
        .where(and(eq(userFamilies.userId, userId), isActiveInFamily(userFamilies))),
    ]);

    const FGA_SUPPORTED_ORG_TYPES: ReadonlySet<string> = new Set([EntityType.DISTRICT, EntityType.SCHOOL]);
    const orgMemberships: { entityType: EntityType; entityId: string; role: string }[] = [];
    for (const row of orgRows) {
      if (FGA_SUPPORTED_ORG_TYPES.has(row.orgType)) {
        orgMemberships.push({ entityType: row.orgType as EntityType, entityId: row.entityId, role: row.role });
      }
    }

    return [
      ...orgMemberships,
      ...classRows.map((r) => ({ entityType: EntityType.CLASS, entityId: r.entityId, role: r.role })),
      ...groupRows.map((r) => ({ entityType: EntityType.GROUP, entityId: r.entityId, role: r.role })),
      ...familyRows.map((r) => ({ entityType: EntityType.FAMILY, entityId: r.entityId, role: r.role })),
    ];
  }

  /**
   * Archive a user by stamping `rosteringEnded`. Used by the bulk-import unenroll bin alongside
   * {@link endAllEnrollments}; pass the same transaction so both land atomically.
   *
   * @param userId - The user to archive.
   * @param transaction - Optional transaction to run within.
   */
  async archiveUser(userId: string, transaction?: CoreTransaction): Promise<void> {
    const db = transaction ?? this.db;
    await db.update(users).set({ rosteringEnded: new Date() }).where(eq(users.id, userId));
  }

  /**
   * Reconcile a user's memberships to match `desired`, with replace-semantics per entity type (the
   * legacy `batchImportUpdate` behavior): for every entity type the desired list mentions, memberships
   * present now but not desired are ended, desired memberships not present now are added, and
   * memberships in both are left untouched. Entity types `desired` doesn't mention are left alone.
   *
   * Adds use an upsert, so a previously-ended membership (e.g. a student returning to a prior school)
   * is reactivated rather than colliding with its existing junction row. `current` is supplied by the
   * caller so the diff and the writes share the caller's transaction context.
   *
   * Reconciliation is by presence only: a membership present in both `current` and `desired` is left
   * untouched even if its role differs, so a re-import does not change the role of an existing
   * membership (matching the legacy behavior and avoiding needless FGA churn). Within a single entity
   * type, a duplicate `entityId` in `desired` collapses to its last role.
   *
   * @param userId - The user to reconcile.
   * @param desired - The membership set the row asks for (with roles).
   * @param current - The user's current active memberships (with roles).
   * @param transaction - The active transaction.
   * @returns The memberships added and removed (with roles), so the caller can sync FGA tuples.
   */
  async reconcileMemberships(
    userId: string,
    desired: { entityType: EntityType; entityId: string; role: string }[],
    current: { entityType: EntityType; entityId: string; role: string }[],
    transaction: CoreTransaction,
  ): Promise<{
    added: { entityType: EntityType; entityId: string; role: string }[];
    removed: { entityType: EntityType; entityId: string; role: string }[];
  }> {
    const groupByType = (list: { entityType: EntityType; entityId: string; role: string }[]) => {
      const byType = new Map<EntityType, Map<string, string>>();
      for (const m of list) {
        const ids = byType.get(m.entityType) ?? new Map<string, string>();
        ids.set(m.entityId, m.role);
        byType.set(m.entityType, ids);
      }
      return byType;
    };

    const desiredByType = groupByType(desired);
    const currentByType = groupByType(current);

    const added: { entityType: EntityType; entityId: string; role: string }[] = [];
    const removed: { entityType: EntityType; entityId: string; role: string }[] = [];
    const now = new Date();

    for (const [entityType, desiredIds] of desiredByType) {
      const currentIds = currentByType.get(entityType) ?? new Map<string, string>();

      // End memberships present now but no longer desired.
      for (const [entityId, role] of currentIds) {
        if (!desiredIds.has(entityId)) {
          await this.endMembershipRow(entityType, userId, entityId, now, transaction);
          removed.push({ entityType, entityId, role });
        }
      }

      // Add (or reactivate) desired memberships not present now.
      for (const [entityId, role] of desiredIds) {
        if (!currentIds.has(entityId)) {
          await this.upsertMembershipRow(entityType, userId, entityId, role, now, transaction);
          added.push({ entityType, entityId, role });
        }
      }
    }

    return { added, removed };
  }

  /** End a single membership row (stamp the end date) for the given entity type. */
  private async endMembershipRow(
    entityType: EntityType,
    userId: string,
    entityId: string,
    endedAt: Date,
    tx: CoreTransaction,
  ): Promise<void> {
    switch (entityType) {
      case EntityType.DISTRICT:
      case EntityType.SCHOOL:
        await tx
          .update(userOrgs)
          .set({ enrollmentEnd: endedAt })
          .where(and(eq(userOrgs.userId, userId), eq(userOrgs.orgId, entityId)));
        return;
      case EntityType.CLASS:
        await tx
          .update(userClasses)
          .set({ enrollmentEnd: endedAt })
          .where(and(eq(userClasses.userId, userId), eq(userClasses.classId, entityId)));
        return;
      case EntityType.GROUP:
        await tx
          .update(userGroups)
          .set({ enrollmentEnd: endedAt })
          .where(and(eq(userGroups.userId, userId), eq(userGroups.groupId, entityId)));
        return;
      case EntityType.FAMILY:
        await tx
          .update(userFamilies)
          .set({ leftOn: endedAt })
          .where(and(eq(userFamilies.userId, userId), eq(userFamilies.familyId, entityId)));
        return;
    }
  }

  /** Insert a membership row, reactivating it (clear end date, refresh role + start) on conflict. */
  private async upsertMembershipRow(
    entityType: EntityType,
    userId: string,
    entityId: string,
    role: string,
    startedAt: Date,
    tx: CoreTransaction,
  ): Promise<void> {
    switch (entityType) {
      case EntityType.DISTRICT:
      case EntityType.SCHOOL:
        await tx
          .insert(userOrgs)
          .values({ userId, orgId: entityId, role: role as UserRole, enrollmentStart: startedAt, enrollmentEnd: null })
          .onConflictDoUpdate({
            target: [userOrgs.userId, userOrgs.orgId],
            set: { role: role as UserRole, enrollmentStart: startedAt, enrollmentEnd: null },
          });
        return;
      case EntityType.CLASS:
        await tx
          .insert(userClasses)
          .values({
            userId,
            classId: entityId,
            role: role as UserRole,
            enrollmentStart: startedAt,
            enrollmentEnd: null,
          })
          .onConflictDoUpdate({
            target: [userClasses.userId, userClasses.classId],
            set: { role: role as UserRole, enrollmentStart: startedAt, enrollmentEnd: null },
          });
        return;
      case EntityType.GROUP:
        await tx
          .insert(userGroups)
          .values({
            userId,
            groupId: entityId,
            role: role as UserRole,
            enrollmentStart: startedAt,
            enrollmentEnd: null,
          })
          .onConflictDoUpdate({
            target: [userGroups.userId, userGroups.groupId],
            set: { role: role as UserRole, enrollmentStart: startedAt, enrollmentEnd: null },
          });
        return;
      case EntityType.FAMILY:
        await tx
          .insert(userFamilies)
          .values({ userId, familyId: entityId, role: role as UserFamilyRole, joinedOn: startedAt, leftOn: null })
          .onConflictDoUpdate({
            target: [userFamilies.userId, userFamilies.familyId],
            set: { role: role as UserFamilyRole, joinedOn: startedAt, leftOn: null },
          });
        return;
    }
  }
}
