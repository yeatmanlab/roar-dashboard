/**
 * Role-Permission Mappings
 *
 * Defines what permissions each role grants.
 * Uses userRoleEnum values (site_administrator, administrator, teacher, student)
 * from the join tables (user_orgs, user_classes, user_groups).
 *
 * Note: super_admin bypasses all permission checks (checked via userType).
 * Note: Caregiver access is handled separately via family relationships.
 */

import { Permissions, type Permission } from './permissions';
import { USER_ROLE, type UserRole } from '../enums/user-role.enum';

/**
 * Permissions granted to each role.
 *
 * Source of truth for role → permissions mapping.
 * Aligned with roar-firekit roles.ts for consistency.
 *
 * Supports wildcard permissions:
 * - 'administrations.*' grants all administrations.* permissions
 * - Specific permissions for fine-grained control
 */
export const RolePermissions: Partial<Record<UserRole, readonly Permission[]>> = {
  [USER_ROLE.SITE_ADMINISTRATOR]: [
    Permissions.Administrations.ALL,
    Permissions.Organizations.ALL,
    Permissions.Users.ALL,
    Permissions.Administrators.ALL,
    Permissions.Reports.Score.ALL,
    Permissions.Reports.Progress.ALL,
    Permissions.Reports.Student.ALL,
    Permissions.Tasks.ALL,
    Permissions.Runs.ALL,
    Permissions.Profile.ALL,
    Permissions.TestData.CREATE,
  ],
  [USER_ROLE.ADMINISTRATOR]: [
    Permissions.Administrations.ALL,
    Permissions.Organizations.ALL,
    Permissions.Users.ALL,
    Permissions.Administrators.READ,
    Permissions.Reports.Score.ALL,
    Permissions.Reports.Progress.ALL,
    Permissions.Reports.Student.ALL,
    Permissions.Tasks.ALL,
    Permissions.Profile.ALL,
  ],
  [USER_ROLE.TEACHER]: [
    Permissions.Administrations.LIST,
    Permissions.Organizations.LIST,
    Permissions.Users.LIST,
    Permissions.Administrators.READ,
    Permissions.Reports.Score.READ,
    Permissions.Reports.Progress.READ,
    Permissions.Reports.Student.READ,
    Permissions.Tasks.LAUNCH,
    Permissions.Profile.READ,
  ],
  [USER_ROLE.STUDENT]: [Permissions.Administrations.LIST, Permissions.Tasks.LAUNCH, Permissions.Profile.READ],
};

/**
 * Get all roles that have the given permission.
 * Handles wildcard matching (e.g., 'administrations.*' covers 'administrations.list').
 */
export function rolesForPermission(permission: Permission): UserRole[] {
  const roles: UserRole[] = [];

  for (const [role, permissions] of Object.entries(RolePermissions) as [UserRole, readonly Permission[]][]) {
    for (const p of permissions) {
      // Exact match
      if (p === permission) {
        roles.push(role);
        break;
      }

      // Handle wildcard permissions (e.g., 'administrations.*')
      if (p.endsWith('.*')) {
        const prefix = p.slice(0, -2);
        if (permission.startsWith(prefix + '.')) {
          roles.push(role);
          break;
        }
      }
    }
  }

  return roles;
}
