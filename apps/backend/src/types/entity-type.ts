/**
 * Entity type constants used across the system for permissions and memberships.
 *
 * These match the FGA type names in `packages/authz/authorization-model.fga`.
 * Using constants prevents typos and enables compile-time checking.
 */
export const EntityType = {
  DISTRICT: 'district',
  SCHOOL: 'school',
  CLASS: 'class',
  GROUP: 'group',
  FAMILY: 'family',
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];
