/**
 * Role Classifications
 *
 * Defines role classifications for authorization behavior.
 * These classifications determine how roles can navigate the org hierarchy
 * when querying for accessible resources.
 */

import type { UserRole } from '../enums/user-role.enum';

/**
 * Roles with supervisory responsibility.
 *
 * These roles can see administrations assigned to child entities:
 * - User in district → sees admins on child schools and classes
 * - User in school → sees admins on child classes
 * - User in group → sees admins on child groups
 *
 * This is in addition to the default behavior that all roles have
 * (seeing administrations on their own entity and parent entities that cascade down).
 */
export const SUPERVISORY_ROLES: UserRole[] = [
  'administrator',
  'aide',
  'counselor',
  'district_administrator',
  'principal',
  'proctor',
  'site_administrator',
  'system_administrator',
  'teacher',
];

/**
 * Roles that are supervised (students and their families).
 *
 * These roles can only see administrations that apply to them directly:
 * - Administrations on their own entity
 * - Administrations on parent entities (district → school → class)
 *
 * They cannot see administrations assigned to sibling or child entities.
 */
export const SUPERVISED_ROLES: UserRole[] = ['student', 'guardian', 'parent', 'relative'];
