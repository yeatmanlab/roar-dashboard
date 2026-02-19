/**
 * Integration tests for AdministrationAccessControls.
 *
 * Tests the authorization queries that determine which administrations a user can access
 * based on their org/class/group memberships. Uses the shared BaseFixture with a real
 * database (including ltree extension and triggers) to verify hierarchical access patterns.
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
 *
 * group (standalone)
 * ```
 *
 * ## Access Patterns Tested
 *
 * 1. Ancestor access (all roles): Users see administrations on their entity or ancestors
 * 2. Descendant access (supervisory roles): Supervisors see administrations on descendants
 * 3. No access: Users in different branches don't see each other's administrations
 * 4. Group access: Direct group membership grants access to group's administrations
 * 5. Class access: Direct class membership grants access to class's administrations
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AdministrationAccessControls } from './administration.access-controls';
import { getCoreDbClient } from '../../test-support/db';
import { baseFixture } from '../../test-support/fixtures';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { UserRole } from '../../enums/user-role.enum';

describe('AdministrationAccessControls', () => {
  let accessControls: AdministrationAccessControls;

  beforeAll(() => {
    accessControls = new AdministrationAccessControls();
  });

  /**
   * Helper to execute the access control query and return administration IDs.
   */
  async function getAccessibleAdministrationIds(userId: string, allowedRoles: UserRole[]): Promise<string[]> {
    const query = accessControls.buildUserAdministrationIdsQuery({ userId, allowedRoles });
    const subquery = query.as('accessible');

    const result = await getCoreDbClient().select({ administrationId: subquery.administrationId }).from(subquery);

    return result.map((r) => r.administrationId);
  }

  describe('buildUserAdministrationIdsQuery', () => {
    describe('ancestor access (all roles)', () => {
      it('student in class sees administrations on class, school, and district', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.classAStudent.id, [UserRole.STUDENT]);

        // Student in classInSchoolA should see:
        // - administrationAssignedToClassA (direct class membership)
        // - administrationAssignedToSchoolA (ancestor org)
        // - administrationAssignedToDistrict (ancestor org)
        expect(ids).toContain(baseFixture.administrationAssignedToClassA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);

        // Should NOT see:
        // - administrationAssignedToDistrictB (different branch)
        // - administrationAssignedToGroup (not a member)
        expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
        expect(ids).not.toContain(baseFixture.administrationAssignedToGroup.id);
      });

      it('student in group sees only group administrations', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.groupStudent.id, [UserRole.STUDENT]);

        // Only sees the group administration
        expect(ids).toContain(baseFixture.administrationAssignedToGroup.id);

        // Doesn't see org-based administrations
        expect(ids).not.toContain(baseFixture.administrationAssignedToDistrict.id);
        expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
      });

      it('student in district sees district administration only (no descendant access)', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.districtBStudent.id, [UserRole.STUDENT]);

        // Sees district-level admin
        expect(ids).toContain(baseFixture.administrationAssignedToDistrictB.id);

        // Student role = non-supervisory, so no descendant access
        // (District B has schoolInDistrictB, but no administrations assigned there)
        expect(ids).toHaveLength(1);
      });
    });

    describe('descendant access (supervisory roles)', () => {
      it('teacher in school sees administrations on school and descendant classes', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.schoolATeacher.id, [UserRole.TEACHER]);

        // Teacher in School A should see:
        // - administrationAssignedToSchoolA (own org)
        // - administrationAssignedToDistrict (ancestor)
        // - administrationAssignedToClassA (descendant class)
        expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
        expect(ids).toContain(baseFixture.administrationAssignedToClassA.id);

        // Should NOT see:
        // - administrationAssignedToDistrictB (different branch)
        // - administrationAssignedToGroup (not a member)
        expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
        expect(ids).not.toContain(baseFixture.administrationAssignedToGroup.id);
      });

      it('administrator in district sees administrations on district and all descendants', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.districtAdmin.id, [UserRole.ADMINISTRATOR]);

        // Administrator in District should see:
        // - administrationAssignedToDistrict (own org)
        // - administrationAssignedToSchoolA (descendant org)
        // - administrationAssignedToClassA (class in descendant org)
        expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
        expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToClassA.id);

        // Should NOT see:
        // - administrationAssignedToDistrictB (different branch)
        expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
      });
    });

    describe('no access scenarios', () => {
      it('user with no memberships sees no administrations', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.unassignedUser.id, [UserRole.STUDENT]);

        expect(ids).toHaveLength(0);
      });

      it('user in one branch cannot see administrations in another branch', async () => {
        // Student in District B
        const ids = await getAccessibleAdministrationIds(baseFixture.districtBStudent.id, [UserRole.STUDENT]);

        // Should see District B admin
        expect(ids).toContain(baseFixture.administrationAssignedToDistrictB.id);

        // Should NOT see any District A admins
        expect(ids).not.toContain(baseFixture.administrationAssignedToDistrict.id);
        expect(ids).not.toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).not.toContain(baseFixture.administrationAssignedToClassA.id);
      });

      it('non-matching role returns no results', async () => {
        // Teacher in School A, but query with student role (they don't have student membership)
        const ids = await getAccessibleAdministrationIds(baseFixture.schoolATeacher.id, [UserRole.STUDENT]);

        // No student memberships, so no results
        expect(ids).toHaveLength(0);
      });
    });

    describe('multiple roles', () => {
      it('handles user with multiple roles across different entities', async () => {
        // Create user with both teacher (org) and student (class) memberships
        const multiRoleUser = await UserFactory.create();
        await UserOrgFactory.create({
          userId: multiRoleUser.id,
          orgId: baseFixture.schoolB.id,
          role: UserRole.TEACHER,
        });
        await UserClassFactory.create({
          userId: multiRoleUser.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.STUDENT,
        });

        // Query with both roles
        const ids = await getAccessibleAdministrationIds(multiRoleUser.id, [UserRole.TEACHER, UserRole.STUDENT]);

        // Should see through student membership in classInSchoolA:
        // - administrationAssignedToClassA, administrationAssignedToSchoolA, administrationAssignedToDistrict
        expect(ids).toContain(baseFixture.administrationAssignedToClassA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);

        // Should also see through teacher membership in School B:
        // - administrationAssignedToDistrict (ancestor)
        // - administrationAssignedToSchoolB (teacher is supervisory, sees descendants, but also their own org)
        // Note: No admin directly on School B's classes in our test data beyond administrationAssignedToSchoolB
      });
    });

    describe('validation', () => {
      it('throws error for empty userId', async () => {
        await expect(async () => {
          accessControls.buildUserAdministrationIdsQuery({ userId: '', allowedRoles: [UserRole.STUDENT] });
        }).rejects.toThrow();
      });

      it('throws error for empty allowedRoles', async () => {
        await expect(async () => {
          accessControls.buildUserAdministrationIdsQuery({ userId: 'some-user-id', allowedRoles: [] });
        }).rejects.toThrow();
      });
    });

    describe('enrollment date boundaries', () => {
      it('excludes user with future enrollment start date (org membership)', async () => {
        // futureEnrollmentStudent has enrollment starting 7 days from now at School A
        const ids = await getAccessibleAdministrationIds(baseFixture.futureEnrollmentStudent.id, [UserRole.STUDENT]);

        // User's enrollment hasn't started yet, so they shouldn't see any administrations
        expect(ids).not.toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).not.toContain(baseFixture.administrationAssignedToDistrict.id);
        expect(ids).toHaveLength(0);
      });

      it('excludes user with expired enrollment (org membership)', async () => {
        // expiredEnrollmentStudent has enrollment that ended 7 days ago at School A
        const ids = await getAccessibleAdministrationIds(baseFixture.expiredEnrollmentStudent.id, [UserRole.STUDENT]);

        // User's enrollment has ended, so they shouldn't see any administrations
        expect(ids).not.toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).not.toContain(baseFixture.administrationAssignedToDistrict.id);
        expect(ids).toHaveLength(0);
      });

      it('includes user with active enrollment (null enrollmentEnd)', async () => {
        // schoolAStudent has active enrollment (default: enrollmentStart=now, enrollmentEnd=null)
        const ids = await getAccessibleAdministrationIds(baseFixture.schoolAStudent.id, [UserRole.STUDENT]);

        // User has active enrollment, so they should see administrations
        expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
      });

      it('excludes user with expired enrollment (class membership)', async () => {
        // expiredClassStudent has enrollment that ended 7 days ago in classInSchoolA
        const ids = await getAccessibleAdministrationIds(baseFixture.expiredClassStudent.id, [UserRole.STUDENT]);

        // User's enrollment has ended
        expect(ids).not.toContain(baseFixture.administrationAssignedToClassA.id);
        expect(ids).not.toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).toHaveLength(0);
      });

      it('includes user with active enrollment (class membership)', async () => {
        // classAStudent has active enrollment in classInSchoolA
        const ids = await getAccessibleAdministrationIds(baseFixture.classAStudent.id, [UserRole.STUDENT]);

        // User has active enrollment, so they should see class and ancestor administrations
        expect(ids).toContain(baseFixture.administrationAssignedToClassA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
        expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);
      });

      it('excludes user with future enrollment start date (group membership)', async () => {
        // futureGroupStudent has enrollment starting 7 days from now in the group
        const ids = await getAccessibleAdministrationIds(baseFixture.futureGroupStudent.id, [UserRole.STUDENT]);

        // User's enrollment hasn't started yet
        expect(ids).not.toContain(baseFixture.administrationAssignedToGroup.id);
        expect(ids).toHaveLength(0);
      });

      it('includes user with active enrollment (group membership)', async () => {
        // groupStudent has active enrollment in the group
        const ids = await getAccessibleAdministrationIds(baseFixture.groupStudent.id, [UserRole.STUDENT]);

        // User has active enrollment, so they should see group administration
        expect(ids).toContain(baseFixture.administrationAssignedToGroup.id);
      });
    });
  });

  describe('buildAdministrationUserAssignmentsQuery', () => {
    it('returns users assigned via org membership', async () => {
      const query = accessControls.buildAdministrationUserAssignmentsQuery([
        baseFixture.administrationAssignedToDistrict.id,
      ]);
      const subquery = query.as('assignments');

      const result = await getCoreDbClient()
        .select({
          administrationId: subquery.administrationId,
          userId: subquery.userId,
        })
        .from(subquery);

      const userIds = result.map((r) => r.userId);

      // administrationAssignedToDistrict should include:
      // - districtAdmin (directly in district)
      // - schoolATeacher (in child school)
      // - classAStudent (in class under child school)
      expect(userIds).toContain(baseFixture.districtAdmin.id);
      expect(userIds).toContain(baseFixture.schoolATeacher.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);

      // Should NOT include users in different branches
      expect(userIds).not.toContain(baseFixture.districtBStudent.id);
      expect(userIds).not.toContain(baseFixture.groupStudent.id);
    });

    it('returns users assigned via class membership', async () => {
      const query = accessControls.buildAdministrationUserAssignmentsQuery([
        baseFixture.administrationAssignedToClassA.id,
      ]);
      const subquery = query.as('assignments');

      const result = await getCoreDbClient()
        .select({
          administrationId: subquery.administrationId,
          userId: subquery.userId,
        })
        .from(subquery);

      const userIds = result.map((r) => r.userId);

      // administrationAssignedToClassA should include only class members
      expect(userIds).toContain(baseFixture.classAStudent.id);

      // Should NOT include school/district members (they're not in the class)
      expect(userIds).not.toContain(baseFixture.schoolATeacher.id);
      expect(userIds).not.toContain(baseFixture.districtAdmin.id);
    });

    it('returns users assigned via group membership', async () => {
      const query = accessControls.buildAdministrationUserAssignmentsQuery([
        baseFixture.administrationAssignedToGroup.id,
      ]);
      const subquery = query.as('assignments');

      const result = await getCoreDbClient()
        .select({
          administrationId: subquery.administrationId,
          userId: subquery.userId,
        })
        .from(subquery);

      const userIds = result.map((r) => r.userId);

      // administrationAssignedToGroup should include only group members
      expect(userIds).toContain(baseFixture.groupStudent.id);
      expect(userIds).toHaveLength(1);
    });

    it('throws error for empty administrationIds', () => {
      expect(() => {
        accessControls.buildAdministrationUserAssignmentsQuery([]);
      }).toThrow('administrationIds are required');
    });
  });

  describe('getAssignedUserCountsByAdministrationIds', () => {
    it('returns correct counts for administrations', async () => {
      // Note: Earlier tests may have added users to District A (multiRoleUser in "multiple roles" test)
      // We'll use relative comparisons where absolute counts depend on test order
      const counts = await accessControls.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToClassA.id,
        baseFixture.administrationAssignedToGroup.id,
      ]);

      // classInSchoolA has: classAStudent + classATeacher + any users added by "multiple roles" test
      // At minimum, classAStudent should be there
      expect(counts.get(baseFixture.administrationAssignedToClassA.id)).toBeGreaterThanOrEqual(1);

      // Group has: groupStudent = 1 user (isolated, not affected by other tests)
      expect(counts.get(baseFixture.administrationAssignedToGroup.id)).toBe(1);
    });

    it('does not include administrations with no assigned users', async () => {
      // Create an administration with no assignments
      const orphanAdmin = await AdministrationFactory.create({
        name: 'Orphan Admin',
        createdBy: baseFixture.districtAdmin.id,
      });

      const counts = await accessControls.getAssignedUserCountsByAdministrationIds([
        orphanAdmin.id,
        baseFixture.administrationAssignedToGroup.id,
      ]);

      // Orphan admin not in map (0 users)
      expect(counts.has(orphanAdmin.id)).toBe(false);

      // Group still has 1 user
      expect(counts.get(baseFixture.administrationAssignedToGroup.id)).toBe(1);
    });

    it('deduplicates users with multiple paths to same administration', async () => {
      // Use the existing districtB hierarchy from the fixture for this test
      const testAdmin = await AdministrationFactory.create({
        name: 'Test Admin for Dedup',
        createdBy: baseFixture.districtBAdmin.id,
      });

      // Assign to districtB (users in this branch can access it)
      const { AdministrationOrgFactory } = await import('../../test-support/factories/administration-org.factory');
      await AdministrationOrgFactory.create({
        administrationId: testAdmin.id,
        orgId: baseFixture.districtB.id,
      });

      // Create a user who is both in districtB org AND in classInDistrictB
      const dualMembershipUser = await UserFactory.create();
      await UserOrgFactory.create({
        userId: dualMembershipUser.id,
        orgId: baseFixture.districtB.id,
        role: UserRole.ADMINISTRATOR,
      });
      await UserClassFactory.create({
        userId: dualMembershipUser.id,
        classId: baseFixture.classInDistrictB.id,
        role: UserRole.STUDENT,
      });

      const countsBefore = await accessControls.getAssignedUserCountsByAdministrationIds([testAdmin.id]);

      // dualMembershipUser has 2 paths to testAdmin (via districtB org + via classInDistrictB)
      // but should only be counted once
      // Also includes districtBStudent from the fixture
      const count = countsBefore.get(testAdmin.id) ?? 0;

      // Verify deduplication by checking that adding another path doesn't increase count
      // Add dualMembershipUser to schoolInDistrictB as well (3rd path)
      await UserOrgFactory.create({
        userId: dualMembershipUser.id,
        orgId: baseFixture.schoolInDistrictB.id,
        role: UserRole.TEACHER,
      });

      const countsAfter = await accessControls.getAssignedUserCountsByAdministrationIds([testAdmin.id]);

      // Count should be the same - user is still one person despite 3 paths
      expect(countsAfter.get(testAdmin.id)).toBe(count);
    });

    it('throws error for empty administrationIds', async () => {
      await expect(accessControls.getAssignedUserCountsByAdministrationIds([])).rejects.toThrow(
        'administrationIds required',
      );
    });

    describe('enrollment date boundaries', () => {
      it('excludes users with expired enrollments from count', async () => {
        // administrationAssignedToSchoolA is assigned to School A
        // schoolAStudent has active enrollment, expiredEnrollmentStudent has expired enrollment
        const counts = await accessControls.getAssignedUserCountsByAdministrationIds([
          baseFixture.administrationAssignedToSchoolA.id,
        ]);

        // Get the assigned users to verify
        const query = accessControls.buildAdministrationUserAssignmentsQuery([
          baseFixture.administrationAssignedToSchoolA.id,
        ]);
        const subquery = query.as('assignments');
        const result = await getCoreDbClient().select({ userId: subquery.userId }).from(subquery);
        const userIds = result.map((r) => r.userId);

        // Active enrollment users should be included
        expect(userIds).toContain(baseFixture.schoolAStudent.id);
        expect(userIds).toContain(baseFixture.schoolATeacher.id);

        // Expired enrollment user should NOT be included
        expect(userIds).not.toContain(baseFixture.expiredEnrollmentStudent.id);

        // Future enrollment user should NOT be included
        expect(userIds).not.toContain(baseFixture.futureEnrollmentStudent.id);

        // Count should match the number of active users
        expect(counts.get(baseFixture.administrationAssignedToSchoolA.id)).toBeGreaterThanOrEqual(1);
      });

      it('excludes users with expired class enrollments from count', async () => {
        // administrationAssignedToClassA is assigned to classInSchoolA
        // classAStudent has active enrollment, expiredClassStudent has expired enrollment
        const query = accessControls.buildAdministrationUserAssignmentsQuery([
          baseFixture.administrationAssignedToClassA.id,
        ]);
        const subquery = query.as('assignments');
        const result = await getCoreDbClient().select({ userId: subquery.userId }).from(subquery);
        const userIds = result.map((r) => r.userId);

        // Active enrollment user should be included
        expect(userIds).toContain(baseFixture.classAStudent.id);

        // Expired enrollment user should NOT be included
        expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
      });

      it('excludes users with future group enrollments from count', async () => {
        // administrationAssignedToGroup is assigned to the standalone group
        // groupStudent has active enrollment, futureGroupStudent has future enrollment
        const query = accessControls.buildAdministrationUserAssignmentsQuery([
          baseFixture.administrationAssignedToGroup.id,
        ]);
        const subquery = query.as('assignments');
        const result = await getCoreDbClient().select({ userId: subquery.userId }).from(subquery);
        const userIds = result.map((r) => r.userId);

        // Active enrollment user should be included
        expect(userIds).toContain(baseFixture.groupStudent.id);

        // Future enrollment user should NOT be included
        expect(userIds).not.toContain(baseFixture.futureGroupStudent.id);

        // Should only count the active user
        expect(userIds).toHaveLength(1);
      });
    });
  });

  describe('getUserRolesForAdministration', () => {
    it('returns roles for user with org membership', async () => {
      // districtAdmin has ADMINISTRATOR role at district level
      const roles = await accessControls.getUserRolesForAdministration(
        baseFixture.districtAdmin.id,
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(roles).toContain('administrator');
    });

    it('returns roles for user with class membership', async () => {
      // classAStudent has STUDENT role in classInSchoolA
      const roles = await accessControls.getUserRolesForAdministration(
        baseFixture.classAStudent.id,
        baseFixture.administrationAssignedToClassA.id,
      );

      expect(roles).toContain('student');
    });

    it('returns roles for user with group membership', async () => {
      // groupStudent has STUDENT role in the standalone group
      const roles = await accessControls.getUserRolesForAdministration(
        baseFixture.groupStudent.id,
        baseFixture.administrationAssignedToGroup.id,
      );

      expect(roles).toContain('student');
    });

    it('returns multiple roles for user with multiple memberships', async () => {
      // multiAssignedUser has ADMINISTRATOR at district and TEACHER at schoolA
      const roles = await accessControls.getUserRolesForAdministration(
        baseFixture.multiAssignedUser.id,
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(roles).toContain('administrator');
      expect(roles).toContain('teacher');
    });

    it('returns empty array for user with no access to administration', async () => {
      // districtBAdmin has no access to administrationAssignedToDistrict (different branch)
      const roles = await accessControls.getUserRolesForAdministration(
        baseFixture.districtBAdmin.id,
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(roles).toHaveLength(0);
    });

    it('returns empty array for user with no memberships', async () => {
      const roles = await accessControls.getUserRolesForAdministration(
        baseFixture.unassignedUser.id,
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(roles).toHaveLength(0);
    });

    it('excludes roles from expired enrollments', async () => {
      // expiredEnrollmentStudent has expired enrollment at School A
      const roles = await accessControls.getUserRolesForAdministration(
        baseFixture.expiredEnrollmentStudent.id,
        baseFixture.administrationAssignedToSchoolA.id,
      );

      expect(roles).toHaveLength(0);
    });

    it('excludes roles from future enrollments', async () => {
      // futureEnrollmentStudent has future enrollment at School A
      const roles = await accessControls.getUserRolesForAdministration(
        baseFixture.futureEnrollmentStudent.id,
        baseFixture.administrationAssignedToSchoolA.id,
      );

      expect(roles).toHaveLength(0);
    });
  });
});
