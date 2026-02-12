import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { userOrgs, userClasses, orgs, classes } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { logger } from '../../logger';
import { parseAccessControlFilter, type AccessControlFilter } from '../utils/parse-access-control-filter.utils';
import { isDescendantOrEqual } from '../utils/is-descendant-or-equal.utils';
import { isAncestorOrEqual } from '../utils/is-ancestor-or-equal.utils';
import { isAuthorizedMembership } from '../utils/is-authorized-membership.utils';
import { filterSupervisoryRoles } from '../utils/supervisory-roles.utils';

/**
 * Org Access Controls
 *
 * Builds SQL queries to determine what orgs a user can access based on their
 * org/class memberships. Used by other repositories to filter query results.
 *
 * ## How Access Works
 *
 * Users gain access to orgs through their memberships:
 *
 * ```
 * User belongs to:          Can see orgs:
 * ─────────────────         ──────────────────────────────────────
 * District                  → That district (and descendants if supervisory)
 * School                    → That school, parent district (and descendants if supervisory)
 * Class                     → That class's school, parent district
 * ```
 *
 * ## Access Patterns
 *
 * **Ancestor access (all roles)** — Users see orgs in their ancestry:
 * - Student in School A sees School A and its parent District
 * - Student in Class X sees Class X's School and parent District
 *
 * **Descendant access (supervisory roles only)** — Supervisors also see descendant orgs:
 * - Admin in District sees all child Schools
 * - Teacher in School sees that School (no child orgs, but could see sibling classes)
 */
export class OrgAccessControls {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  /**
   * Returns all org IDs a user can access based on their memberships.
   *
   * Follows the same pattern as buildUserAdministrationIdsQuery:
   * - Ancestor paths (all roles): User's orgs + ancestor orgs
   * - Descendant paths (supervisory only): Descendant orgs
   *
   * @example
   * ```ts
   * const accessibleOrgs = orgAccessControls.buildUserAccessibleOrgIdsQuery({
   *   userId: 'user-123',
   *   allowedRoles: ['teacher', 'administrator'],
   * });
   *
   * // Use in another query to filter by accessible orgs
   * const districts = await db
   *   .select()
   *   .from(orgs)
   *   .innerJoin(accessibleOrgs.as('accessible'), eq(orgs.id, accessible.orgId))
   *   .where(eq(orgs.orgType, 'district'));
   * ```
   *
   * @param accessControlFilter - Filter containing userId and allowedRoles
   * @returns Drizzle subquery with `{ orgId: string }` rows.
   *          Uses UNION to automatically deduplicate across access paths.
   * @throws {ZodError} If called with empty userId or allowedRoles
   */
  buildUserAccessibleOrgIdsQuery(accessControlFilter: AccessControlFilter) {
    const { userId, allowedRoles } = parseAccessControlFilter(accessControlFilter);

    // Aliases for the orgs table (needed because we join it twice in the same query)
    const userOrgTable = alias(orgs, 'user_org'); // Org where the user has membership
    const accessibleOrgTable = alias(orgs, 'accessible_org'); // Org to check access for

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // ANCESTOR ACCESS: Find orgs on user's entity or ancestors (all roles)
    // ─────────────────────────────────────────────────────────────────────────–––––––

    // Path 1: User's org membership → that org + ancestor orgs
    // Example: User in School A sees School A and parent District
    const viaUserOrgAncestors = this.db
      .select({ orgId: accessibleOrgTable.id })
      .from(userOrgs)
      // get the org details for user's membership
      .innerJoin(userOrgTable, eq(userOrgTable.id, userOrgs.orgId))
      // find orgs that are ancestors of (or equal to) user's org
      .innerJoin(accessibleOrgTable, isDescendantOrEqual(userOrgTable.path, accessibleOrgTable.path))
      // only consider user's authorized memberships
      .where(isAuthorizedMembership(userOrgs, userId, allowedRoles));

    // Path 2: User's class membership → class's school + ancestor orgs
    // Example: User in Class X sees School A and parent District
    const viaUserClassOrgAncestors = this.db
      .select({ orgId: accessibleOrgTable.id })
      .from(userClasses)
      // get the class details for user's membership
      .innerJoin(classes, eq(classes.id, userClasses.classId))
      // find orgs that are ancestors of (or equal to) class's org
      .innerJoin(accessibleOrgTable, isDescendantOrEqual(classes.orgPath, accessibleOrgTable.path))
      // only consider user's authorized memberships
      .where(isAuthorizedMembership(userClasses, userId, allowedRoles));

    // Combine ancestor paths with UNION to deduplicate results
    const ancestorUnion = viaUserOrgAncestors.union(viaUserClassOrgAncestors);

    // ─────────────────────────────────────────────────────────────────────────–––––––
    // DESCENDANT ACCESS: Find orgs on descendants (supervisory roles only)
    // ─────────────────────────────────────────────────────────────────────────–––––––

    const supervisoryAllowedRoles = filterSupervisoryRoles(allowedRoles);

    // Non-supervisory roles (e.g., student) only see orgs on their own entity or ancestors.
    // Skip descendant path queries since they wouldn't match any rows anyway.
    if (supervisoryAllowedRoles.length === 0) {
      logger.debug({ userId, allowedRoles }, 'No supervisory roles provided, skipping descendant paths');
      return ancestorUnion;
    }

    // Path 3: User's org membership → descendant orgs
    // Example: Admin in District sees all child Schools
    const viaUserOrgDescendants = this.db
      .select({ orgId: accessibleOrgTable.id })
      .from(userOrgs)
      // get the org details for user's membership
      .innerJoin(userOrgTable, eq(userOrgTable.id, userOrgs.orgId))
      // user's org is ancestor of (or equal to) accessible org
      .innerJoin(accessibleOrgTable, isAncestorOrEqual(userOrgTable.path, accessibleOrgTable.path))
      // only consider user's authorized memberships with supervisory roles
      .where(isAuthorizedMembership(userOrgs, userId, supervisoryAllowedRoles));

    return ancestorUnion.union(viaUserOrgDescendants);
  }
}
