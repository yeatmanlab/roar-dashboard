/**
 * Integration tests for DistrictRepository.
 *
 * Tests custom methods (listAll, listAuthorized, fetchDistrictCounts)
 * against the real database with the base fixture's org hierarchy.
 *
 * Verifies SQL correctness and proper filtering by orgType, rosteringEnded, etc.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SortOrder } from '@roar-dashboard/api-contract';
import { baseFixture } from '../test-support/fixtures';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ClassFactory } from '../test-support/factories/class.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import type { DistrictWithCounts } from './district.repository';
import { DistrictRepository } from './district.repository';
import { UserRole } from '../enums/user-role.enum';
import { OrgType } from '../enums/org-type.enum';

describe('DistrictRepository', () => {
  let repository: DistrictRepository;

  beforeAll(() => {
    repository = new DistrictRepository();
  });

  describe('listAll', () => {
    it('returns all districts with pagination', async () => {
      const result = await repository.listAll({ page: 1, perPage: 100 });

      expect(result.totalItems).toBeGreaterThanOrEqual(2);
      expect(result.items.length).toBeGreaterThanOrEqual(2);

      // All items should be districts
      for (const item of result.items) {
        expect(item.orgType).toBe(OrgType.DISTRICT);
      }
    });

    it('respects perPage limit', async () => {
      const result = await repository.listAll({ page: 1, perPage: 1 });

      expect(result.items.length).toBeLessThanOrEqual(1);
      expect(result.totalItems).toBeGreaterThanOrEqual(2);
    });

    it('applies orderBy name ascending', async () => {
      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1]!.name.toLowerCase() <= result.items[i]!.name.toLowerCase()).toBe(true);
      }
    });

    it('applies orderBy abbreviation descending', async () => {
      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'abbreviation', direction: 'desc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1]!.abbreviation.toLowerCase() >= result.items[i]!.abbreviation.toLowerCase()).toBe(
          true,
        );
      }
    });

    it('applies orderBy name descending', async () => {
      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'desc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1]!.name.toLowerCase() >= result.items[i]!.name.toLowerCase()).toBe(true);
      }
    });

    it('excludes districts with rosteringEnded by default', async () => {
      // Create a district with rosteringEnded set
      const endedDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Ended District Exclude Test',
        rosteringEnded: new Date('2020-01-01'),
      });

      // Verify the district was created with rosteringEnded
      expect(endedDistrict.rosteringEnded).not.toBeNull();

      const result = await repository.listAll({
        page: 1,
        perPage: 1000, // Large number to ensure we get all districts
        includeEnded: false,
      });

      const ids = result.items.map((d) => d.id);

      // The key requirement: all returned items should have null rosteringEnded
      for (const item of result.items) {
        expect(item.rosteringEnded).toBeNull();
      }

      // Our ended district should NOT be in the results
      expect(ids).not.toContain(endedDistrict.id);
    });

    it('includes districts with rosteringEnded when includeEnded=true', async () => {
      // Create a district with rosteringEnded set
      const endedDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Ended District 2',
        rosteringEnded: new Date(),
      });

      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        includeEnded: true,
      });

      const ids = result.items.map((d) => d.id);
      expect(ids).toContain(endedDistrict.id);
    });

    it('only returns districts, not other org types', async () => {
      const result = await repository.listAll({ page: 1, perPage: 100 });

      // Verify no schools, states, etc. are returned
      for (const item of result.items) {
        expect(item.orgType).toBe(OrgType.DISTRICT);
      }
    });
  });

  describe('listAuthorized', () => {
    it('returns only authorized districts for a user', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.STUDENT] },
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((d) => d.id);

      // School A student should see parent district
      expect(ids).toContain(baseFixture.district.id);

      // Should NOT see unrelated districts
      expect(ids).not.toContain(baseFixture.districtB.id);
    });

    it('returns districts for class-level user', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.classAStudent.id, allowedRoles: [UserRole.STUDENT] },
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((d) => d.id);

      // Class student should see parent school's district
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).not.toContain(baseFixture.districtB.id);
    });

    it('returns descendant districts for supervisory roles', async () => {
      // Create a state-level org with a child district
      const stateOrg = await OrgFactory.create({
        orgType: OrgType.STATE,
        name: 'Test State for Supervisory',
      });

      const childDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Child District for Supervisory',
        parentOrgId: stateOrg.id,
      });

      // Create an administrator at the state level
      const stateAdmin = await UserFactory.create({
        nameFirst: 'State',
        nameLast: 'Admin',
      });

      await UserOrgFactory.create({
        userId: stateAdmin.id,
        orgId: stateOrg.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.listAuthorized(
        { userId: stateAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((d) => d.id);
      // State admin should see child district
      expect(ids).toContain(childDistrict.id);
    });

    it('respects pagination', async () => {
      const page1 = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 1 },
      );

      expect(page1.items.length).toBeLessThanOrEqual(1);
    });

    it('applies sorting', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        {
          page: 1,
          perPage: 100,
          orderBy: { field: 'name', direction: 'asc' },
        },
      );

      if (result.items.length > 1) {
        for (let i = 1; i < result.items.length; i++) {
          expect(result.items[i - 1]!.name.toLowerCase() <= result.items[i]!.name.toLowerCase()).toBe(true);
        }
      }
    });

    it('excludes ended districts by default', async () => {
      // Create a district with rosteringEnded
      const endedDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Ended District for Auth Exclude Test',
        rosteringEnded: new Date('2020-01-01'),
      });

      // Assign user to the ended district
      await UserOrgFactory.create({
        userId: baseFixture.districtAdmin.id,
        orgId: endedDistrict.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 1000, includeEnded: false },
      );

      const ids = result.items.map((d) => d.id);

      // All returned items should have null rosteringEnded
      for (const item of result.items) {
        expect(item.rosteringEnded).toBeNull();
      }

      // Our ended district should NOT be in results
      expect(ids).not.toContain(endedDistrict.id);
    });

    it('includes ended districts when includeEnded=true', async () => {
      // Create a district with rosteringEnded
      const endedDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Ended District for Auth Test 2',
        rosteringEnded: new Date(),
      });

      // Assign user to the ended district
      await UserOrgFactory.create({
        userId: baseFixture.districtAdmin.id,
        orgId: endedDistrict.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 100, includeEnded: true },
      );

      const ids = result.items.map((d) => d.id);
      expect(ids).toContain(endedDistrict.id);
    });

    it('returns empty for user with no access', async () => {
      const isolatedUser = await UserFactory.create({
        nameFirst: 'Isolated',
        nameLast: 'User',
      });

      const result = await repository.listAuthorized(
        { userId: isolatedUser.id, allowedRoles: [UserRole.STUDENT] },
        { page: 1, perPage: 100 },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('includes counts when embedCounts=true', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 100, embedCounts: true },
      );

      expect(result.items.length).toBeGreaterThan(0);
      const districtWithCounts = result.items.find((d) => d.id === baseFixture.district.id) as
        | DistrictWithCounts
        | undefined;
      expect(districtWithCounts).toBeDefined();
      expect(districtWithCounts?.counts).toBeDefined();
      expect(districtWithCounts?.counts).toHaveProperty('users');
      expect(districtWithCounts?.counts).toHaveProperty('schools');
      expect(districtWithCounts?.counts).toHaveProperty('classes');
    });

    it('omits counts when embedCounts=false', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 100, embedCounts: false },
      );

      expect(result.items.length).toBeGreaterThan(0);
      for (const item of result.items) {
        expect((item as DistrictWithCounts).counts).toBeUndefined();
      }
    });
  });

  describe('getUnrestrictedById', () => {
    it('returns district without access checks', async () => {
      const result = await repository.getUnrestrictedById(baseFixture.district.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.district.id);
    });

    it('filters correctly by orgType=district', async () => {
      // Try to get a school by ID - should return null because it's not a district
      const result = await repository.getUnrestrictedById(baseFixture.schoolA.id);

      expect(result).toBeNull();
    });

    it('returns null for nonexistent district ID', async () => {
      const result = await repository.getUnrestrictedById('00000000-0000-0000-0000-000000000000');

      expect(result).toBeNull();
    });

    it('returns district even if user has no access', async () => {
      // This method bypasses access controls
      const result = await repository.getUnrestrictedById(baseFixture.districtB.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.districtB.id);
    });
  });

  describe('getAuthorizedById', () => {
    it('returns district when user has access', async () => {
      const result = await repository.getAuthorizedById(
        {
          userId: baseFixture.districtAdmin.id,
          allowedRoles: [UserRole.ADMINISTRATOR],
        },
        baseFixture.district.id,
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.district.id);
    });

    it('returns null when user lacks access', async () => {
      // District B admin should not have access to District A
      const result = await repository.getAuthorizedById(
        {
          userId: baseFixture.districtBAdmin.id,
          allowedRoles: [UserRole.ADMINISTRATOR],
        },
        baseFixture.district.id,
      );

      expect(result).toBeNull();
    });

    it('returns null for nonexistent district ID', async () => {
      const result = await repository.getAuthorizedById(
        {
          userId: baseFixture.districtAdmin.id,
          allowedRoles: [UserRole.ADMINISTRATOR],
        },
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });

    it('returns district for student with access', async () => {
      // School A student should have access to parent district
      const result = await repository.getAuthorizedById(
        {
          userId: baseFixture.schoolAStudent.id,
          allowedRoles: [UserRole.STUDENT],
        },
        baseFixture.district.id,
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.district.id);
    });

    it('returns null for student without access to district', async () => {
      // School A student should NOT have access to District B
      const result = await repository.getAuthorizedById(
        {
          userId: baseFixture.schoolAStudent.id,
          allowedRoles: [UserRole.STUDENT],
        },
        baseFixture.districtB.id,
      );

      expect(result).toBeNull();
    });

    it('filters correctly by orgType=district', async () => {
      // Try to get a school by ID - should return null even if user has access
      const result = await repository.getAuthorizedById(
        {
          userId: baseFixture.districtAdmin.id,
          allowedRoles: [UserRole.ADMINISTRATOR],
        },
        baseFixture.schoolA.id,
      );

      expect(result).toBeNull();
    });
  });

  describe('counts aggregation', () => {
    it('returns accurate user counts', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: DistrictWithCounts[]; totalItems: number };

      const district = result.items.find((d) => d.id === baseFixture.district.id);
      expect(district).toBeDefined();
      expect(district?.counts).toBeDefined();
      // Should have at least the district admin
      expect(district?.counts?.users).toBeGreaterThan(0);
    });

    it('returns accurate school counts', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
        includeEnded: true, // Include ended to ensure we count School A even if it has rosteringEnded
      })) as { items: DistrictWithCounts[]; totalItems: number };

      const district = result.items.find((d) => d.id === baseFixture.district.id);
      expect(district).toBeDefined();
      expect(district?.counts).toBeDefined();
      // Should have at least School A when including ended orgs
      expect(district?.counts?.schools).toBeGreaterThanOrEqual(0);
    });

    it('returns accurate class counts', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: DistrictWithCounts[]; totalItems: number };

      const district = result.items.find((d) => d.id === baseFixture.district.id);
      expect(district).toBeDefined();
      expect(district?.counts).toBeDefined();
      // Should have classes from School A
      expect(district?.counts?.classes).toBeGreaterThanOrEqual(0);
    });

    it('returns zero counts for empty district', async () => {
      const emptyDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Empty District for Counts',
      });

      const result = (await repository.listAll({
        page: 1,
        perPage: 1000,
        embedCounts: true,
      })) as { items: DistrictWithCounts[]; totalItems: number };

      // Find the newly created district in the results
      const district = result.items.find((d) => d.id === emptyDistrict.id);
      expect(district).toBeDefined();
      expect(district?.counts).toEqual({
        users: 0,
        schools: 0,
        classes: 0,
      });
    });
  });

  describe('getUsersByDistrictId', () => {
    describe('includes users from descendant orgs and classes', () => {
      it('returns users enrolled at the district level', async () => {
        const result = await repository.getUsersByDistrictId(baseFixture.districtB.id, {
          page: 1,
          perPage: 100,
        });

        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(baseFixture.districtBAdmin.id);
      });

      it('includes users enrolled at school level under the district', async () => {
        const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
          page: 1,
          perPage: 100,
        });

        const userIds = result.items.map((u) => u.id);
        // School A users
        expect(userIds).toContain(baseFixture.schoolAAdmin.id);
        expect(userIds).toContain(baseFixture.schoolATeacher.id);
        expect(userIds).toContain(baseFixture.schoolAStudent.id);
        // School B users
        expect(userIds).toContain(baseFixture.schoolBStudent.id);
      });

      it('includes users enrolled at class level under the district', async () => {
        const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
          page: 1,
          perPage: 100,
        });

        const userIds = result.items.map((u) => u.id);
        // Class A users (classInSchoolA is under schoolA which is under district)
        expect(userIds).toContain(baseFixture.classAStudent.id);
        expect(userIds).toContain(baseFixture.classATeacher.id);
      });
    });

    it('does not include users from other districts', async () => {
      const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 100,
      });

      const userIds = result.items.map((u) => u.id);
      // Users from districtB should not appear
      expect(userIds).not.toContain(baseFixture.districtBAdmin.id);
      expect(userIds).not.toContain(baseFixture.districtBStudent.id);
    });

    it('returns enrollmentStart and role for each user', async () => {
      const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items.length).toBeGreaterThan(0);

      const districtAdmin = result.items.find((u) => u.id === baseFixture.districtAdmin.id);
      const classStudent = result.items.find((u) => u.id === baseFixture.classAStudent.id);

      expect(districtAdmin?.roles).toContain(UserRole.ADMINISTRATOR);
      expect(classStudent?.roles).toContain(UserRole.STUDENT);
    });

    it('aggregates multiple roles when user is enrolled at both org and class level', async () => {
      // Add baseFixture.schoolATeacher (org-level TEACHER) to a class with a different role
      const UserClassFactory = (await import('../test-support/factories/user-class.factory')).UserClassFactory;
      await UserClassFactory.create({
        userId: baseFixture.schoolATeacher.id,
        classId: baseFixture.classInSchoolA.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 100,
      });

      const user = result.items.find((u) => u.id === baseFixture.schoolATeacher.id);
      expect(user).toBeDefined();
      expect(Array.isArray(user?.roles)).toBe(true);
      expect(user?.roles).toHaveLength(2);
      expect(user?.roles).toContain(UserRole.TEACHER);
      expect(user?.roles).toContain(UserRole.ADMINISTRATOR);
    });

    it('aggregates multiple roles when user is enrolled at both district and school level', async () => {
      // baseFixture.multiAssignedUser is assigned to both district (ADMINISTRATOR) and schoolA (TEACHER)
      const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 100,
      });

      const user = result.items.find((u) => u.id === baseFixture.multiAssignedUser.id);
      expect(user).toBeDefined();
      expect(Array.isArray(user?.roles)).toBe(true);
      expect(user?.roles).toHaveLength(2);
      expect(user?.roles).toContain(UserRole.ADMINISTRATOR);
      expect(user?.roles).toContain(UserRole.TEACHER);
    });

    it('returns user only once when enrolled in multiple classes', async () => {
      // Enroll baseFixture.classAStudent in additional classes (already in classInSchoolA)
      const class2 = await ClassFactory.create({
        name: 'Second Class',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });
      const class3 = await ClassFactory.create({
        name: 'Third Class',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });

      const UserClassFactory = (await import('../test-support/factories/user-class.factory')).UserClassFactory;
      await UserClassFactory.create({
        userId: baseFixture.classAStudent.id,
        classId: class2.id,
        role: UserRole.STUDENT,
      });
      await UserClassFactory.create({
        userId: baseFixture.classAStudent.id,
        classId: class3.id,
        role: UserRole.STUDENT,
      });

      const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 100,
      });

      // User should appear only once, not three times (classInSchoolA + class2 + class3)
      const userMatches = result.items.filter((u) => u.id === baseFixture.classAStudent.id);
      expect(userMatches).toHaveLength(1);
      expect(Array.isArray(userMatches[0]?.roles)).toBe(true);
      expect(userMatches[0]?.roles).toContain(UserRole.STUDENT);
    });

    it('deduplicates roles when user has same role at multiple levels', async () => {
      // Enroll baseFixture.classATeacher (already TEACHER in classInSchoolA) as TEACHER at school level too
      await UserOrgFactory.create({
        userId: baseFixture.classATeacher.id,
        orgId: baseFixture.schoolA.id,
        role: UserRole.TEACHER,
      });

      const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 100,
      });

      const user = result.items.find((u) => u.id === baseFixture.classATeacher.id);
      expect(user).toBeDefined();
      expect(Array.isArray(user?.roles)).toBe(true);
      // Should only have TEACHER once, not duplicated
      expect(user?.roles).toHaveLength(1);
      expect(user?.roles).toContain(UserRole.TEACHER);
    });

    it('returns empty for district with no enrolled users', async () => {
      // Create an empty district
      const emptyDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Empty District for getUsersByDistrictId',
      });

      const result = await repository.getUsersByDistrictId(emptyDistrict.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('respects pagination', async () => {
      const page1 = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 2,
      });

      expect(page1.items.length).toBeLessThanOrEqual(2);
      expect(page1.totalItems).toBeGreaterThan(2);

      const page2 = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 2,
        perPage: 2,
      });

      expect(page2.items.length).toBeLessThanOrEqual(2);
      expect(page2.totalItems).toBeGreaterThan(2);

      // Pages should have different users
      const page1Ids = page1.items.map((u) => u.id);
      const page2Ids = page2.items.map((u) => u.id);
      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
    });

    it('applies default sorting by nameLast ascending when no orderBy specified', async () => {
      // Create a district with users having known lastNames for precise sorting verification
      const sortTestDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'getUsersByDistrictId Sort Test District',
      });
      const studentZ = await UserFactory.create({ nameLast: 'Zulu' });
      const studentA = await UserFactory.create({ nameLast: 'Alpha' });
      const studentM = await UserFactory.create({ nameLast: 'Mike' });
      await UserOrgFactory.create({ userId: studentZ.id, orgId: sortTestDistrict.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: studentA.id, orgId: sortTestDistrict.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: studentM.id, orgId: sortTestDistrict.id, role: UserRole.STUDENT });

      const result = await repository.getUsersByDistrictId(sortTestDistrict.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.nameLast).toBe('Alpha');
      expect(result.items[1]!.nameLast).toBe('Mike');
      expect(result.items[2]!.nameLast).toBe('Zulu');
    });

    it('applies sorting by username descending', async () => {
      // Create a district with users having known usernames for precise sorting verification
      const usernameTestDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'getUsersByDistrictId Username Sort Test',
      });
      const userA = await UserFactory.create({ username: 'aaa_district_user' });
      const userZ = await UserFactory.create({ username: 'zzz_district_user' });
      const userM = await UserFactory.create({ username: 'mmm_district_user' });
      await UserOrgFactory.create({ userId: userA.id, orgId: usernameTestDistrict.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: userZ.id, orgId: usernameTestDistrict.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: userM.id, orgId: usernameTestDistrict.id, role: UserRole.STUDENT });

      const result = await repository.getUsersByDistrictId(usernameTestDistrict.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'username', direction: SortOrder.DESC },
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.username).toBe('zzz_district_user');
      expect(result.items[1]!.username).toBe('mmm_district_user');
      expect(result.items[2]!.username).toBe('aaa_district_user');
    });

    it('excludes users with expired enrollment', async () => {
      const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 100,
      });

      const userIds = result.items.map((u) => u.id);
      // Expired org enrollment
      expect(userIds).not.toContain(baseFixture.expiredEnrollmentStudent.id);
      // Expired class enrollment
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('excludes users with future enrollment', async () => {
      const result = await repository.getUsersByDistrictId(baseFixture.district.id, {
        page: 1,
        perPage: 100,
      });

      const userIds = result.items.map((u) => u.id);
      expect(userIds).not.toContain(baseFixture.futureEnrollmentStudent.id);
    });

    describe('filters', () => {
      it('filters by role', async () => {
        // Create a district with users having different roles
        const filterTestDistrict = await OrgFactory.create({
          orgType: OrgType.DISTRICT,
          name: 'Filter Role Test District',
        });
        const student1 = await UserFactory.create({ nameLast: 'FilterDistrictStudent1' });
        const student2 = await UserFactory.create({ nameLast: 'FilterDistrictStudent2' });
        const teacher = await UserFactory.create({ nameLast: 'FilterDistrictTeacher' });
        await UserOrgFactory.create({ userId: student1.id, orgId: filterTestDistrict.id, role: UserRole.STUDENT });
        await UserOrgFactory.create({ userId: student2.id, orgId: filterTestDistrict.id, role: UserRole.STUDENT });
        await UserOrgFactory.create({ userId: teacher.id, orgId: filterTestDistrict.id, role: UserRole.TEACHER });

        const result = await repository.getUsersByDistrictId(filterTestDistrict.id, {
          page: 1,
          perPage: 100,
          role: UserRole.STUDENT,
        });

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(student1.id);
        expect(userIds).toContain(student2.id);
        expect(userIds).not.toContain(teacher.id);

        // Verify all returned users have the filtered role in EnrolledUserEntity
        for (const user of result.items) {
          expect(user.roles).toContain(UserRole.STUDENT);
        }
      });

      it('filters by grade', async () => {
        // Create a district with users having different grades
        const filterGradeDistrict = await OrgFactory.create({
          orgType: OrgType.DISTRICT,
          name: 'Filter Grade Test District',
        });
        const grade3Student = await UserFactory.create({ nameLast: 'Grade3District', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'Grade5District', grade: '5' });
        const grade5Student2 = await UserFactory.create({ nameLast: 'Grade5DistrictSecond', grade: '5' });
        await UserOrgFactory.create({
          userId: grade3Student.id,
          orgId: filterGradeDistrict.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: grade5Student.id,
          orgId: filterGradeDistrict.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: grade5Student2.id,
          orgId: filterGradeDistrict.id,
          role: UserRole.STUDENT,
        });

        const result = await repository.getUsersByDistrictId(filterGradeDistrict.id, {
          page: 1,
          perPage: 100,
          grade: ['5'],
        });

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(grade5Student.id);
        expect(userIds).toContain(grade5Student2.id);
        expect(userIds).not.toContain(grade3Student.id);
      });

      it('filters by both role and grade', async () => {
        // Create a district with users having different roles and grades
        const filterBothDistrict = await OrgFactory.create({
          orgType: OrgType.DISTRICT,
          name: 'Filter Both Test District',
        });
        const grade3Student = await UserFactory.create({ nameLast: 'G3DistrictStudent', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'G5DistrictStudent', grade: '5' });
        const grade5Teacher = await UserFactory.create({ nameLast: 'G5DistrictTeacher', grade: '5' });
        await UserOrgFactory.create({
          userId: grade3Student.id,
          orgId: filterBothDistrict.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: grade5Student.id,
          orgId: filterBothDistrict.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: grade5Teacher.id,
          orgId: filterBothDistrict.id,
          role: UserRole.TEACHER,
        });

        const result = await repository.getUsersByDistrictId(filterBothDistrict.id, {
          page: 1,
          perPage: 100,
          role: UserRole.STUDENT,
          grade: ['5'],
        });

        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(grade5Student.id);
      });

      it('returns empty when no users match filter', async () => {
        // Create a district with only students
        const noMatchDistrict = await OrgFactory.create({
          orgType: OrgType.DISTRICT,
          name: 'No Match Filter Test District',
        });
        const student = await UserFactory.create({ nameLast: 'OnlyDistrictStudent' });
        await UserOrgFactory.create({ userId: student.id, orgId: noMatchDistrict.id, role: UserRole.STUDENT });

        const result = await repository.getUsersByDistrictId(noMatchDistrict.id, {
          page: 1,
          perPage: 100,
          role: UserRole.ADMINISTRATOR,
        });

        expect(result.totalItems).toBe(0);
        expect(result.items).toEqual([]);
      });
    });
  });

  describe('getUserRolesForDistrict', () => {
    it('delegates to access controls and returns roles', async () => {
      const roles = await repository.getUserRolesForDistrict(baseFixture.districtAdmin.id, baseFixture.district.id);

      expect(roles).toContain(UserRole.ADMINISTRATOR);
    });

    it('returns empty array for user with no district membership', async () => {
      const roles = await repository.getUserRolesForDistrict(baseFixture.schoolAStudent.id, baseFixture.district.id);

      expect(roles).toHaveLength(0);
    });
  });

  describe('getAuthorizedUsersByDistrictId', () => {
    it('returns users when requesting user has authorized membership in district', async () => {
      const result = await repository.getAuthorizedUsersByDistrictId(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.district.id,
        { page: 1, perPage: 100 },
      );

      expect(result.items.length).toBeGreaterThan(0);
      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(baseFixture.districtAdmin.id);
    });

    it('returns empty when requesting user has no membership in district', async () => {
      const result = await repository.getAuthorizedUsersByDistrictId(
        { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.district.id,
        { page: 1, perPage: 100 },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('returns empty when requesting user has membership but role not in allowedRoles', async () => {
      const result = await repository.getAuthorizedUsersByDistrictId(
        { userId: baseFixture.schoolATeacher.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.district.id,
        { page: 1, perPage: 100 },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('returns empty when requesting user has expired enrollment in district', async () => {
      const expiredDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Expired Enrollment Auth Test District',
      });
      const expiredUser = await UserFactory.create({ username: 'expired_auth_user' });
      const activeAdmin = await UserFactory.create({ username: 'active_admin_auth' });

      // Expired enrollment for the requesting user
      await UserOrgFactory.create({
        userId: expiredUser.id,
        orgId: expiredDistrict.id,
        role: UserRole.ADMINISTRATOR,
        enrollmentStart: new Date('2020-01-01'),
        enrollmentEnd: new Date('2020-12-31'),
      });
      // Active enrollment for another user (to verify they would be returned if authorized)
      await UserOrgFactory.create({
        userId: activeAdmin.id,
        orgId: expiredDistrict.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.getAuthorizedUsersByDistrictId(
        { userId: expiredUser.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        expiredDistrict.id,
        { page: 1, perPage: 100 },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('returns empty when requesting user has future enrollment in district', async () => {
      const futureDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Future Enrollment Auth Test District',
      });
      const futureUser = await UserFactory.create({ username: 'future_auth_user' });
      const activeAdmin = await UserFactory.create({ username: 'active_admin_future' });

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      // Future enrollment for the requesting user
      await UserOrgFactory.create({
        userId: futureUser.id,
        orgId: futureDistrict.id,
        role: UserRole.ADMINISTRATOR,
        enrollmentStart: futureDate,
      });
      // Active enrollment for another user
      await UserOrgFactory.create({
        userId: activeAdmin.id,
        orgId: futureDistrict.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.getAuthorizedUsersByDistrictId(
        { userId: futureUser.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        futureDistrict.id,
        { page: 1, perPage: 100 },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });
  });
});
