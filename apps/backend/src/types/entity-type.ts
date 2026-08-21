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

/**
 * Entity types that sit inside the org hierarchy.
 *
 * A family sits outside the hierarchy that org permissions
 * (`can_create_users`, `can_list_users`) traverse. Family membership is
 * created and read through the families endpoints.
 */
export const OrgEntityType = {
  DISTRICT: EntityType.DISTRICT,
  SCHOOL: EntityType.SCHOOL,
  CLASS: EntityType.CLASS,
  GROUP: EntityType.GROUP,
} as const;

export type OrgEntityType = Exclude<EntityType, typeof EntityType.FAMILY>;
