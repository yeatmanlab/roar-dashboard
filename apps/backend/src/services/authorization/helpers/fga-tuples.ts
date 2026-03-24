import type { RelationshipCondition, TupleKey, TupleKeyWithoutCondition } from '@openfga/sdk';
import type { UserRole } from '../../../enums/user-role.enum';
import type { UserFamilyRole } from '../../../enums/user-family-role.enum';
import {
  FgaType,
  FgaHierarchyRelation,
  FgaAssignmentRelation,
  FGA_CONDITION_ACTIVE_MEMBERSHIP,
  FAR_PAST,
  FAR_FUTURE,
} from '../fga-constants';

export { FAR_PAST, FAR_FUTURE };

/**
 * Check whether a value is a valid Date that can be serialized.
 *
 * @param value - The value to check
 * @returns true if value is a Date with a valid time value
 */
function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Build the `active_membership` condition for time-bound role tuples.
 *
 * Some Firestore-migrated rows have null or invalid enrollment dates.
 * Falls back to FAR_PAST / FAR_FUTURE so the tuple is still written.
 *
 * @param grantStart - When the membership begins, or null/invalid
 * @param grantEnd - When the membership ends, or null for indefinite
 * @returns RelationshipCondition with `grant_start` and `grant_end` context
 */
function membershipCondition(grantStart: Date | null, grantEnd: Date | null): RelationshipCondition {
  return {
    name: FGA_CONDITION_ACTIVE_MEMBERSHIP,
    context: {
      grant_start: isValidDate(grantStart) ? grantStart.toISOString() : FAR_PAST,
      grant_end: isValidDate(grantEnd) ? grantEnd.toISOString() : FAR_FUTURE,
    },
  };
}

// ── Org membership tuples ──────────────────────────────────────────────────────

/**
 * Construct a district membership tuple.
 *
 * @param userId - The user ID
 * @param districtId - The district ID
 * @param role - The user's role at this district
 * @param enrollmentStart - When the enrollment begins, or null for unknown
 * @param enrollmentEnd - When the enrollment ends, or null for indefinite
 * @returns TupleKey for `user:{userId}` → `{role}` → `district:{districtId}`
 */
export function districtMembershipTuple(
  userId: string,
  districtId: string,
  role: UserRole,
  enrollmentStart: Date | null,
  enrollmentEnd: Date | null,
): TupleKey {
  return {
    user: `${FgaType.USER}:${userId}`,
    relation: role,
    object: `${FgaType.DISTRICT}:${districtId}`,
    condition: membershipCondition(enrollmentStart, enrollmentEnd),
  };
}

/**
 * Construct a school membership tuple.
 *
 * @param userId - The user ID
 * @param schoolId - The school ID
 * @param role - The user's role at this school
 * @param enrollmentStart - When the enrollment begins, or null for unknown
 * @param enrollmentEnd - When the enrollment ends, or null for indefinite
 * @returns TupleKey for `user:{userId}` → `{role}` → `school:{schoolId}`
 */
export function schoolMembershipTuple(
  userId: string,
  schoolId: string,
  role: UserRole,
  enrollmentStart: Date | null,
  enrollmentEnd: Date | null,
): TupleKey {
  return {
    user: `${FgaType.USER}:${userId}`,
    relation: role,
    object: `${FgaType.SCHOOL}:${schoolId}`,
    condition: membershipCondition(enrollmentStart, enrollmentEnd),
  };
}

/**
 * Construct a class membership tuple.
 *
 * @param userId - The user ID
 * @param classId - The class ID
 * @param role - The user's role in this class
 * @param enrollmentStart - When the enrollment begins, or null for unknown
 * @param enrollmentEnd - When the enrollment ends, or null for indefinite
 * @returns TupleKey for `user:{userId}` → `{role}` → `class:{classId}`
 */
export function classMembershipTuple(
  userId: string,
  classId: string,
  role: UserRole,
  enrollmentStart: Date | null,
  enrollmentEnd: Date | null,
): TupleKey {
  return {
    user: `${FgaType.USER}:${userId}`,
    relation: role,
    object: `${FgaType.CLASS}:${classId}`,
    condition: membershipCondition(enrollmentStart, enrollmentEnd),
  };
}

/**
 * Construct a group membership tuple.
 *
 * Groups use the same 13 OneRoster roles as orgs (from user_groups.role column)
 * with the `active_membership` condition for time-bound access.
 *
 * @param userId - The user ID
 * @param groupId - The group ID
 * @param role - The user's role in this group
 * @param enrollmentStart - When the membership begins
 * @param enrollmentEnd - When the membership ends, or null for indefinite
 * @returns TupleKey for `user:{userId}` → `{role}` → `group:{groupId}`
 */
export function groupMembershipTuple(
  userId: string,
  groupId: string,
  role: UserRole,
  enrollmentStart: Date | null,
  enrollmentEnd: Date | null,
): TupleKey {
  return {
    user: `${FgaType.USER}:${userId}`,
    relation: role,
    object: `${FgaType.GROUP}:${groupId}`,
    condition: membershipCondition(enrollmentStart, enrollmentEnd),
  };
}

// ── Family membership tuples ───────────────────────────────────────────────────

