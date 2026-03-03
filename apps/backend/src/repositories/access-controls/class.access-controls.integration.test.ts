/**
 * Integration tests for ClassAccessControls.
 *
 * Tests the authorization queries that determine user roles for a specific class
 * based on their org/class memberships. Uses the shared BaseFixture with a real
 * database (including ltree extension) to verify hierarchical access patterns.
 *
 * ## BaseFixture Structure Used
 *
 * ```
 * district (District A)
 * ├── schoolA
 * │   └── classInSchoolA
 * └── schoolB
 *     └── classInSchoolB
 *
 * districtB (District B - separate branch)
 * └── schoolInDistrictB
 *     └── classInDistrictB
 * ```
 *
 * ## Access Patterns Tested
 *
 * 1. Direct class membership: Users get roles from their direct class assignments
 * 2. Org membership: Users get roles from org memberships in ancestor orgs of the class
 * 3. No access: Users in different branches don't have roles for classes outside their hierarchy
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ClassAccessControls } from './class.access-controls';
import { CoreDbClient } from '../../test-support/db';
import { baseFixture } from '../../test-support/fixtures';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { UserRole } from '../../enums/user-role.enum';

describe('ClassAccessControls', () => {
  let accessControls: ClassAccessControls;

  beforeAll(() => {
    accessControls = new ClassAccessControls(CoreDbClient);
  });

  describe('getUserRolesForClass', () => {
    describe('direct class membership', () => {
      it('returns role for user with direct class membership', async () => {
        // classAStudent has STUDENT role in classInSchoolA
        const roles = await accessControls.getUserRolesForClass(
          baseFixture.classAStudent.id,
          baseFixture.classInSchoolA.id,
        );

        expect(roles).toContain('student');
      });

      it('returns role for teacher with direct class membership', async () => {
        // Create a teacher with direct class membership
        const classTeacher = await UserFactory.create();
        await UserClassFactory.create({
          userId: classTeacher.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.TEACHER,
        });

        const roles = await accessControls.getUserRolesForClass(classTeacher.id, baseFixture.classInSchoolA.id);

        expect(roles).toContain('teacher');
      });
    });

    describe('org membership (ancestor access)', () => {
      it('returns role for user with org membership in class school', async () => {
        // schoolATeacher has TEACHER role in School A
        const roles = await accessControls.getUserRolesForClass(
          baseFixture.schoolATeacher.id,
          baseFixture.classInSchoolA.id,
        );

        expect(roles).toContain('teacher');
      });

      it('returns role for user with org membership in ancestor district', async () => {
        // districtAdmin has ADMINISTRATOR role in District
        const roles = await accessControls.getUserRolesForClass(
          baseFixture.districtAdmin.id,
          baseFixture.classInSchoolA.id,
        );

        expect(roles).toContain('administrator');
      });
    });

    describe('multiple roles', () => {
      it('returns multiple roles for user with multiple memberships', async () => {
        // Create user with both class and org memberships
        const multiRoleUser = await UserFactory.create();
        await UserClassFactory.create({
          userId: multiRoleUser.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: multiRoleUser.id,
          orgId: baseFixture.schoolA.id,
          role: UserRole.TEACHER,
        });

        const roles = await accessControls.getUserRolesForClass(multiRoleUser.id, baseFixture.classInSchoolA.id);

        expect(roles).toContain('student');
        expect(roles).toContain('teacher');
        expect(roles.length).toBe(2);
      });

      it('deduplicates roles from multiple paths', async () => {
        // Create user with teacher role in both class and school
        const teacherUser = await UserFactory.create();
        await UserClassFactory.create({
          userId: teacherUser.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.TEACHER,
        });
        await UserOrgFactory.create({
          userId: teacherUser.id,
          orgId: baseFixture.schoolA.id,
          role: UserRole.TEACHER,
        });

        const roles = await accessControls.getUserRolesForClass(teacherUser.id, baseFixture.classInSchoolA.id);

        // Should only have 'teacher' once, not duplicated
        expect(roles).toContain('teacher');
        expect(roles.length).toBe(1);
      });
    });

    describe('no access scenarios', () => {
      it('returns empty array for user with no memberships', async () => {
        const roles = await accessControls.getUserRolesForClass(
          baseFixture.unassignedUser.id,
          baseFixture.classInSchoolA.id,
        );

        expect(roles).toHaveLength(0);
      });

      it('returns empty array for user in different branch', async () => {
        // districtBAdmin has no access to classInSchoolA (different branch)
        const roles = await accessControls.getUserRolesForClass(
          baseFixture.districtBAdmin.id,
          baseFixture.classInSchoolA.id,
        );

        expect(roles).toHaveLength(0);
      });

      it('returns empty array for user in sibling org', async () => {
        // Create a teacher in School B
        const schoolBTeacher = await UserFactory.create();
        await UserOrgFactory.create({
          userId: schoolBTeacher.id,
          orgId: baseFixture.schoolB.id,
          role: UserRole.TEACHER,
        });

        // Should not have access to classInSchoolA (sibling school)
        const roles = await accessControls.getUserRolesForClass(schoolBTeacher.id, baseFixture.classInSchoolA.id);

        expect(roles).toHaveLength(0);
      });
    });

    describe('enrollment date boundaries', () => {
      it('excludes roles from expired class enrollment', async () => {
        // Create a teacher with expired class enrollment
        const expiredClassTeacher = await UserFactory.create();
        await UserClassFactory.create({
          userId: expiredClassTeacher.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.TEACHER,
          enrollmentStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          enrollmentEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        });

        const roles = await accessControls.getUserRolesForClass(expiredClassTeacher.id, baseFixture.classInSchoolA.id);

        expect(roles).toHaveLength(0);
      });

      it('excludes roles from future class enrollment', async () => {
        // Create a teacher with future enrollment
        const futureClassTeacher = await UserFactory.create();
        await UserClassFactory.create({
          userId: futureClassTeacher.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.TEACHER,
          enrollmentStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        });

        const roles = await accessControls.getUserRolesForClass(futureClassTeacher.id, baseFixture.classInSchoolA.id);

        expect(roles).toHaveLength(0);
      });

      it('includes roles from active class enrollment', async () => {
        // Create a teacher with active enrollment
        const activeClassTeacher = await UserFactory.create();
        await UserClassFactory.create({
          userId: activeClassTeacher.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.TEACHER,
        });

        const roles = await accessControls.getUserRolesForClass(activeClassTeacher.id, baseFixture.classInSchoolA.id);

        expect(roles).toContain('teacher');
      });

      it('excludes roles from expired org enrollment', async () => {
        // Create a teacher with expired org enrollment at School A
        const expiredOrgTeacher = await UserFactory.create();
        await UserOrgFactory.create({
          userId: expiredOrgTeacher.id,
          orgId: baseFixture.schoolA.id,
          role: UserRole.TEACHER,
          enrollmentStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          enrollmentEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        });

        const roles = await accessControls.getUserRolesForClass(expiredOrgTeacher.id, baseFixture.classInSchoolA.id);

        expect(roles).toHaveLength(0);
      });

      it('includes roles from active org enrollment', async () => {
        // schoolATeacher has active enrollment in School A
        const roles = await accessControls.getUserRolesForClass(
          baseFixture.schoolATeacher.id,
          baseFixture.classInSchoolA.id,
        );

        expect(roles).toContain('teacher');
      });
    });
  });
});
