import { describe, it, expect } from 'vitest';
import {
  FAR_PAST,
  FAR_FUTURE,
  districtMembershipTuple,
  schoolMembershipTuple,
  classMembershipTuple,
  groupMembershipTuple,
  familyMembershipTuple,
  schoolHierarchyTuples,
  classHierarchyTuples,
  administrationDistrictTuple,
  administrationSchoolTuple,
  administrationClassTuple,
  administrationGroupTuple,
} from './fga-tuples';
import { UserRole } from '../../../enums/user-role.enum';
import { UserFamilyRole } from '../../../enums/user-family-role.enum';

const USER_ID = 'user-abc-123';
const DISTRICT_ID = 'district-001';
const SCHOOL_ID = 'school-001';
const CLASS_ID = 'class-001';
const GROUP_ID = 'group-001';
const FAMILY_ID = 'family-001';
const ADMIN_ID = 'admin-001';

const ENROLLMENT_START = new Date('2024-08-01T00:00:00Z');
const ENROLLMENT_END = new Date('2025-06-15T23:59:59Z');

describe('fga-tuples', () => {
  describe('districtMembershipTuple', () => {
    it('returns correct tuple with enrollment end date', () => {
      const tuple = districtMembershipTuple(USER_ID, DISTRICT_ID, UserRole.TEACHER, ENROLLMENT_START, ENROLLMENT_END);

      expect(tuple).toEqual({
        user: `user:${USER_ID}`,
        relation: 'teacher',
        object: `district:${DISTRICT_ID}`,
        condition: {
          name: 'active_membership',
          context: {
            grant_start: ENROLLMENT_START.toISOString(),
            grant_end: ENROLLMENT_END.toISOString(),
          },
        },
      });
    });

    it('uses FAR_FUTURE when enrollment end is null', () => {
      const tuple = districtMembershipTuple(USER_ID, DISTRICT_ID, UserRole.ADMINISTRATOR, ENROLLMENT_START, null);

      expect(tuple.condition!.context).toEqual({
        grant_start: ENROLLMENT_START.toISOString(),
        grant_end: FAR_FUTURE,
      });
    });

    it('maps the role directly as the relation', () => {
      const tuple = districtMembershipTuple(USER_ID, DISTRICT_ID, UserRole.STUDENT, ENROLLMENT_START, null);
      expect(tuple.relation).toBe('student');
    });
  });

  describe('schoolMembershipTuple', () => {
    it('returns correct tuple shape', () => {
      const tuple = schoolMembershipTuple(USER_ID, SCHOOL_ID, UserRole.TEACHER, ENROLLMENT_START, ENROLLMENT_END);

      expect(tuple.user).toBe(`user:${USER_ID}`);
      expect(tuple.relation).toBe('teacher');
      expect(tuple.object).toBe(`school:${SCHOOL_ID}`);
      expect(tuple.condition).toEqual({
        name: 'active_membership',
        context: {
          grant_start: ENROLLMENT_START.toISOString(),
          grant_end: ENROLLMENT_END.toISOString(),
        },
      });
    });

    it('uses FAR_FUTURE for null end date', () => {
      const tuple = schoolMembershipTuple(USER_ID, SCHOOL_ID, UserRole.STUDENT, ENROLLMENT_START, null);
      expect(tuple.condition!.context).toEqual({
        grant_start: ENROLLMENT_START.toISOString(),
        grant_end: FAR_FUTURE,
      });
    });
  });

  describe('classMembershipTuple', () => {
    it('returns correct tuple shape', () => {
      const tuple = classMembershipTuple(USER_ID, CLASS_ID, UserRole.STUDENT, ENROLLMENT_START, ENROLLMENT_END);

      expect(tuple.user).toBe(`user:${USER_ID}`);
      expect(tuple.relation).toBe('student');
      expect(tuple.object).toBe(`class:${CLASS_ID}`);
      expect(tuple.condition).toEqual({
        name: 'active_membership',
        context: {
          grant_start: ENROLLMENT_START.toISOString(),
          grant_end: ENROLLMENT_END.toISOString(),
        },
      });
    });
  });

  describe('groupMembershipTuple', () => {
    it('maps the role directly as the relation', () => {
      const tuple = groupMembershipTuple(USER_ID, GROUP_ID, UserRole.STUDENT, ENROLLMENT_START, ENROLLMENT_END);

      expect(tuple.user).toBe(`user:${USER_ID}`);
      expect(tuple.relation).toBe('student');
      expect(tuple.object).toBe(`group:${GROUP_ID}`);
    });

    it('accepts any UserRole as the relation', () => {
      const tuple = groupMembershipTuple(USER_ID, GROUP_ID, UserRole.TEACHER, ENROLLMENT_START, null);
      expect(tuple.relation).toBe('teacher');
    });

    it('includes active_membership condition', () => {
      const tuple = groupMembershipTuple(USER_ID, GROUP_ID, UserRole.STUDENT, ENROLLMENT_START, null);

      expect(tuple.condition).toEqual({
        name: 'active_membership',
        context: {
          grant_start: ENROLLMENT_START.toISOString(),
          grant_end: FAR_FUTURE,
        },
      });
    });

    it('uses FAR_FUTURE for null end date', () => {
      const tuple = groupMembershipTuple(USER_ID, GROUP_ID, UserRole.TEACHER, ENROLLMENT_START, null);
      expect(tuple.condition!.context).toEqual({
        grant_start: ENROLLMENT_START.toISOString(),
        grant_end: FAR_FUTURE,
      });
    });

    it('uses provided end date when not null', () => {
      const tuple = groupMembershipTuple(USER_ID, GROUP_ID, UserRole.TEACHER, ENROLLMENT_START, ENROLLMENT_END);
      expect(tuple.condition!.context).toEqual({
        grant_start: ENROLLMENT_START.toISOString(),
        grant_end: ENROLLMENT_END.toISOString(),
      });
    });
  });

  describe('familyMembershipTuple', () => {
    const JOINED_ON = new Date('2023-09-01T00:00:00Z');
    const LEFT_ON = new Date('2024-06-30T23:59:59Z');

    it('returns correct tuple for parent role with active_membership condition', () => {
      const tuple = familyMembershipTuple(USER_ID, FAMILY_ID, UserFamilyRole.PARENT, JOINED_ON, LEFT_ON);

      expect(tuple).toEqual({
        user: `user:${USER_ID}`,
        relation: 'parent',
        object: `family:${FAMILY_ID}`,
        condition: {
          name: 'active_membership',
          context: {
            grant_start: JOINED_ON.toISOString(),
            grant_end: LEFT_ON.toISOString(),
          },
        },
      });
    });

    it('returns correct tuple for child role with active_membership condition', () => {
      const tuple = familyMembershipTuple(USER_ID, FAMILY_ID, UserFamilyRole.CHILD, JOINED_ON, null);

      expect(tuple).toEqual({
        user: `user:${USER_ID}`,
        relation: 'child',
        object: `family:${FAMILY_ID}`,
        condition: {
          name: 'active_membership',
          context: {
            grant_start: JOINED_ON.toISOString(),
            grant_end: FAR_FUTURE,
          },
        },
      });
    });

    it('uses FAR_FUTURE when leftOn is null', () => {
      const tuple = familyMembershipTuple(USER_ID, FAMILY_ID, UserFamilyRole.PARENT, JOINED_ON, null);
      expect(tuple.condition!.context).toEqual({
        grant_start: JOINED_ON.toISOString(),
        grant_end: FAR_FUTURE,
      });
    });

    it('uses provided leftOn when not null', () => {
      const tuple = familyMembershipTuple(USER_ID, FAMILY_ID, UserFamilyRole.PARENT, JOINED_ON, LEFT_ON);
      expect(tuple.condition!.context).toEqual({
        grant_start: JOINED_ON.toISOString(),
        grant_end: LEFT_ON.toISOString(),
      });
    });
  });

  describe('null and invalid date handling', () => {
    it('uses FAR_PAST when enrollmentStart is null', () => {
      const tuple = districtMembershipTuple(USER_ID, DISTRICT_ID, UserRole.TEACHER, null, ENROLLMENT_END);
      expect(tuple.condition!.context).toEqual({
        grant_start: FAR_PAST,
        grant_end: ENROLLMENT_END.toISOString(),
      });
    });

    it('uses FAR_PAST when enrollmentStart is an invalid Date', () => {
      const tuple = schoolMembershipTuple(USER_ID, SCHOOL_ID, UserRole.TEACHER, new Date('invalid'), null);
      expect(tuple.condition!.context).toEqual({
        grant_start: FAR_PAST,
        grant_end: FAR_FUTURE,
      });
    });

    it('uses FAR_PAST and FAR_FUTURE when both dates are null', () => {
      const tuple = classMembershipTuple(USER_ID, CLASS_ID, UserRole.STUDENT, null, null);
      expect(tuple.condition!.context).toEqual({
        grant_start: FAR_PAST,
        grant_end: FAR_FUTURE,
      });
    });

    it('handles null joinedOn in familyMembershipTuple', () => {
      const tuple = familyMembershipTuple(USER_ID, FAMILY_ID, UserFamilyRole.PARENT, null, null);
      expect(tuple.condition!.context).toEqual({
        grant_start: FAR_PAST,
        grant_end: FAR_FUTURE,
      });
    });
  });

  describe('schoolHierarchyTuples', () => {
    it('returns exactly 2 tuples', () => {
      const tuples = schoolHierarchyTuples(DISTRICT_ID, SCHOOL_ID);
      expect(tuples).toHaveLength(2);
    });

    it('first tuple is parent_org on the school', () => {
      const [parentOrg] = schoolHierarchyTuples(DISTRICT_ID, SCHOOL_ID);
      expect(parentOrg).toEqual({
        user: `district:${DISTRICT_ID}`,
        relation: 'parent_org',
        object: `school:${SCHOOL_ID}`,
      });
    });

    it('second tuple is child_school on the district', () => {
      const [, childSchool] = schoolHierarchyTuples(DISTRICT_ID, SCHOOL_ID);
      expect(childSchool).toEqual({
        user: `school:${SCHOOL_ID}`,
        relation: 'child_school',
        object: `district:${DISTRICT_ID}`,
      });
    });
  });

  describe('classHierarchyTuples', () => {
    it('returns exactly 2 tuples', () => {
      const tuples = classHierarchyTuples(SCHOOL_ID, CLASS_ID);
      expect(tuples).toHaveLength(2);
    });

    it('first tuple is parent_org on the class', () => {
      const [parentOrg] = classHierarchyTuples(SCHOOL_ID, CLASS_ID);
      expect(parentOrg).toEqual({
        user: `school:${SCHOOL_ID}`,
        relation: 'parent_org',
        object: `class:${CLASS_ID}`,
      });
    });

    it('second tuple is child_class on the school', () => {
      const [, childClass] = classHierarchyTuples(SCHOOL_ID, CLASS_ID);
      expect(childClass).toEqual({
        user: `class:${CLASS_ID}`,
        relation: 'child_class',
        object: `school:${SCHOOL_ID}`,
      });
    });
  });

  describe('administrationDistrictTuple', () => {
    it('returns assigned_district tuple', () => {
      const tuple = administrationDistrictTuple(ADMIN_ID, DISTRICT_ID);

      expect(tuple).toEqual({
        user: `district:${DISTRICT_ID}`,
        relation: 'assigned_district',
        object: `administration:${ADMIN_ID}`,
      });
    });
  });

  describe('administrationSchoolTuple', () => {
    it('returns assigned_school tuple', () => {
      const tuple = administrationSchoolTuple(ADMIN_ID, SCHOOL_ID);

      expect(tuple).toEqual({
        user: `school:${SCHOOL_ID}`,
        relation: 'assigned_school',
        object: `administration:${ADMIN_ID}`,
      });
    });
  });

  describe('administrationClassTuple', () => {
    it('returns assigned_class tuple', () => {
      const tuple = administrationClassTuple(ADMIN_ID, CLASS_ID);

      expect(tuple).toEqual({
        user: `class:${CLASS_ID}`,
        relation: 'assigned_class',
        object: `administration:${ADMIN_ID}`,
      });
    });
  });

  describe('administrationGroupTuple', () => {
    it('returns assigned_group tuple', () => {
      const tuple = administrationGroupTuple(ADMIN_ID, GROUP_ID);

      expect(tuple).toEqual({
        user: `group:${GROUP_ID}`,
        relation: 'assigned_group',
        object: `administration:${ADMIN_ID}`,
      });
    });
  });
});
