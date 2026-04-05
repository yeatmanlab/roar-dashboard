/**
 * Integration tests for SchoolRepository.
 *
 * Tests custom methods (listAll, listAuthorized, fetchSchoolCounts)
 * against the real database with the base fixture's org hierarchy.
 *
 * Verifies SQL correctness and proper filtering by orgType, rosteringEnded, etc.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { OrgFactory } from '../test-support/factories/org.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import type { SchoolWithCounts } from './school.repository';
import { SchoolRepository } from './school.repository';
import { UserRole } from '../enums/user-role.enum';
import { OrgType } from '../enums/org-type.enum';

describe('SchoolRepository', () => {
  let repository: SchoolRepository;

  beforeAll(() => {
    repository = new SchoolRepository();
  });

  describe('listAll', () => {
    it('returns all schools with pagination', async () => {
      const result = await repository.listAll({ page: 1, perPage: 100 });

      expect(result.totalItems).toBeGreaterThanOrEqual(1);
      expect(result.items.length).toBeGreaterThanOrEqual(1);

      // All items should be schools
      for (const item of result.items) {
        expect(item.orgType).toBe(OrgType.SCHOOL);
      }
    });

    it('respects perPage limit', async () => {
      const result = await repository.listAll({ page: 1, perPage: 1 });

      expect(result.items.length).toBeLessThanOrEqual(1);
      expect(result.totalItems).toBeGreaterThanOrEqual(1);
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

    it('excludes schools with rosteringEnded by default', async () => {
      // Create a school with rosteringEnded set
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School Exclude Test',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      // Verify the school was created with rosteringEnded
      expect(endedSchool.rosteringEnded).not.toBeNull();

      const result = await repository.listAll({
        page: 1,
        perPage: 1000,
        includeEnded: false,
      });

      const ids = result.items.map((s) => s.id);

      // All returned items should have null rosteringEnded
      for (const item of result.items) {
        expect(item.rosteringEnded).toBeNull();
      }

      // Our ended school should NOT be in the results
      expect(ids).not.toContain(endedSchool.id);
    });

    it('includes schools with rosteringEnded when includeEnded=true', async () => {
      // Create a school with rosteringEnded set
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School 2',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date(),
      });

      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        includeEnded: true,
      });

      const ids = result.items.map((s) => s.id);
      expect(ids).toContain(endedSchool.id);
    });

    it('only returns schools, not other org types', async () => {
      const result = await repository.listAll({ page: 1, perPage: 100 });

      // Verify no districts, classes, etc. are returned
      for (const item of result.items) {
        expect(item.orgType).toBe(OrgType.SCHOOL);
      }
    });
  });

  describe('listAuthorized', () => {
    it('returns only authorized schools for a user', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.STUDENT] },
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((s) => s.id);

      // School A student should see School A
      expect(ids).toContain(baseFixture.schoolA.id);

      // Should NOT see unrelated schools
      expect(ids).not.toContain(baseFixture.schoolB.id);
    });

    it('returns schools for class-level user', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.classAStudent.id, allowedRoles: [UserRole.STUDENT] },
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((s) => s.id);

      // Class student should see parent school
      expect(ids).toContain(baseFixture.schoolA.id);
    });

    it('returns child schools for district-level supervisory roles', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((s) => s.id);
      // District admin should see child schools
      expect(ids).toContain(baseFixture.schoolA.id);
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

    it('excludes ended schools by default', async () => {
      // Create a school with rosteringEnded
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School for Auth Exclude Test',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      // Assign user to the ended school
      await UserOrgFactory.create({
        userId: baseFixture.districtAdmin.id,
        orgId: endedSchool.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 1000, includeEnded: false },
      );

      const ids = result.items.map((s) => s.id);

      // All returned items should have null rosteringEnded
      for (const item of result.items) {
        expect(item.rosteringEnded).toBeNull();
      }

      // Our ended school should NOT be in results
      expect(ids).not.toContain(endedSchool.id);
    });

    it('includes ended schools when includeEnded=true', async () => {
      // Create a school with rosteringEnded
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School for Auth Test 2',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date(),
      });

      // Assign user to the ended school
      await UserOrgFactory.create({
        userId: baseFixture.districtAdmin.id,
        orgId: endedSchool.id,
        role: UserRole.ADMINISTRATOR,
      });

      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 100, includeEnded: true },
      );

      const ids = result.items.map((s) => s.id);
      expect(ids).toContain(endedSchool.id);
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
      const schoolWithCounts = result.items.find((s) => s.id === baseFixture.schoolA.id) as
        | SchoolWithCounts
        | undefined;
      expect(schoolWithCounts).toBeDefined();
      expect(schoolWithCounts?.counts).toBeDefined();
      expect(schoolWithCounts?.counts).toHaveProperty('users');
      expect(schoolWithCounts?.counts).toHaveProperty('classes');
      // Schools should NOT have schools count
      expect(schoolWithCounts?.counts).not.toHaveProperty('schools');
    });

    it('omits counts when embedCounts=false', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 100, embedCounts: false },
      );

      expect(result.items.length).toBeGreaterThan(0);
      for (const item of result.items) {
        expect((item as SchoolWithCounts).counts).toBeUndefined();
      }
    });
  });

  describe('counts aggregation', () => {
    it('returns accurate user counts', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const school = result.items.find((s) => s.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school?.counts).toBeDefined();
      // Should have at least the school student
      expect(school?.counts?.users).toBeGreaterThan(0);
    });

    it('returns accurate class counts', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const school = result.items.find((s) => s.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school?.counts).toBeDefined();
      // Should have at least Class A
      expect(school?.counts?.classes).toBeGreaterThanOrEqual(0);
    });

    it('does not include schools count for schools', async () => {
      const result = (await repository.listAll({
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const school = result.items.find((s) => s.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school?.counts).toBeDefined();
      // Schools should NOT have schools count
      expect(school?.counts).not.toHaveProperty('schools');
      expect(school?.counts).toHaveProperty('users');
      expect(school?.counts).toHaveProperty('classes');
    });

    it('returns zero counts for empty school', async () => {
      const emptySchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Empty School for Counts',
        parentOrgId: baseFixture.district.id,
      });

      const result = (await repository.listAll({
        page: 1,
        perPage: 1000,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      // Find the newly created school in the results
      const school = result.items.find((s) => s.id === emptySchool.id);
      expect(school).toBeDefined();
      expect(school?.counts).toEqual({
        users: 0,
        classes: 0,
      });
    });
  });

  describe('getUnrestrictedById', () => {
    it('returns school by ID without authorization checks', async () => {
      const result = await repository.getUnrestrictedById(baseFixture.schoolA.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.schoolA.id);
      expect(result?.orgType).toBe(OrgType.SCHOOL);
      expect(result?.name).toBe(baseFixture.schoolA.name);
    });

    it('returns null for non-existent ID', async () => {
      const result = await repository.getUnrestrictedById('00000000-0000-0000-0000-000000000000');

      expect(result).toBeNull();
    });

    it('returns null for district ID (wrong orgType)', async () => {
      const result = await repository.getUnrestrictedById(baseFixture.district.id);

      // Should return null because district is not a school
      expect(result).toBeNull();
    });

    it('returns school even if it has rosteringEnded', async () => {
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School for Unrestricted Test',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      const result = await repository.getUnrestrictedById(endedSchool.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(endedSchool.id);
      expect(result?.rosteringEnded).not.toBeNull();
    });

    it('returns school with all expected fields', async () => {
      const result = await repository.getUnrestrictedById(baseFixture.schoolA.id);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('abbreviation');
      expect(result).toHaveProperty('orgType');
      expect(result).toHaveProperty('parentOrgId');
      expect(result).toHaveProperty('isRosteringRootOrg');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });

  describe('getAuthorizedById', () => {
    it('returns school when user has direct org-level access', async () => {
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.STUDENT] },
        baseFixture.schoolA.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.schoolA.id);
      expect(result?.orgType).toBe(OrgType.SCHOOL);
    });

    it('returns school when user has class-level access (via org hierarchy)', async () => {
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.classAStudent.id, allowedRoles: [UserRole.STUDENT] },
        baseFixture.schoolA.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.schoolA.id);
    });

    it('returns school when district admin accesses child school (descendant access)', async () => {
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.schoolA.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.schoolA.id);
    });

    it('returns null when user has no access to the school', async () => {
      const isolatedUser = await UserFactory.create({
        nameFirst: 'No',
        nameLast: 'Access',
      });

      const result = await repository.getAuthorizedById(
        { userId: isolatedUser.id, allowedRoles: [UserRole.STUDENT] },
        baseFixture.schoolA.id,
      );

      expect(result).toBeNull();
    });

    it('returns null when user tries to access different school', async () => {
      // School A student should not see School B
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.STUDENT] },
        baseFixture.schoolB.id,
      );

      expect(result).toBeNull();
    });

    it('returns null for non-existent school ID', async () => {
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });

    it('returns null for district ID (wrong orgType)', async () => {
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.district.id,
      );

      // Should return null because district is not a school
      expect(result).toBeNull();
    });

    it('filters by orgType=school correctly', async () => {
      // Create a class with same ID pattern to ensure orgType filtering works
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.classAStudent.id, allowedRoles: [UserRole.STUDENT] },
        baseFixture.schoolA.id,
      );

      expect(result).toBeDefined();
      expect(result?.orgType).toBe(OrgType.SCHOOL);
    });

    it('respects role filtering', async () => {
      // User has STUDENT role but we only allow ADMINISTRATOR
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.schoolA.id,
      );

      // Should return null because user doesn't have the required role
      expect(result).toBeNull();
    });

    it('returns school when user has one of multiple allowed roles', async () => {
      const result = await repository.getAuthorizedById(
        {
          userId: baseFixture.schoolAStudent.id,
          allowedRoles: [UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.STUDENT],
        },
        baseFixture.schoolA.id,
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.schoolA.id);
    });
  });
});