/**
 * Construct a family membership tuple.
 *
 * Family roles (`parent`, `child`) are used directly as the relation.
 * Family tuples use the `active_membership` condition with `joinedOn`/`leftOn`
 * from the `user_families` junction table.
 *
 * @param userId - The user ID
 * @param familyId - The family ID
 * @param role - The user's role in the family (`parent` or `child`)
 * @param joinedOn - When the family membership began, or null for unknown
 * @param leftOn - When the family membership ended, or null for indefinite
 * @returns TupleKey for `user:{userId}` → `{role}` → `family:{familyId}`
 */
export function familyMembershipTuple(
  userId: string,
  familyId: string,
  role: UserFamilyRole,
  joinedOn: Date | null,
  leftOn: Date | null,
): TupleKey {
  return {
    user: `${FgaType.USER}:${userId}`,
    relation: role,
    object: `${FgaType.FAMILY}:${familyId}`,
    condition: membershipCondition(joinedOn, leftOn),
  };
}

// ── Hierarchy tuples ───────────────────────────────────────────────────────────

/**
 * Construct school hierarchy tuples linking a school to its parent district.
 *
 * Returns two tuples:
 * 1. `district:{districtId}` is `parent_org` of `school:{schoolId}` (sets the school's parent)
 * 2. `school:{schoolId}` is `child_school` of `district:{districtId}` (sets the district's child)
 *
 * @param districtId - The parent district ID
 * @param schoolId - The child school ID
 * @returns Array of 2 TupleKeyWithoutCondition
 */
export function schoolHierarchyTuples(
  districtId: string,
  schoolId: string,
): [TupleKeyWithoutCondition, TupleKeyWithoutCondition] {
  return [
    {
      user: `${FgaType.DISTRICT}:${districtId}`,
      relation: FgaHierarchyRelation.PARENT_ORG,
      object: `${FgaType.SCHOOL}:${schoolId}`,
    },
    {
      user: `${FgaType.SCHOOL}:${schoolId}`,
      relation: FgaHierarchyRelation.CHILD_SCHOOL,
      object: `${FgaType.DISTRICT}:${districtId}`,
    },
  ];
}

/**
 * Construct class hierarchy tuples linking a class to its parent school.
 *
 * Returns two tuples:
 * 1. `school:{schoolId}` is `parent_org` of `class:{classId}` (sets the class's parent)
 * 2. `class:{classId}` is `child_class` of `school:{schoolId}` (sets the school's child)
 *
 * @param schoolId - The parent school ID
 * @param classId - The child class ID
 * @returns Array of 2 TupleKeyWithoutCondition
 */
export function classHierarchyTuples(
  schoolId: string,
  classId: string,
): [TupleKeyWithoutCondition, TupleKeyWithoutCondition] {
  return [
    {
      user: `${FgaType.SCHOOL}:${schoolId}`,
      relation: FgaHierarchyRelation.PARENT_ORG,
      object: `${FgaType.CLASS}:${classId}`,
    },
    {
      user: `${FgaType.CLASS}:${classId}`,
      relation: FgaHierarchyRelation.CHILD_CLASS,
      object: `${FgaType.SCHOOL}:${schoolId}`,
    },
  ];
}

// ── Administration assignment tuples ───────────────────────────────────────────

/**
 * Construct an administration-to-district assignment tuple.
 *
 * @param administrationId - The administration ID
 * @param districtId - The district ID
 * @returns TupleKeyWithoutCondition for `district:{districtId}` → `assigned_district` → `administration:{administrationId}`
 */
export function administrationDistrictTuple(administrationId: string, districtId: string): TupleKeyWithoutCondition {
  return {
    user: `${FgaType.DISTRICT}:${districtId}`,
    relation: FgaAssignmentRelation.ASSIGNED_DISTRICT,
    object: `${FgaType.ADMINISTRATION}:${administrationId}`,
  };
}

/**
 * Construct an administration-to-school assignment tuple.
 *
 * @param administrationId - The administration ID
 * @param schoolId - The school ID
 * @returns TupleKeyWithoutCondition for `school:{schoolId}` → `assigned_school` → `administration:{administrationId}`
 */
export function administrationSchoolTuple(administrationId: string, schoolId: string): TupleKeyWithoutCondition {
  return {
    user: `${FgaType.SCHOOL}:${schoolId}`,
    relation: FgaAssignmentRelation.ASSIGNED_SCHOOL,
    object: `${FgaType.ADMINISTRATION}:${administrationId}`,
  };
}

/**
 * Construct an administration-to-class assignment tuple.
 *
 * @param administrationId - The administration ID
 * @param classId - The class ID
 * @returns TupleKeyWithoutCondition for `class:{classId}` → `assigned_class` → `administration:{administrationId}`
 */
export function administrationClassTuple(administrationId: string, classId: string): TupleKeyWithoutCondition {
  return {
    user: `${FgaType.CLASS}:${classId}`,
    relation: FgaAssignmentRelation.ASSIGNED_CLASS,
    object: `${FgaType.ADMINISTRATION}:${administrationId}`,
  };
}

/**
 * Construct an administration-to-group assignment tuple.
 *
 * @param administrationId - The administration ID
 * @param groupId - The group ID
 * @returns TupleKeyWithoutCondition for `group:{groupId}` → `assigned_group` → `administration:{administrationId}`
 */
export function administrationGroupTuple(administrationId: string, groupId: string): TupleKeyWithoutCondition {
  return {
    user: `${FgaType.GROUP}:${groupId}`,
    relation: FgaAssignmentRelation.ASSIGNED_GROUP,
    object: `${FgaType.ADMINISTRATION}:${administrationId}`,
  };
}
