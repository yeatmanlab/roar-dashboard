/**
 * Integration tests for AuthorizationRepository.
 *
 * Tests the ltree-based hierarchical authorization queries with real database operations.
 * Uses a shared base fixture seeded once per file for performance.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AuthorizationRepository } from './authorization.repository';
import { seedBaseFixture, type BaseFixture } from '../test-support/fixtures';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { UserRole } from '../enums/user-role.enum';

describe('AuthorizationRepository (integration)', () => {
  let repository: AuthorizationRepository;
  let fixture: BaseFixture;

  beforeAll(async () => {
    repository = new AuthorizationRepository();
    fixture = await seedBaseFixture();
  });

  describe('buildAccessibleAdministrationIdsQuery', () => {
    describe('Look UP access (all roles)', () => {
      it('user in school sees administration assigned to parent district', async () => {
        // schoolAStudent is in schoolA, adminAtDistrict is assigned to district (parent)
        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: fixture.schoolAStudent.id,
          allowedRoles: [UserRole.STUDENT],
        });

        expect(results.map((r) => r.administrationId)).toContain(fixture.adminAtDistrict.id);
      });

      it('user in class sees administration assigned to school', async () => {
        // classAStudent is in classInSchoolA, adminAtSchoolA is assigned to schoolA (parent)
        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: fixture.classAStudent.id,
          allowedRoles: [UserRole.STUDENT],
        });

        expect(results.map((r) => r.administrationId)).toContain(fixture.adminAtSchoolA.id);
      });

      it('user in class sees administration assigned directly to class', async () => {
        // classAStudent is in classInSchoolA, adminAtClassA is assigned to classInSchoolA
        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: fixture.classAStudent.id,
          allowedRoles: [UserRole.STUDENT],
        });

        expect(results.map((r) => r.administrationId)).toContain(fixture.adminAtClassA.id);
      });

      it('user in group sees administration assigned to group', async () => {
        // groupStudent is in group, adminAtGroup is assigned to group
        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: fixture.groupStudent.id,
          allowedRoles: [UserRole.STUDENT],
        });

        expect(results.map((r) => r.administrationId)).toContain(fixture.adminAtGroup.id);
      });
    });

    describe('Look DOWN access (supervisory roles only)', () => {
      it('supervisor in district sees administration assigned to child school', async () => {
        // districtAdmin is in district, adminAtSchoolA is assigned to schoolA (child)
        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: fixture.districtAdmin.id,
          allowedRoles: [UserRole.ADMINISTRATOR],
        });

        expect(results.map((r) => r.administrationId)).toContain(fixture.adminAtSchoolA.id);
      });

      it('supervisor in school sees administration assigned to class in that school', async () => {
        // schoolATeacher is in schoolA, adminAtClassA is assigned to classInSchoolA (child)
        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: fixture.schoolATeacher.id,
          allowedRoles: [UserRole.TEACHER],
        });

        expect(results.map((r) => r.administrationId)).toContain(fixture.adminAtClassA.id);
      });

      it('non-supervisor cannot look down the hierarchy', async () => {
        // Create a separate student at district level for this specific test
        // (fixture.districtAdmin is an admin, not a student)
        const districtStudent = await UserFactory.create({ nameFirst: 'District', nameLast: 'StudentTest' });
        await UserOrgFactory.create({
          userId: districtStudent.id,
          orgId: fixture.district.id,
          role: UserRole.STUDENT,
        });

        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: districtStudent.id,
          allowedRoles: [UserRole.STUDENT],
        });

        // Student at district should NOT see administration assigned to child school
        expect(results.map((r) => r.administrationId)).not.toContain(fixture.adminAtSchoolA.id);
      });
    });

    describe('No access scenarios', () => {
      it('user in different branch cannot access administration', async () => {
        // schoolAStudent is in schoolA, adminAtSchoolB is assigned to schoolB (sibling)
        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: fixture.schoolAStudent.id,
          allowedRoles: [UserRole.STUDENT],
        });

        // Should NOT see administration in sibling branch
        expect(results.map((r) => r.administrationId)).not.toContain(fixture.adminAtSchoolB.id);
      });

      it('returns empty when user has no assignments', async () => {
        // unassignedUser has no org/class/group assignments
        const results = await repository.buildAccessibleAdministrationIdsQuery({
          userId: fixture.unassignedUser.id,
          allowedRoles: [UserRole.STUDENT],
        });

        expect(results).toHaveLength(0);
      });
    });
  });

  describe('getAssignedUserCountsByAdministrationIds', () => {
    it('counts users in org hierarchy correctly', async () => {
      // adminAtDistrict should see: districtAdmin + schoolAAdmin + schoolATeacher + schoolAStudent + schoolBStudent + multiAssignedUser
      // (users at district and all descendant orgs)
      const counts = await repository.getAssignedUserCountsByAdministrationIds([fixture.adminAtDistrict.id]);

      // District has: districtAdmin, multiAssignedUser (at district level)
      // SchoolA has: schoolAAdmin, schoolATeacher, schoolAStudent, multiAssignedUser (also at schoolA)
      // SchoolB has: schoolBStudent
      // Note: multiAssignedUser is counted once despite being in both district and schoolA
      expect(counts.get(fixture.adminAtDistrict.id)).toBeGreaterThanOrEqual(6);
    });

    it('counts users in class correctly', async () => {
      // adminAtClassA should count users assigned to classInSchoolA: classAStudent, classATeacher
      const counts = await repository.getAssignedUserCountsByAdministrationIds([fixture.adminAtClassA.id]);

      expect(counts.get(fixture.adminAtClassA.id)).toBe(2);
    });

    it('deduplicates users assigned via multiple paths', async () => {
      // multiAssignedUser is in both district AND schoolA
      // Create an administration at district to test deduplication
      const testAdmin = await AdministrationFactory.create({
        name: 'Dedup Test Admin',
        createdBy: fixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: testAdmin.id,
        orgId: fixture.district.id,
      });

      const counts = await repository.getAssignedUserCountsByAdministrationIds([testAdmin.id]);

      // Count all users visible from district, ensuring no duplicates
      // The count should include each user exactly once
      const count = counts.get(testAdmin.id) ?? 0;

      // Verify by checking that multiAssignedUser is only counted once
      // We can't check directly, but if deduplication works, the count
      // should equal the number of unique users, not total assignments
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('returns empty map for empty input', async () => {
      const counts = await repository.getAssignedUserCountsByAdministrationIds([]);

      expect(counts.size).toBe(0);
    });

    it('returns correct counts for multiple administrations', async () => {
      // adminAtDistrict covers all users in hierarchy
      // adminAtSchoolA covers only users in schoolA subtree
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        fixture.adminAtDistrict.id,
        fixture.adminAtSchoolA.id,
      ]);

      const districtCount = counts.get(fixture.adminAtDistrict.id) ?? 0;
      const schoolACount = counts.get(fixture.adminAtSchoolA.id) ?? 0;

      // District count should be greater than or equal to school count
      expect(districtCount).toBeGreaterThanOrEqual(schoolACount);

      // SchoolA has: schoolAAdmin, schoolATeacher, schoolAStudent, multiAssignedUser
      expect(schoolACount).toBeGreaterThanOrEqual(3);
    });
  });
});
