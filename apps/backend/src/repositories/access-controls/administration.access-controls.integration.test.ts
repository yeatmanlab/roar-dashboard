/**
 * Integration tests for AdministrationAccessControls.
 *
 * Tests the authorization queries that determine which administrations a user can access
 * based on their org/class/group memberships. Uses a real database with the ltree
 * extension and triggers to verify hierarchical access patterns.
 *
 * ## Test Org Hierarchy
 *
 * ```
 * District A
 * ├── School A1
 * │   └── Class A1-1
 * └── School A2
 *     └── Class A2-1
 *
 * District B (separate branch)
 * └── School B1
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
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AdministrationAccessControls } from './administration.access-controls';
import { truncateAllTables, CoreDbClient } from '../../test-support/db';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { UserGroupFactory } from '../../test-support/factories/user-group.factory';
import { AdministrationOrgFactory } from '../../test-support/factories/administration-org.factory';
import { AdministrationClassFactory } from '../../test-support/factories/administration-class.factory';
import { AdministrationGroupFactory } from '../../test-support/factories/administration-group.factory';
import { OrgType } from '../../enums/org-type.enum';
import { UserRole } from '../../enums/user-role.enum';
import type { Org, Class, Group, User, Administration } from '../../db/schema';

describe('AdministrationAccessControls', () => {
  const accessControls = new AdministrationAccessControls();

  // Test data - populated in beforeAll
  let districtA: Org;
  let schoolA1: Org;
  let schoolA2: Org;
  let classA1_1: Class;
  let districtB: Org;
  let groupX: Group;

  // Administrations at different levels
  let adminOnDistrictA: Administration;
  let adminOnSchoolA1: Administration;
  let adminOnClassA1_1: Administration;
  let adminOnGroupX: Administration;
  let adminOnDistrictB: Administration;

  // Users with different roles and memberships
  let studentInClassA1_1: User;
  let teacherInSchoolA1: User;
  let adminInDistrictA: User;
  let studentInDistrictB: User;
  let studentInGroupX: User;

  beforeAll(async () => {
    await truncateAllTables();

    // ─────────────────────────────────────────────────────────────────────
    // Create org hierarchy
    // ─────────────────────────────────────────────────────────────────────

    // District A with two schools
    districtA = await OrgFactory.create({ orgType: OrgType.DISTRICT, name: 'District A' });
    schoolA1 = await OrgFactory.create({
      orgType: OrgType.SCHOOL,
      name: 'School A1',
      parentOrgId: districtA.id,
    });
    schoolA2 = await OrgFactory.create({
      orgType: OrgType.SCHOOL,
      name: 'School A2',
      parentOrgId: districtA.id,
    });

    // Classes under schools
    classA1_1 = await ClassFactory.create({
      name: 'Class A1-1',
      schoolId: schoolA1.id,
      districtId: districtA.id,
    });
    // Class A2-1 created for hierarchy completeness but not directly referenced in tests
    await ClassFactory.create({
      name: 'Class A2-1',
      schoolId: schoolA2.id,
      districtId: districtA.id,
    });

    // Separate district B (different branch)
    districtB = await OrgFactory.create({ orgType: OrgType.DISTRICT, name: 'District B' });
    // School B1 created for hierarchy completeness but not directly referenced in tests
    await OrgFactory.create({
      orgType: OrgType.SCHOOL,
      name: 'School B1',
      parentOrgId: districtB.id,
    });

    // Group (flat, no hierarchy)
    groupX = await GroupFactory.create({ name: 'Group X' });

    // ─────────────────────────────────────────────────────────────────────
    // Create administrations at different levels
    // ─────────────────────────────────────────────────────────────────────

    adminOnDistrictA = await AdministrationFactory.create({ name: 'Admin on District A' });
    await AdministrationOrgFactory.create({
      administrationId: adminOnDistrictA.id,
      orgId: districtA.id,
    });

    adminOnSchoolA1 = await AdministrationFactory.create({ name: 'Admin on School A1' });
    await AdministrationOrgFactory.create({
      administrationId: adminOnSchoolA1.id,
      orgId: schoolA1.id,
    });

    adminOnClassA1_1 = await AdministrationFactory.create({ name: 'Admin on Class A1-1' });
    await AdministrationClassFactory.create({
      administrationId: adminOnClassA1_1.id,
      classId: classA1_1.id,
    });

    adminOnGroupX = await AdministrationFactory.create({ name: 'Admin on Group X' });
    await AdministrationGroupFactory.create({
      administrationId: adminOnGroupX.id,
      groupId: groupX.id,
    });

    adminOnDistrictB = await AdministrationFactory.create({ name: 'Admin on District B' });
    await AdministrationOrgFactory.create({
      administrationId: adminOnDistrictB.id,
      orgId: districtB.id,
    });

    // ─────────────────────────────────────────────────────────────────────
    // Create users with memberships
    // ─────────────────────────────────────────────────────────────────────

    // Student in Class A1-1
    studentInClassA1_1 = await UserFactory.create();
    await UserClassFactory.create({
      userId: studentInClassA1_1.id,
      classId: classA1_1.id,
      role: UserRole.STUDENT,
    });

    // Teacher in School A1 (supervisory role)
    teacherInSchoolA1 = await UserFactory.create();
    await UserOrgFactory.create({
      userId: teacherInSchoolA1.id,
      orgId: schoolA1.id,
      role: UserRole.TEACHER,
    });

    // Administrator in District A (supervisory role)
    adminInDistrictA = await UserFactory.create();
    await UserOrgFactory.create({
      userId: adminInDistrictA.id,
      orgId: districtA.id,
      role: UserRole.ADMINISTRATOR,
    });

    // Student in District B (different branch)
    studentInDistrictB = await UserFactory.create();
    await UserOrgFactory.create({
      userId: studentInDistrictB.id,
      orgId: districtB.id,
      role: UserRole.STUDENT,
    });

    // Student in Group X
    studentInGroupX = await UserFactory.create();
    await UserGroupFactory.create({
      userId: studentInGroupX.id,
      groupId: groupX.id,
      role: UserRole.STUDENT,
    });
  });

  afterAll(async () => {
    await truncateAllTables();
  });

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
        const ids = await getAccessibleAdministrationIds(studentInClassA1_1.id, [UserRole.STUDENT]);

        // Student in Class A1-1 should see:
        // - Admin on Class A1-1 (direct class membership)
        // - Admin on School A1 (ancestor org)
        // - Admin on District A (ancestor org)
        expect(ids).toContain(adminOnClassA1_1.id);
        expect(ids).toContain(adminOnSchoolA1.id);
        expect(ids).toContain(adminOnDistrictA.id);

        // Should NOT see:
        // - Admin on District B (different branch)
        // - Admin on Group X (not a member)
        expect(ids).not.toContain(adminOnDistrictB.id);
        expect(ids).not.toContain(adminOnGroupX.id);
      });

      it('student in group sees only group administrations', async () => {
        const ids = await getAccessibleAdministrationIds(studentInGroupX.id, [UserRole.STUDENT]);

        // Only sees the group administration
        expect(ids).toContain(adminOnGroupX.id);

        // Doesn't see org-based administrations
        expect(ids).not.toContain(adminOnDistrictA.id);
        expect(ids).not.toContain(adminOnDistrictB.id);
      });

      it('student in district sees district administration only (no descendant access)', async () => {
        const ids = await getAccessibleAdministrationIds(studentInDistrictB.id, [UserRole.STUDENT]);

        // Sees district-level admin
        expect(ids).toContain(adminOnDistrictB.id);

        // Student role = non-supervisory, so no descendant access
        // (District B has School B1, but no administrations assigned there)
        expect(ids).toHaveLength(1);
      });
    });

    describe('descendant access (supervisory roles)', () => {
      it('teacher in school sees administrations on school and descendant classes', async () => {
        const ids = await getAccessibleAdministrationIds(teacherInSchoolA1.id, [UserRole.TEACHER]);

        // Teacher in School A1 should see:
        // - Admin on School A1 (own org)
        // - Admin on District A (ancestor)
        // - Admin on Class A1-1 (descendant class)
        expect(ids).toContain(adminOnSchoolA1.id);
        expect(ids).toContain(adminOnDistrictA.id);
        expect(ids).toContain(adminOnClassA1_1.id);

        // Should NOT see:
        // - Admin on District B (different branch)
        // - Admin on Group X (not a member)
        expect(ids).not.toContain(adminOnDistrictB.id);
        expect(ids).not.toContain(adminOnGroupX.id);
      });

      it('administrator in district sees administrations on district and all descendants', async () => {
        const ids = await getAccessibleAdministrationIds(adminInDistrictA.id, [UserRole.ADMINISTRATOR]);

        // Administrator in District A should see:
        // - Admin on District A (own org)
        // - Admin on School A1 (descendant org)
        // - Admin on Class A1-1 (class in descendant org)
        expect(ids).toContain(adminOnDistrictA.id);
        expect(ids).toContain(adminOnSchoolA1.id);
        expect(ids).toContain(adminOnClassA1_1.id);

        // Should NOT see:
        // - Admin on District B (different branch)
        expect(ids).not.toContain(adminOnDistrictB.id);
      });
    });

    describe('no access scenarios', () => {
      it('user with no memberships sees no administrations', async () => {
        const userWithNoMemberships = await UserFactory.create();

        const ids = await getAccessibleAdministrationIds(userWithNoMemberships.id, [UserRole.STUDENT]);

        expect(ids).toHaveLength(0);
      });

      it('user in one branch cannot see administrations in another branch', async () => {
        // Student in District B
        const ids = await getAccessibleAdministrationIds(studentInDistrictB.id, [UserRole.STUDENT]);

        // Should see District B admin
        expect(ids).toContain(adminOnDistrictB.id);

        // Should NOT see any District A admins
        expect(ids).not.toContain(adminOnDistrictA.id);
        expect(ids).not.toContain(adminOnSchoolA1.id);
        expect(ids).not.toContain(adminOnClassA1_1.id);
      });

      it('non-matching role returns no results', async () => {
        // Teacher in School A1, but query with student role (they don't have student membership)
        const ids = await getAccessibleAdministrationIds(teacherInSchoolA1.id, [UserRole.STUDENT]);

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
          orgId: schoolA2.id,
          role: UserRole.TEACHER,
        });
        await UserClassFactory.create({
          userId: multiRoleUser.id,
          classId: classA1_1.id,
          role: UserRole.STUDENT,
        });

        // Query with both roles
        const ids = await getAccessibleAdministrationIds(multiRoleUser.id, [UserRole.TEACHER, UserRole.STUDENT]);

        // Should see through student membership in Class A1-1:
        // - Admin on Class A1-1, School A1, District A
        expect(ids).toContain(adminOnClassA1_1.id);
        expect(ids).toContain(adminOnSchoolA1.id);
        expect(ids).toContain(adminOnDistrictA.id);

        // Should also see through teacher membership in School A2:
        // - Admin on District A (ancestor)
        // - Admin on Class A2-1 (descendant - teacher is supervisory)
        // Note: No admin directly on School A2 in our test data
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
      const query = accessControls.buildAdministrationUserAssignmentsQuery([adminOnDistrictA.id]);
      const subquery = query.as('assignments');

      const result = await CoreDbClient.select({
        administrationId: subquery.administrationId,
        userId: subquery.userId,
      }).from(subquery);

      const userIds = result.map((r) => r.userId);

      // Admin on District A should include:
      // - adminInDistrictA (directly in district)
      // - teacherInSchoolA1 (in child school)
      // - studentInClassA1_1 (in class under child school)
      expect(userIds).toContain(adminInDistrictA.id);
      expect(userIds).toContain(teacherInSchoolA1.id);
      expect(userIds).toContain(studentInClassA1_1.id);

      // Should NOT include users in different branches
      expect(userIds).not.toContain(studentInDistrictB.id);
      expect(userIds).not.toContain(studentInGroupX.id);
    });

    it('returns users assigned via class membership', async () => {
      const query = accessControls.buildAdministrationUserAssignmentsQuery([adminOnClassA1_1.id]);
      const subquery = query.as('assignments');

      const result = await CoreDbClient.select({
        administrationId: subquery.administrationId,
        userId: subquery.userId,
      }).from(subquery);

      const userIds = result.map((r) => r.userId);

      // Admin on Class A1-1 should include only class members
      expect(userIds).toContain(studentInClassA1_1.id);

      // Should NOT include school/district members (they're not in the class)
      expect(userIds).not.toContain(teacherInSchoolA1.id);
      expect(userIds).not.toContain(adminInDistrictA.id);
    });

    it('returns users assigned via group membership', async () => {
      const query = accessControls.buildAdministrationUserAssignmentsQuery([adminOnGroupX.id]);
      const subquery = query.as('assignments');

      const result = await CoreDbClient.select({
        administrationId: subquery.administrationId,
        userId: subquery.userId,
      }).from(subquery);

      const userIds = result.map((r) => r.userId);

      // Admin on Group X should include only group members
      expect(userIds).toContain(studentInGroupX.id);
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
        adminOnClassA1_1.id,
        adminOnGroupX.id,
      ]);

      // Class A1-1 has: studentInClassA1_1 + any users added by "multiple roles" test
      // At minimum, studentInClassA1_1 should be there
      expect(counts.get(adminOnClassA1_1.id)).toBeGreaterThanOrEqual(1);

      // Group X has: studentInGroupX = 1 user (isolated, not affected by other tests)
      expect(counts.get(adminOnGroupX.id)).toBe(1);
    });

    it('does not include administrations with no assigned users', async () => {
      // Create an administration with no assignments
      const orphanAdmin = await AdministrationFactory.create({ name: 'Orphan Admin' });

      const counts = await accessControls.getAssignedUserCountsByAdministrationIds([orphanAdmin.id, adminOnGroupX.id]);

      // Orphan admin not in map (0 users)
      expect(counts.has(orphanAdmin.id)).toBe(false);

      // Group X still has 1 user
      expect(counts.get(adminOnGroupX.id)).toBe(1);
    });

    it('deduplicates users with multiple paths to same administration', async () => {
      // Create a fresh administration and entities for this test to avoid interference
      const testSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Test School for Dedup',
        parentOrgId: districtB.id, // Use District B to isolate from other tests
      });
      const testClass = await ClassFactory.create({
        name: 'Test Class for Dedup',
        schoolId: testSchool.id,
        districtId: districtB.id,
      });
      const testAdmin = await AdministrationFactory.create({ name: 'Test Admin for Dedup' });
      await AdministrationOrgFactory.create({
        administrationId: testAdmin.id,
        orgId: districtB.id,
      });

      // Create a user who is both in District B org AND in Test Class
      const dualMembershipUser = await UserFactory.create();
      await UserOrgFactory.create({
        userId: dualMembershipUser.id,
        orgId: districtB.id,
        role: UserRole.ADMINISTRATOR,
      });
      await UserClassFactory.create({
        userId: dualMembershipUser.id,
        classId: testClass.id,
        role: UserRole.STUDENT,
      });

      const countsBefore = await accessControls.getAssignedUserCountsByAdministrationIds([testAdmin.id]);

      // dualMembershipUser has 2 paths to testAdmin (via districtB org + via testClass)
      // but should only be counted once
      // Also includes studentInDistrictB from earlier setup
      const count = countsBefore.get(testAdmin.id) ?? 0;

      // Verify deduplication by checking that adding another path doesn't increase count
      // Add dualMembershipUser to school as well (3rd path)
      await UserOrgFactory.create({
        userId: dualMembershipUser.id,
        orgId: testSchool.id,
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
