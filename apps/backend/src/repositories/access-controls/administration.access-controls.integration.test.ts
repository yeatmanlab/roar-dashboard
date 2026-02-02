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
import { describe, it, expect } from 'vitest';
import { AdministrationAccessControls } from './administration.access-controls';
import { CoreDbClient } from '../../test-support/db';
import { baseFixture } from '../../test-support/fixtures';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { UserRole } from '../../enums/user-role.enum';

describe('AdministrationAccessControls', () => {
  const accessControls = new AdministrationAccessControls();

  /**
   * Helper to execute the access control query and return administration IDs.
   */
  async function getAccessibleAdministrationIds(userId: string, allowedRoles: UserRole[]): Promise<string[]> {
    const query = accessControls.buildUserAdministrationIdsQuery({ userId, allowedRoles });
    const subquery = query.as('accessible');

    const result = await CoreDbClient.select({ administrationId: subquery.administrationId }).from(subquery);

    return result.map((r) => r.administrationId);
  }

  describe('buildUserAdministrationIdsQuery', () => {
    describe('ancestor access (all roles)', () => {
      it('student in class sees administrations on class, school, and district', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.classAStudent.id, [UserRole.STUDENT]);

        // Student in classInSchoolA should see:
        // - adminAtClassA (direct class membership)
        // - adminAtSchoolA (ancestor org)
        // - adminAtDistrict (ancestor org)
        expect(ids).toContain(baseFixture.adminAtClassA.id);
        expect(ids).toContain(baseFixture.adminAtSchoolA.id);
        expect(ids).toContain(baseFixture.adminAtDistrict.id);

        // Should NOT see:
        // - adminAtDistrictB (different branch)
        // - adminAtGroup (not a member)
        expect(ids).not.toContain(baseFixture.adminAtDistrictB.id);
        expect(ids).not.toContain(baseFixture.adminAtGroup.id);
      });

      it('student in group sees only group administrations', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.groupStudent.id, [UserRole.STUDENT]);

        // Only sees the group administration
        expect(ids).toContain(baseFixture.adminAtGroup.id);

        // Doesn't see org-based administrations
        expect(ids).not.toContain(baseFixture.adminAtDistrict.id);
        expect(ids).not.toContain(baseFixture.adminAtDistrictB.id);
      });

      it('student in district sees district administration only (no descendant access)', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.districtBStudent.id, [UserRole.STUDENT]);

        // Sees district-level admin
        expect(ids).toContain(baseFixture.adminAtDistrictB.id);

        // Student role = non-supervisory, so no descendant access
        // (District B has schoolInDistrictB, but no administrations assigned there)
        expect(ids).toHaveLength(1);
      });
    });

    describe('descendant access (supervisory roles)', () => {
      it('teacher in school sees administrations on school and descendant classes', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.schoolATeacher.id, [UserRole.TEACHER]);

        // Teacher in School A should see:
        // - adminAtSchoolA (own org)
        // - adminAtDistrict (ancestor)
        // - adminAtClassA (descendant class)
        expect(ids).toContain(baseFixture.adminAtSchoolA.id);
        expect(ids).toContain(baseFixture.adminAtDistrict.id);
        expect(ids).toContain(baseFixture.adminAtClassA.id);

        // Should NOT see:
        // - adminAtDistrictB (different branch)
        // - adminAtGroup (not a member)
        expect(ids).not.toContain(baseFixture.adminAtDistrictB.id);
        expect(ids).not.toContain(baseFixture.adminAtGroup.id);
      });

      it('administrator in district sees administrations on district and all descendants', async () => {
        const ids = await getAccessibleAdministrationIds(baseFixture.districtAdmin.id, [UserRole.ADMINISTRATOR]);

        // Administrator in District should see:
        // - adminAtDistrict (own org)
        // - adminAtSchoolA (descendant org)
        // - adminAtClassA (class in descendant org)
        expect(ids).toContain(baseFixture.adminAtDistrict.id);
        expect(ids).toContain(baseFixture.adminAtSchoolA.id);
        expect(ids).toContain(baseFixture.adminAtClassA.id);

        // Should NOT see:
        // - adminAtDistrictB (different branch)
        expect(ids).not.toContain(baseFixture.adminAtDistrictB.id);
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
        expect(ids).toContain(baseFixture.adminAtDistrictB.id);

        // Should NOT see any District A admins
        expect(ids).not.toContain(baseFixture.adminAtDistrict.id);
        expect(ids).not.toContain(baseFixture.adminAtSchoolA.id);
        expect(ids).not.toContain(baseFixture.adminAtClassA.id);
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
        // - adminAtClassA, adminAtSchoolA, adminAtDistrict
        expect(ids).toContain(baseFixture.adminAtClassA.id);
        expect(ids).toContain(baseFixture.adminAtSchoolA.id);
        expect(ids).toContain(baseFixture.adminAtDistrict.id);

        // Should also see through teacher membership in School B:
        // - adminAtDistrict (ancestor)
        // - adminAtSchoolB (teacher is supervisory, sees descendants, but also their own org)
        // Note: No admin directly on School B's classes in our test data beyond adminAtSchoolB
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
  });

  describe('buildAdministrationUserAssignmentsQuery', () => {
    it('returns users assigned via org membership', async () => {
      const query = accessControls.buildAdministrationUserAssignmentsQuery([baseFixture.adminAtDistrict.id]);
      const subquery = query.as('assignments');

      const result = await CoreDbClient.select({
        administrationId: subquery.administrationId,
        userId: subquery.userId,
      }).from(subquery);

      const userIds = result.map((r) => r.userId);

      // adminAtDistrict should include:
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
      const query = accessControls.buildAdministrationUserAssignmentsQuery([baseFixture.adminAtClassA.id]);
      const subquery = query.as('assignments');

      const result = await CoreDbClient.select({
        administrationId: subquery.administrationId,
        userId: subquery.userId,
      }).from(subquery);

      const userIds = result.map((r) => r.userId);

      // adminAtClassA should include only class members
      expect(userIds).toContain(baseFixture.classAStudent.id);

      // Should NOT include school/district members (they're not in the class)
      expect(userIds).not.toContain(baseFixture.schoolATeacher.id);
      expect(userIds).not.toContain(baseFixture.districtAdmin.id);
    });

    it('returns users assigned via group membership', async () => {
      const query = accessControls.buildAdministrationUserAssignmentsQuery([baseFixture.adminAtGroup.id]);
      const subquery = query.as('assignments');

      const result = await CoreDbClient.select({
        administrationId: subquery.administrationId,
        userId: subquery.userId,
      }).from(subquery);

      const userIds = result.map((r) => r.userId);

      // adminAtGroup should include only group members
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
        baseFixture.adminAtClassA.id,
        baseFixture.adminAtGroup.id,
      ]);

      // classInSchoolA has: classAStudent + classATeacher + any users added by "multiple roles" test
      // At minimum, classAStudent should be there
      expect(counts.get(baseFixture.adminAtClassA.id)).toBeGreaterThanOrEqual(1);

      // Group has: groupStudent = 1 user (isolated, not affected by other tests)
      expect(counts.get(baseFixture.adminAtGroup.id)).toBe(1);
    });

    it('does not include administrations with no assigned users', async () => {
      // Create an administration with no assignments
      const orphanAdmin = await AdministrationFactory.create({ name: 'Orphan Admin' });

      const counts = await accessControls.getAssignedUserCountsByAdministrationIds([
        orphanAdmin.id,
        baseFixture.adminAtGroup.id,
      ]);

      // Orphan admin not in map (0 users)
      expect(counts.has(orphanAdmin.id)).toBe(false);

      // Group still has 1 user
      expect(counts.get(baseFixture.adminAtGroup.id)).toBe(1);
    });

    it('deduplicates users with multiple paths to same administration', async () => {
      // Use the existing districtB hierarchy from the fixture for this test
      const testAdmin = await AdministrationFactory.create({ name: 'Test Admin for Dedup' });

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
  });
});
