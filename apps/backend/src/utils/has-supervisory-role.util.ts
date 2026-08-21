import { SUPERVISORY_ROLES } from '../constants/role-classifications';
import type { UserRole } from '../enums/user-role.enum';

/**
 * Checks if any of the given roles is a supervisory role.
 *
 * Uses an explicit allowlist of supervisory roles to prevent unknown/invalid
 * role strings from being incorrectly treated as supervisory.
 *
 * Supervisory roles: site_administrator, administrator, teacher, principal,
 *   district_administrator, counselor, aide, proctor, system_administrator
 * Supervised roles: student, guardian, parent, relative
 *
 * @param roles - Array of role strings to check
 * @returns true if at least one role is in the SUPERVISORY_ROLES allowlist, false otherwise
 *
 * @example
 * hasSupervisoryRole(['student', 'teacher']); // true (teacher is supervisory)
 * hasSupervisoryRole(['student', 'guardian']); // false (both are supervised)
 * hasSupervisoryRole(['unknown_role']); // false (unknown roles are not supervisory)
 * hasSupervisoryRole([]); // false (no roles)
 */
export function hasSupervisoryRole(roles: string[]): boolean {
  return roles.some((role) => SUPERVISORY_ROLES.includes(role as UserRole));
}
