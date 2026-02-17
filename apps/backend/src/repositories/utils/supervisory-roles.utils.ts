import { SUPERVISORY_ROLES } from '../../constants/role-classifications';

/**
 * Filters roles to only include supervisory roles.
 *
 * Supervisory roles (e.g., administrator, teacher) can see resources assigned to
 * descendant entities in the org hierarchy. Non-supervisory roles (e.g., student)
 * can only see resources on their own entity or ancestors.
 *
 * @example
 * ```ts
 * const allowedRoles = ['student', 'teacher', 'administrator'];
 * const supervisoryRoles = filterSupervisoryRoles(allowedRoles);
 * // ['teacher', 'administrator']
 *
 * if (supervisoryRoles.length > 0) {
 *   // Include descendant access paths in query
 * }
 * ```
 *
 * @param roles - Array of roles to filter
 * @returns Array containing only the supervisory roles from the input
 */
export function filterSupervisoryRoles<T extends string>(roles: T[]): T[] {
  return roles.filter((role) => (SUPERVISORY_ROLES as readonly string[]).includes(role));
}
