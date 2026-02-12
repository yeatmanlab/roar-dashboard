/**
 * Integration tests for OrgAccessControls.
 *
 * Tests the authorization queries that determine which orgs a user can access
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
 * 1. Ancestor access (all roles): Users see their org and ancestor orgs
 * 2. Descendant access (supervisory roles): Supervisors see descendant orgs
 * 3. No access: Users in different branches don't see each other's orgs
 */
import { describe, it, expect } from 'vitest';
import { OrgAccessControls } from './org.access-controls';
import { CoreDbClient } from '../../test-support/db';
import { baseFixture } from '../../test-support/fixtures';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { UserRole } from '../../enums/user-role.enum';

describe('OrgAccessControls', () => {
  const accessControls = new OrgAccessControls();

  /**
   * Helper to execute the access control query and return org IDs.
   */
  async function getAccessibleOrgIds(userId: string, allowedRoles: UserRole[]): Promise<string[]> {
    const query = accessControls.buildUserAccessibleOrgIdsQuery({ userId, allowedRoles });
    const subquery = query.as('accessible');

    const result = await CoreDbClient.select({ orgId: subquery.orgId }).from(subquery);

    return result.map((r) => r.orgId);
  }

  describe('buildUserAccessibleOrgIdsQuery', () => {
    describe('ancestor access (all roles)', () => {
      it('student in school sees school and parent district', async () => {
        const ids = await getAccessibleOrgIds(baseFixture.schoolAStudent.id, [UserRole.STUDENT]);

        // Student in School A should see:
        // - schoolA (own org)
        // - district (parent org)
        expect(ids).toContain(baseFixture.schoolA.id);
        expect(ids).toContain(baseFixture.district.id);

        // Should NOT see:
        // - schoolB (sibling org)
        // - districtB (different branch)
        expect(ids).not.toContain(baseFixture.schoolB.id);
        expect(ids).not.toContain(baseFixture.districtB.id);
      });

      it('student in class sees class school and parent district via class membership', async () => {
        const ids = await getAccessibleOrgIds(baseFixture.classAStudent.id, [UserRole.STUDENT]);

        // Student in classInSchoolA should see:
        // - schoolA (class's org)
        // - district (parent org of school)
        expect(ids).toContain(baseFixture.schoolA.id);
        expect(ids).toContain(baseFixture.district.id);

        // Should NOT see:
        // - schoolB (different school)
        // - districtB (different branch)
        expect(ids).not.toContain(baseFixture.schoolB.id);
        expect(ids).not.toContain(baseFixture.districtB.id);
      });

      it('student in district sees only the district (no descendants)', async () => {
        const ids = await getAccessibleOrgIds(baseFixture.districtBStudent.id, [UserRole.STUDENT]);

        // Student in District B should see only the district (no descendant access for non-supervisory)
        expect(ids).toContain(baseFixture.districtB.id);

        // Should NOT see descendant orgs (student is non-supervisory)
        expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
      });
    });

    describe('descendant access (supervisory roles)', () => {
      it('teacher in school sees school and parent district', async () => {
        const ids = await getAccessibleOrgIds(baseFixture.schoolATeacher.id, [UserRole.TEACHER]);

        // Teacher in School A should see:
        // - schoolA (own org)
        // - district (parent org)
        expect(ids).toContain(baseFixture.schoolA.id);
        expect(ids).toContain(baseFixture.district.id);

        // Teacher at school level doesn't have descendant orgs (no children in org hierarchy)
        // But still shouldn't see sibling or other branches
        expect(ids).not.toContain(baseFixture.schoolB.id);
        expect(ids).not.toContain(baseFixture.districtB.id);
      });

      it('administrator in district sees district and all descendant schools', async () => {
        const ids = await getAccessibleOrgIds(baseFixture.districtAdmin.id, [UserRole.ADMINISTRATOR]);

        // Administrator in District should see:
        // - district (own org)
        // - schoolA (descendant org)
        // - schoolB (descendant org)
        expect(ids).toContain(baseFixture.district.id);
        expect(ids).toContain(baseFixture.schoolA.id);
        expect(ids).toContain(baseFixture.schoolB.id);

        // Should NOT see:
        // - districtB (different branch)
        expect(ids).not.toContain(baseFixture.districtB.id);
        expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
      });
    });

    describe('no access scenarios', () => {
      it('user with no memberships sees no orgs', async () => {
        const ids = await getAccessibleOrgIds(baseFixture.unassignedUser.id, [UserRole.STUDENT]);

        expect(ids).toHaveLength(0);
      });

      it('user in one branch cannot see orgs in another branch', async () => {
        // Student in District B
        const ids = await getAccessibleOrgIds(baseFixture.districtBStudent.id, [UserRole.STUDENT]);

        // Should see District B
        expect(ids).toContain(baseFixture.districtB.id);

        // Should NOT see any District A orgs
        expect(ids).not.toContain(baseFixture.district.id);
        expect(ids).not.toContain(baseFixture.schoolA.id);
        expect(ids).not.toContain(baseFixture.schoolB.id);
      });

      it('non-matching role returns no results', async () => {
        // Teacher in School A, but query with student role (they don't have student membership)
        const ids = await getAccessibleOrgIds(baseFixture.schoolATeacher.id, [UserRole.STUDENT]);

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
        const ids = await getAccessibleOrgIds(multiRoleUser.id, [UserRole.TEACHER, UserRole.STUDENT]);

        // Should see through student class membership in classInSchoolA:
        // - schoolA, district (ancestors of class)
        expect(ids).toContain(baseFixture.schoolA.id);
        expect(ids).toContain(baseFixture.district.id);

        // Should also see through teacher membership in School B:
        // - schoolB (own org)
        // - district (ancestor)
        expect(ids).toContain(baseFixture.schoolB.id);
      });
    });

    describe('validation', () => {
      it('throws error for empty userId', async () => {
        await expect(async () => {
          accessControls.buildUserAccessibleOrgIdsQuery({ userId: '', allowedRoles: [UserRole.STUDENT] });
        }).rejects.toThrow();
      });

      it('throws error for empty allowedRoles', async () => {
        await expect(async () => {
          accessControls.buildUserAccessibleOrgIdsQuery({ userId: 'some-user-id', allowedRoles: [] });
        }).rejects.toThrow();
      });
    });

    describe('enrollment date boundaries', () => {
      it('excludes user with future enrollment start date (org membership)', async () => {
        // futureEnrollmentStudent has enrollment starting 7 days from now at School A
        const ids = await getAccessibleOrgIds(baseFixture.futureEnrollmentStudent.id, [UserRole.STUDENT]);

        // User's enrollment hasn't started yet, so they shouldn't see any orgs
        expect(ids).not.toContain(baseFixture.schoolA.id);
        expect(ids).not.toContain(baseFixture.district.id);
        expect(ids).toHaveLength(0);
      });

      it('excludes user with expired enrollment (org membership)', async () => {
        // expiredEnrollmentStudent has enrollment that ended 7 days ago at School A
        const ids = await getAccessibleOrgIds(baseFixture.expiredEnrollmentStudent.id, [UserRole.STUDENT]);

        // User's enrollment has ended, so they shouldn't see any orgs
        expect(ids).not.toContain(baseFixture.schoolA.id);
        expect(ids).not.toContain(baseFixture.district.id);
        expect(ids).toHaveLength(0);
      });

      it('includes user with active enrollment (null enrollmentEnd)', async () => {
        // schoolAStudent has active enrollment (default: enrollmentStart=now, enrollmentEnd=null)
        const ids = await getAccessibleOrgIds(baseFixture.schoolAStudent.id, [UserRole.STUDENT]);

        // User has active enrollment, so they should see orgs
        expect(ids).toContain(baseFixture.schoolA.id);
        expect(ids).toContain(baseFixture.district.id);
      });

      it('excludes user with expired enrollment (class membership)', async () => {
        // expiredClassStudent has enrollment that ended 7 days ago in classInSchoolA
        const ids = await getAccessibleOrgIds(baseFixture.expiredClassStudent.id, [UserRole.STUDENT]);

        // User's enrollment has ended
        expect(ids).not.toContain(baseFixture.schoolA.id);
        expect(ids).not.toContain(baseFixture.district.id);
        expect(ids).toHaveLength(0);
      });

      it('includes user with active enrollment (class membership)', async () => {
        // classAStudent has active enrollment in classInSchoolA
        const ids = await getAccessibleOrgIds(baseFixture.classAStudent.id, [UserRole.STUDENT]);

        // User has active enrollment, so they should see orgs in class's ancestry
        expect(ids).toContain(baseFixture.schoolA.id);
        expect(ids).toContain(baseFixture.district.id);
      });
    });
  });
});
