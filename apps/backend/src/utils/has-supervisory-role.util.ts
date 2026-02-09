import { SUPERVISED_ROLES } from '../constants/role-classifications';

/**
 * Checks if any of the given roles is a supervisory role (not a supervised role).
 *
 * Supervisory roles: site_administrator, administrator, teacher
 * Supervised roles: student, guardian, parent, relative
 *
 * @param roles - Array of role strings to check
 * @returns true if at least one role is supervisory, false otherwise
 *
 * @example
 * hasSupervisoryRole(['student', 'teacher']); // true (teacher is supervisory)
 * hasSupervisoryRole(['student', 'guardian']); // false (both are supervised)
 * hasSupervisoryRole([]); // false (no roles)
 */
export function hasSupervisoryRole(roles: string[]): boolean {
  return roles.some((role) => !SUPERVISED_ROLES.includes(role as (typeof SUPERVISED_ROLES)[number]));
}
