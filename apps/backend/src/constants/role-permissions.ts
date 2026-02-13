/**
 * Role-Permission Mappings
 *
 * Defines what permissions each role grants.
 * Uses userRoleEnum values from the join tables (user_orgs, user_classes, user_groups).
 * Every role in userRoleEnum MUST have an entry here.
 *
 * Note: super_admin bypasses all permission checks (checked via userType).
 * Note: Caregiver access is handled separately via family relationships.
 */

import { Permissions, type Permission } from './permissions';
import { UserRole, type UserRole as UserRoleType } from '../enums/user-role.enum';

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
const CAREGIVER_PERMISSIONS: readonly Permission[] = [
  Permissions.Administrations.LIST,
  Permissions.Administrations.READ,
  Permissions.Organizations.LIST,
  Permissions.Users.LIST,
  Permissions.Administrators.READ,
  Permissions.Reports.Score.READ,
  Permissions.Reports.Progress.READ,
  Permissions.Reports.Student.READ,
  Permissions.Tasks.LAUNCH,
  Permissions.Profile.READ,
];

export const RolePermissions: Record<UserRoleType, readonly Permission[]> = {
  // ── Supervisory roles ─────────────────────────────────────────────────

  [UserRole.SYSTEM_ADMINISTRATOR]: [
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
  [UserRole.SITE_ADMINISTRATOR]: [
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
  [UserRole.DISTRICT_ADMINISTRATOR]: [
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
  [UserRole.ADMINISTRATOR]: [
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
  [UserRole.PRINCIPAL]: [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Organizations.LIST,
    Permissions.Users.LIST,
    Permissions.Administrators.READ,
    Permissions.Reports.Score.READ,
    Permissions.Reports.Progress.READ,
    Permissions.Reports.Student.READ,
    Permissions.Tasks.LAUNCH,
    Permissions.Profile.READ,
  ],
  [UserRole.COUNSELOR]: [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Organizations.LIST,
    Permissions.Users.LIST,
    Permissions.Administrators.READ,
    Permissions.Reports.Score.READ,
    Permissions.Reports.Progress.READ,
    Permissions.Reports.Student.READ,
    Permissions.Tasks.LAUNCH,
    Permissions.Profile.READ,
  ],
  [UserRole.TEACHER]: [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Organizations.LIST,
    Permissions.Users.LIST,
    Permissions.Administrators.READ,
    Permissions.Reports.Score.READ,
    Permissions.Reports.Progress.READ,
    Permissions.Reports.Student.READ,
    Permissions.Tasks.LAUNCH,
    Permissions.Profile.READ,
  ],
  [UserRole.AIDE]: [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Organizations.LIST,
    Permissions.Users.LIST,
    Permissions.Administrators.READ,
    Permissions.Reports.Score.READ,
    Permissions.Reports.Progress.READ,
    Permissions.Reports.Student.READ,
    Permissions.Tasks.LAUNCH,
    Permissions.Profile.READ,
  ],
  [UserRole.PROCTOR]: [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Organizations.LIST,
    Permissions.Users.LIST,
    Permissions.Administrators.READ,
    Permissions.Reports.Score.READ,
    Permissions.Reports.Progress.READ,
    Permissions.Reports.Student.READ,
    Permissions.Tasks.LAUNCH,
    Permissions.Profile.READ,
  ],

  // ── Supervised roles ──────────────────────────────────────────────────

  [UserRole.STUDENT]: [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Tasks.LAUNCH,
    Permissions.Profile.READ,
  ],
  [UserRole.GUARDIAN]: CAREGIVER_PERMISSIONS,
  [UserRole.PARENT]: CAREGIVER_PERMISSIONS,
  [UserRole.RELATIVE]: CAREGIVER_PERMISSIONS,
};

/**
 * Get all roles that have the given permission.
 * Handles wildcard matching (e.g., 'administrations.*' covers 'administrations.list').
 *
 * @param permission - The permission to look up
 * @returns Non-empty array of roles that have the permission
 * @throws {Error} If no roles are configured for the permission (indicates misconfiguration)
 */
export function rolesForPermission(permission: Permission): UserRoleType[] {
  const roles: UserRoleType[] = [];

  for (const [role, permissions] of Object.entries(RolePermissions) as [UserRoleType, readonly Permission[]][]) {
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

  if (roles.length === 0) {
    throw new Error(`No roles configured for permission '${permission}' - check RolePermissions configuration`);
  }

  return roles;
}
