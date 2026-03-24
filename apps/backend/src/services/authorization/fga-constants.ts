/**
 * FGA object type prefixes used in tuple `user` and `object` fields.
 *
 * These match the `type` declarations in `packages/authz/authorization-model.fga`.
 * Using constants prevents typos and enables compile-time checking.
 */
export const FgaType = {
  USER: 'user',
  DISTRICT: 'district',
  SCHOOL: 'school',
  CLASS: 'class',
  FAMILY: 'family',
  GROUP: 'group',
  ADMINISTRATION: 'administration',
} as const;

export type FgaType = (typeof FgaType)[keyof typeof FgaType];

/**
 * FGA hierarchy relations — structural links between entity types.
 *
 * These are the relations that define the org tree and are written
 * as `TupleKeyWithoutCondition` (no time-bound condition needed).
 */
export const FgaHierarchyRelation = {
  PARENT_ORG: 'parent_org',
  CHILD_SCHOOL: 'child_school',
  CHILD_CLASS: 'child_class',
} as const;

export type FgaHierarchyRelation = (typeof FgaHierarchyRelation)[keyof typeof FgaHierarchyRelation];

/**
 * FGA administration assignment relations — links between administrations and their targets.
 *
 * These define which orgs/classes/groups an administration is assigned to.
 */
export const FgaAssignmentRelation = {
  ASSIGNED_DISTRICT: 'assigned_district',
  ASSIGNED_SCHOOL: 'assigned_school',
  ASSIGNED_CLASS: 'assigned_class',
  ASSIGNED_GROUP: 'assigned_group',
} as const;

export type FgaAssignmentRelation = (typeof FgaAssignmentRelation)[keyof typeof FgaAssignmentRelation];

/**
 * FGA condition name for time-bound membership tuples.
 */
export const FGA_CONDITION_ACTIVE_MEMBERSHIP = 'active_membership' as const;

/**
 * Sentinel value for memberships with no end date.
 * FGA conditions require a concrete timestamp, so we use far-future instead of null.
 */
export const FAR_FUTURE = '9999-12-31T23:59:59Z';
