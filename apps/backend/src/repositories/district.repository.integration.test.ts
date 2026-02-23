/**
 * Integration tests for DistrictRepository.
 *
 * Tests custom methods (listAll, listAuthorized, getChildren, fetchDistrictCounts)
 * against the real database with the base fixture's org hierarchy.
 *
 * Verifies SQL correctness and proper filtering by orgType, rosteringEnded, etc.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { OrgFactory } from '../test-support/factories/org.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserFactory } from '../test-support/factories/user.factory';
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
  });

  // Note: embedCounts, getChildren, and counts aggregation tests removed
  // These features are now handled at the service layer to align with administrations pattern
  // The repository only provides fetchDistrictCounts() as a utility method for the service
});
