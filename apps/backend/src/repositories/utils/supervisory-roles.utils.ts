import {
  SUPERVISORY_ROLES,
  CARETAKER_ROLES,
  HIERARCHICAL_USER_ACCESS_ROLES,
} from '../../constants/role-classifications';

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

/**
 * Filters roles to only include caretaker roles.
 *
 * Caretaker roles (e.g., parent, guardian) can see resources assigned to
 * their associated students or dependents. This allows caretakers to view
 * information about entities they are responsible for.
 *
 * @example
 * ```ts
 * const allowedRoles = ['student', 'parent', 'guardian'];
 * const caretakerRoles = filterCaretakerRoles(allowedRoles);
 * // ['parent', 'guardian']
 *
 * if (caretakerRoles.length > 0) {
 *   // Include caretaker access paths in query
 * }
 * ```
 *
 * @param roles - Array of roles to filter
 * @returns Array containing only the caretaker roles from the input
 */
export function filterCaretakerRoles<T extends string>(roles: T[]): T[] {
  return roles.filter((role) => (CARETAKER_ROLES as readonly string[]).includes(role));
}

/**
 * Filters roles to only include roles with hierarchical user access.
 *
 * Hierarchical user access roles (e.g., administrator, principal) can see users
 * in descendant entities in the org hierarchy. Teachers are excluded — they only
 * see students in classes they directly teach, not all users in descendant orgs.
 *
 * @example
 * ```ts
 * const allowedRoles = ['student', 'teacher', 'administrator'];
 * const hierarchicalRoles = filterHierarchicalUserAccessRoles(allowedRoles);
 * // ['administrator']
 *
 * if (hierarchicalRoles.length > 0) {
 *   // Include descendant org user access paths in query
 * }
 * ```
 *
 * @param roles - Array of roles to filter
 * @returns Array containing only the hierarchical user access roles from the input
 */
export function filterHierarchicalUserAccessRoles<T extends string>(roles: T[]): T[] {
  return roles.filter((role) => (HIERARCHICAL_USER_ACCESS_ROLES as readonly string[]).includes(role));
}
