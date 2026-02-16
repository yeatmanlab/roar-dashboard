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
export const RolePermissions: Record<UserRoleType, readonly Permission[]> = (() => {
  // ── Permission tiers ────────────────────────────────────────────────
  const siteAdmin: readonly Permission[] = [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Administrators.READ,
    Permissions.Organizations.LIST,
    Permissions.Organizations.READ,
    Permissions.Profile.READ,
    Permissions.Reports.Progress.ALL,
    Permissions.Reports.Score.ALL,
    Permissions.Reports.Student.ALL,
    Permissions.Users.LIST,
  ];

  const admin: readonly Permission[] = [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Administrators.READ,
    Permissions.Organizations.LIST,
    Permissions.Organizations.READ,
    Permissions.Profile.READ,
    Permissions.Reports.Progress.ALL,
    Permissions.Reports.Score.ALL,
    Permissions.Reports.Student.ALL,
    Permissions.Users.LIST,
  ];

  const educator: readonly Permission[] = [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Administrators.READ,
    Permissions.Organizations.LIST,
    Permissions.Organizations.READ,
    Permissions.Profile.READ,
    Permissions.Reports.Progress.ALL,
    Permissions.Reports.Score.ALL,
    Permissions.Reports.Student.ALL,
    Permissions.Users.LIST,
  ];

  const caregiver: readonly Permission[] = [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Administrators.READ,
    Permissions.Organizations.LIST,
    Permissions.Organizations.READ,
    Permissions.Profile.READ,
    Permissions.Reports.Progress.READ,
    Permissions.Reports.Score.READ,
    Permissions.Reports.Student.READ,
    Permissions.Tasks.LAUNCH,
    Permissions.Users.LIST,
  ];

  const student: readonly Permission[] = [
    Permissions.Administrations.LIST,
    Permissions.Administrations.READ,
    Permissions.Profile.READ,
    Permissions.Tasks.LAUNCH,
  ];

  // ── Role → tier mapping ─────────────────────────────────────────────
  return {
    [UserRole.SYSTEM_ADMINISTRATOR]: siteAdmin,
    [UserRole.SITE_ADMINISTRATOR]: siteAdmin,
    [UserRole.DISTRICT_ADMINISTRATOR]: admin,
    [UserRole.ADMINISTRATOR]: admin,
    [UserRole.PRINCIPAL]: educator,
    [UserRole.COUNSELOR]: educator,
    [UserRole.TEACHER]: educator,
    [UserRole.AIDE]: educator,
    [UserRole.PROCTOR]: educator,
    [UserRole.STUDENT]: student,
    [UserRole.GUARDIAN]: caregiver,
    [UserRole.PARENT]: caregiver,
    [UserRole.RELATIVE]: caregiver,
  };
})();

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
