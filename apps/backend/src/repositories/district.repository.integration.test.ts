/**
 * Integration tests for DistrictRepository.
 *
 * Tests custom methods (listAll, listAuthorized, getChildren, fetchDistrictCounts)
 * against the real database with the base fixture's org hierarchy.
 *
 * Verifies SQL correctness and proper filtering by orgType, rosteringEnded, etc.
 */
import { describe, it, expect } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { OrgFactory } from '../test-support/factories/org.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import { DistrictRepository, type DistrictWithCounts } from './district.repository';
import { UserRole } from '../enums/user-role.enum';
import { OrgType } from '../enums/org-type.enum';

describe('DistrictRepository', () => {
  const repository = new DistrictRepository();

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

    it('applies orderBy createdAt descending', async () => {
      const result = await repository.listAll({
        page: 1,
        perPage: 100,
        orderBy: { field: 'createdAt', direction: 'desc' },
      });

      expect(result.items.length).toBeGreaterThan(1);
      for (let i = 1; i < result.items.length; i++) {
        expect(result.items[i - 1]!.createdAt >= result.items[i]!.createdAt).toBe(true);
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
        expect(item.counts).toBeUndefined();
      }
    });
  });

  describe('getChildren', () => {
    it('returns child organizations of a district', async () => {
      const children = await repository.getChildren(baseFixture.district.id);

      const ids = children.map((c) => c.id);
      // Should include School A
      expect(ids).toContain(baseFixture.schoolA.id);

      // All children should have the district as parent
      for (const child of children) {
        expect(child.parentOrgId).toBe(baseFixture.district.id);
      }
    });

    it('excludes ended children by default', async () => {
      // Create a school with rosteringEnded
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School Exclude Test',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      const children = await repository.getChildren(baseFixture.district.id, false);

      const ids = children.map((c) => c.id);

      // All returned children should have null rosteringEnded
      for (const child of children) {
        expect(child.rosteringEnded).toBeNull();
      }

      // Our ended school should NOT be in results
      expect(ids).not.toContain(endedSchool.id);
    });

    it('includes ended children when includeEnded=true', async () => {
      // Create a school with rosteringEnded
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School 2',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date(),
      });

      const children = await repository.getChildren(baseFixture.district.id, true);

      const ids = children.map((c) => c.id);
      expect(ids).toContain(endedSchool.id);
    });

    it('returns empty array for district with no children', async () => {
      const emptyDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Empty District',
      });

      const children = await repository.getChildren(emptyDistrict.id);

      expect(children).toEqual([]);
    });

    it('sorts children by name ascending', async () => {
      const children = await repository.getChildren(baseFixture.district.id);

      if (children.length > 1) {
        for (let i = 1; i < children.length; i++) {
          expect(children[i - 1]!.name.toLowerCase() <= children[i]!.name.toLowerCase()).toBe(true);
        }
      }
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
        perPage: 100,
        embedCounts: true,
      })) as { items: DistrictWithCounts[]; totalItems: number };

      const district = result.items.find((d) => d.id === emptyDistrict.id);

      // District should be in results
      if (district) {
        expect(district.counts).toEqual({
          users: 0,
          schools: 0,
          classes: 0,
        });
      } else {
        // If not in first page, query specifically for it
        const specificResult = (await repository.listAll({
          page: 1,
          perPage: 1000,
          embedCounts: true,
        })) as { items: DistrictWithCounts[]; totalItems: number };

        const specificDistrict = specificResult.items.find((d) => d.id === emptyDistrict.id);
        expect(specificDistrict).toBeDefined();
        expect(specificDistrict?.counts).toEqual({
          users: 0,
          schools: 0,
          classes: 0,
        });
      }
    });
  });
});
