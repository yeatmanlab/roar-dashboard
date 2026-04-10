import { UserRole } from '../../enums/user-role.enum';

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
 * FGA permission relations — used in `hasPermission` and `listAccessibleObjects` calls.
 *
 * These match the `define can_*` permissions in `packages/authz/authorization-model.fga`.
 * Using constants prevents typos in service-layer authorization checks.
 */
export const FgaRelation = {
  CAN_LIST: 'can_list',
  CAN_READ: 'can_read',
  CAN_DELETE: 'can_delete',
  CAN_LIST_USERS: 'can_list_users',
  CAN_READ_SCORES: 'can_read_scores',
  CAN_READ_PROGRESS: 'can_read_progress',
  CAN_CREATE_RUN: 'can_create_run',
  CAN_READ_CHILD: 'can_read_child',
} as const;

export type FgaRelation = (typeof FgaRelation)[keyof typeof FgaRelation];

/**
 * Roles that are valid as direct relations on the FGA `class` type.
 *
 * The `class` type in the authorization model does not include admin-tier roles
 * (`administrator`, `district_administrator`, `site_administrator`, `system_administrator`).
 * Admin access to classes flows through the org hierarchy (school → district).
 *
 * DB rows with admin-tier roles on `user_classes` are valid in Postgres but must be
 * skipped when writing FGA tuples — otherwise the FGA API returns a validation error.
 */
export const FGA_CLASS_VALID_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.PRINCIPAL,
  UserRole.COUNSELOR,
  UserRole.TEACHER,
  UserRole.AIDE,
  UserRole.PROCTOR,
  UserRole.STUDENT,
  UserRole.GUARDIAN,
  UserRole.PARENT,
  UserRole.RELATIVE,
]);

/**
 * FGA condition name for time-bound membership tuples.
 */
export const FGA_CONDITION_ACTIVE_MEMBERSHIP = 'active_membership' as const;

/**
 * Sentinel value for memberships with no start date.
 * FGA conditions require a concrete timestamp, so we treat missing starts as epoch.
 */
export const FAR_PAST = '1970-01-01T00:00:00Z';

/**
 * Sentinel value for memberships with no end date.
 * FGA conditions require a concrete timestamp, so we use far-future instead of null.
 */
export const FAR_FUTURE = '9999-12-31T23:59:59Z';
