import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { classes, orgs, users, userOrgs, userClasses, userGroups, userFamilies } from '../../db/schema';
import { CoreDbClient } from '../../db/clients';
import type * as CoreDbSchema from '../../db/schema/core';
import { logger } from '../../logger';
import { parseAccessControlFilter, type AccessControlFilter } from '../utils/parse-access-control-filter.utils';
import { isDescendantOrEqual } from '../utils/is-descendant-or-equal.utils';
import { isAncestorOrEqual } from '../utils/is-ancestor-or-equal.utils';
import { isEnrollmentActive } from '../utils/enrollment.utils';
import { isAuthorizedMembership } from '../utils/is-authorized-membership.utils';
import { filterSupervisoryRoles } from '../utils/supervisory-roles.utils';

export class UserAccessControls {
  constructor(protected readonly db: NodePgDatabase<typeof CoreDbSchema> = CoreDbClient) {}

  buildAccessibleUserIdsQuery(accessControlFilter: AccessControlFilter) {
    const { userId: requesting_user_id, allowedRoles } = parseAccessControlFilter(accessControlFilter);

    // Users table alias
    const usersTable = alias(users, 'users_table');

    const supervisoryAllowedRoles = filterSupervisoryRoles(allowedRoles);

    // Non-supervisory roles (e.g. student) can only see their own user record
    if (supervisoryAllowedRoles.length === 0) {
      return this.db.select({ userId: usersTable.id }).from(usersTable).where(eq(usersTable.id, requesting_user_id));
    }

    // User's org membership --> users in those orgs
    const userOrgMemberships = alias(userOrgs, 'user_org_memberships');
    const allUsersInOrgs = alias(userOrgs, 'all_users_in_orgs');

    const viaUserOrgToDescendantOrg = this.db
      .select({ userId: allUsersInOrgs.userId })
      .from(userOrgMemberships)
      .innerJoin(allUsersInOrgs, eq(userOrgMemberships.orgId, allUsersInOrgs.orgId))
      .innerJoin(orgs, eq(orgs.parentOrgId, userOrgMemberships.orgId))
      .where(
        and(
          eq(userOrgMemberships.userId, requesting_user_id),
          inArray(userOrgMemberships.role, supervisoryAllowedRoles),
          isAuthorizedMembership(allUsersInOrgs, requesting_user_id, supervisoryAllowedRoles),
        ),
      );

    // User's class membership --> users in those classes
    const userClassMemberships = alias(userClasses, 'user_class_memberships');
    const allUsersInclasses = alias(userClasses, 'all_users_in_classes');

    const viaUserOrgToDescendantClass = this.db
      .select({ userId: allUsersInclasses.userId })
      .from(userClassMemberships)
      .innerJoin(allUsersInclasses, eq(userClassMemberships.classId, allUsersInclasses.classId))
      .where(
        and(
          eq(userClassMemberships.userId, requesting_user_id),
          inArray(userClassMemberships.role, supervisoryAllowedRoles), // or allowedRoles
        ),
      );
    return viaUserOrgToDescendantOrg.union(viaUserOrgToDescendantClass);
  }
}
