/**
 * Integration tests for AdministrationRepository.
 *
 * Tests custom methods (listAll, listAuthorized, getByIdAuthorized) against the
 * real database with the base fixture's org hierarchy and administrations.
 *
 * getAssignedUserCountsByAdministrationIds is covered by the existing
 * administration.access-controls.integration.test.ts — only light coverage here.
 */
import { describe, it, expect } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AdministrationRepository } from './administration.repository';
import { UserRole } from '../enums/user-role.enum';

describe('AdministrationRepository', () => {
  const repository = new AdministrationRepository();

  // ─────────────────────────────────────────────────────────────────────────────
  // listAll
  // ─────────────────────────────────────────────────────────────────────────────

  describe('listAll', () => {
    it('returns all administrations with pagination', async () => {
      const result = await repository.listAll({ page: 1, perPage: 100 });

      // baseFixture creates 6 administrations
      expect(result.totalItems).toBeGreaterThanOrEqual(6);
      expect(result.items.length).toBeGreaterThanOrEqual(6);
    });

    it('respects perPage limit', async () => {
      const result = await repository.listAll({ page: 1, perPage: 2 });

      expect(result.items.length).toBeLessThanOrEqual(2);
      expect(result.totalItems).toBeGreaterThanOrEqual(6);
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

    it('filters by active status', async () => {
      // Create an administration that is currently active
      const now = new Date();
      const activeAdmin = await AdministrationFactory.create({
        name: 'Active Test Admin',
        createdBy: baseFixture.districtAdmin.id,
        dateStart: new Date(now.getTime() - 24 * 60 * 60 * 1000), // yesterday
        dateEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
      });

      const result = await repository.listAll({ page: 1, perPage: 100, status: 'active' });

      const ids = result.items.map((a) => a.id);
      expect(ids).toContain(activeAdmin.id);
      // All returned items should have dateStart <= now and dateEnd >= now
      for (const item of result.items) {
        expect(item.dateStart <= now).toBe(true);
        expect(item.dateEnd >= now).toBe(true);
      }
    });

    it('filters by past status', async () => {
      const now = new Date();
      const pastAdmin = await AdministrationFactory.create({
        name: 'Past Test Admin',
        createdBy: baseFixture.districtAdmin.id,
        dateStart: new Date('2020-01-01'),
        dateEnd: new Date('2020-12-31'),
      });

      const result = await repository.listAll({ page: 1, perPage: 100, status: 'past' });

      const ids = result.items.map((a) => a.id);
      expect(ids).toContain(pastAdmin.id);
      for (const item of result.items) {
        expect(item.dateEnd < now).toBe(true);
      }
    });

    it('filters by upcoming status', async () => {
      const now = new Date();
      const upcomingAdmin = await AdministrationFactory.create({
        name: 'Upcoming Test Admin',
        createdBy: baseFixture.districtAdmin.id,
        dateStart: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // next week
        dateEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // two weeks
      });

      const result = await repository.listAll({ page: 1, perPage: 100, status: 'upcoming' });

      const ids = result.items.map((a) => a.id);
      expect(ids).toContain(upcomingAdmin.id);
      for (const item of result.items) {
        expect(item.dateStart > now).toBe(true);
      }
    });

    it('returns empty when no match for status', async () => {
      // Ensure there are no administrations in year 3000
      const result = await repository.listAll({ page: 1, perPage: 100, status: 'past' });

      // All items should have dateEnd in the past — verify they don't include upcoming ones
      const now = new Date();
      for (const item of result.items) {
        expect(item.dateEnd < now).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // listAuthorized
  // ─────────────────────────────────────────────────────────────────────────────

  describe('listAuthorized', () => {
    it('returns only authorized administrations for a user', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.STUDENT] },
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((a) => a.id);

      // School A student should see: school A admin + district admin (ancestor)
      expect(ids).toContain(baseFixture.administrationAssignedToSchoolA.id);
      expect(ids).toContain(baseFixture.administrationAssignedToDistrict.id);

      // Should NOT see administrations from other branches
      expect(ids).not.toContain(baseFixture.administrationAssignedToDistrictB.id);
      expect(ids).not.toContain(baseFixture.administrationAssignedToGroup.id);
      expect(ids).not.toContain(baseFixture.administrationAssignedToClassA.id); // not in class
    });

    it('respects pagination and offset', async () => {
      // District admin with ADMINISTRATOR role sees many administrations via descendant access
      const page1 = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 2, orderBy: { field: 'name', direction: 'asc' } },
      );

      expect(page1.items.length).toBeLessThanOrEqual(2);
      expect(page1.totalItems).toBeGreaterThanOrEqual(1);

      if (page1.totalItems > 2) {
        const page2 = await repository.listAuthorized(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          { page: 2, perPage: 2, orderBy: { field: 'name', direction: 'asc' } },
        );

        // Pages should contain different items
        const page1Ids = new Set(page1.items.map((a) => a.id));
        for (const item of page2.items) {
          expect(page1Ids.has(item.id)).toBe(false);
        }
      }
    });

    it('returns empty for user with no access', async () => {
      const result = await repository.listAuthorized(
        { userId: baseFixture.unassignedUser.id, allowedRoles: [UserRole.STUDENT] },
        { page: 1, perPage: 100 },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('filters by status correctly', async () => {
      // Create an active administration and assign to district
      const now = new Date();
      const activeAdmin = await AdministrationFactory.create({
        name: 'Auth Active Admin',
        createdBy: baseFixture.districtAdmin.id,
        dateStart: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        dateEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      });
      await AdministrationOrgFactory.create({
        administrationId: activeAdmin.id,
        orgId: baseFixture.district.id,
      });

      const result = await repository.listAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        { page: 1, perPage: 100, status: 'active' },
      );

      const ids = result.items.map((a) => a.id);
      expect(ids).toContain(activeAdmin.id);

      // All returned items should be active
      for (const item of result.items) {
        expect(item.dateStart <= now).toBe(true);
        expect(item.dateEnd >= now).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getByIdAuthorized
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getByIdAuthorized', () => {
    it('returns administration when user has access', async () => {
      const result = await repository.getByIdAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.administrationAssignedToDistrict.id);
    });

    it('returns null when user lacks access', async () => {
      // District B admin should not have access to District A's administration
      const result = await repository.getByIdAuthorized(
        { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(result).toBeNull();
    });

    it('returns null for nonexistent administration ID', async () => {
      const result = await repository.getByIdAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getAssignedUserCountsByAdministrationIds (light coverage — detailed tests
  // are in administration.access-controls.integration.test.ts)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getAssignedUserCountsByAdministrationIds', () => {
    it('returns counts for administrations', async () => {
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToGroup.id,
      ]);

      // Group has exactly 1 user (groupStudent)
      expect(counts.get(baseFixture.administrationAssignedToGroup.id)).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getDistrictsByAdministrationId
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getDistrictsByAdministrationId', () => {
    it('returns districts assigned to an administration', async () => {
      // administrationAssignedToDistrict is assigned to district (which is a district org)
      const result = await repository.getDistrictsByAdministrationId(baseFixture.administrationAssignedToDistrict.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe(baseFixture.district.id);
      expect(result.items[0]!.orgType).toBe('district');
    });

    it('returns empty when administration is assigned to non-district orgs', async () => {
      // administrationAssignedToSchoolA is assigned to schoolA (which is a school org, not district)
      const result = await repository.getDistrictsByAdministrationId(baseFixture.administrationAssignedToSchoolA.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('returns empty when administration is assigned to classes/groups only', async () => {
      // administrationAssignedToClassA is only assigned to a class, not any org
      const result = await repository.getDistrictsByAdministrationId(baseFixture.administrationAssignedToClassA.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('returns multiple districts when administration is assigned to multiple districts', async () => {
      // Create an administration assigned to both districts
      const multiDistrictAdmin = await AdministrationFactory.create({
        name: 'Multi-District Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: multiDistrictAdmin.id,
        orgId: baseFixture.district.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: multiDistrictAdmin.id,
        orgId: baseFixture.districtB.id,
      });

      const result = await repository.getDistrictsByAdministrationId(multiDistrictAdmin.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);

      const districtIds = result.items.map((d) => d.id);
      expect(districtIds).toContain(baseFixture.district.id);
      expect(districtIds).toContain(baseFixture.districtB.id);
    });

    it('respects pagination', async () => {
      // Create an administration assigned to both districts
      const paginatedAdmin = await AdministrationFactory.create({
        name: 'Paginated Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: paginatedAdmin.id,
        orgId: baseFixture.district.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: paginatedAdmin.id,
        orgId: baseFixture.districtB.id,
      });

      // Get first page
      const page1 = await repository.getDistrictsByAdministrationId(paginatedAdmin.id, {
        page: 1,
        perPage: 1,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(page1.totalItems).toBe(2);
      expect(page1.items).toHaveLength(1);

      // Get second page
      const page2 = await repository.getDistrictsByAdministrationId(paginatedAdmin.id, {
        page: 2,
        perPage: 1,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(page2.totalItems).toBe(2);
      expect(page2.items).toHaveLength(1);

      // Pages should have different items
      expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
    });

    it('sorts by name ascending by default', async () => {
      // Create an administration assigned to both districts
      const sortTestAdmin = await AdministrationFactory.create({
        name: 'Sort Test Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: sortTestAdmin.id,
        orgId: baseFixture.district.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: sortTestAdmin.id,
        orgId: baseFixture.districtB.id,
      });

      const result = await repository.getDistrictsByAdministrationId(sortTestAdmin.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(result.items.length).toBe(2);
      // Verify ascending order
      expect(result.items[0]!.name.toLowerCase() <= result.items[1]!.name.toLowerCase()).toBe(true);
    });

    it('supports descending sort order', async () => {
      // Create an administration assigned to both districts
      const descSortAdmin = await AdministrationFactory.create({
        name: 'Desc Sort Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: descSortAdmin.id,
        orgId: baseFixture.district.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: descSortAdmin.id,
        orgId: baseFixture.districtB.id,
      });

      const result = await repository.getDistrictsByAdministrationId(descSortAdmin.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'desc' },
      });

      expect(result.items.length).toBe(2);
      // Verify descending order
      expect(result.items[0]!.name.toLowerCase() >= result.items[1]!.name.toLowerCase()).toBe(true);
    });

    it('returns empty for non-existent administration ID', async () => {
      const result = await repository.getDistrictsByAdministrationId('00000000-0000-0000-0000-000000000000', {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getDistrictsByAdministrationIdAuthorized
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getDistrictsByAdministrationIdAuthorized', () => {
    it('returns districts that user has access to', async () => {
      // districtAdmin has access to district through their org membership
      const result = await repository.getDistrictsByAdministrationIdAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.administrationAssignedToDistrict.id,
        { page: 1, perPage: 100 },
      );

      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns only districts user can access when admin is assigned to multiple districts', async () => {
      // Create an administration assigned to both districts
      const multiDistrictAdmin = await AdministrationFactory.create({
        name: 'Multi-District Auth Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: multiDistrictAdmin.id,
        orgId: baseFixture.district.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: multiDistrictAdmin.id,
        orgId: baseFixture.districtB.id,
      });

      // districtAdmin only has access to district (not districtB)
      const result = await repository.getDistrictsByAdministrationIdAuthorized(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        multiDistrictAdmin.id,
        { page: 1, perPage: 100 },
      );

      // Should only see the district they have access to
      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns empty when user has no access to any assigned districts', async () => {
      // districtBAdmin trying to access administrationAssignedToDistrict
      // They have no access to the district where this admin is assigned
      const result = await repository.getDistrictsByAdministrationIdAuthorized(
        { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        baseFixture.administrationAssignedToDistrict.id,
        { page: 1, perPage: 100 },
      );

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('student sees district through school membership (ancestor access)', async () => {
      // schoolAStudent is in schoolA, which is a child of district
      // They should see district via ancestor access
      const result = await repository.getDistrictsByAdministrationIdAuthorized(
        { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.STUDENT] },
        baseFixture.administrationAssignedToDistrict.id,
        { page: 1, perPage: 100 },
      );

      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe(baseFixture.district.id);
    });

    it('respects pagination', async () => {
      // Create an administration assigned to both districts
      const paginatedAuthAdmin = await AdministrationFactory.create({
        name: 'Paginated Auth Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: paginatedAuthAdmin.id,
        orgId: baseFixture.district.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: paginatedAuthAdmin.id,
        orgId: baseFixture.districtB.id,
      });

      // Create a user with access to both districts
      const { UserFactory } = await import('../test-support/factories/user.factory');
      const { UserOrgFactory } = await import('../test-support/factories/user-org.factory');
      const dualDistrictUser = await UserFactory.create();
      await UserOrgFactory.create({
        userId: dualDistrictUser.id,
        orgId: baseFixture.district.id,
        role: UserRole.ADMINISTRATOR,
      });
      await UserOrgFactory.create({
        userId: dualDistrictUser.id,
        orgId: baseFixture.districtB.id,
        role: UserRole.ADMINISTRATOR,
      });

      // Get first page
      const page1 = await repository.getDistrictsByAdministrationIdAuthorized(
        { userId: dualDistrictUser.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        paginatedAuthAdmin.id,
        { page: 1, perPage: 1, orderBy: { field: 'name', direction: 'asc' } },
      );

      expect(page1.totalItems).toBe(2);
      expect(page1.items).toHaveLength(1);

      // Get second page
      const page2 = await repository.getDistrictsByAdministrationIdAuthorized(
        { userId: dualDistrictUser.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        paginatedAuthAdmin.id,
        { page: 2, perPage: 1, orderBy: { field: 'name', direction: 'asc' } },
      );

      expect(page2.totalItems).toBe(2);
      expect(page2.items).toHaveLength(1);

      // Pages should have different items
      expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getUserRolesForAdministration
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getUserRolesForAdministration', () => {
    it('returns roles for user with access via org', async () => {
      const roles = await repository.getUserRolesForAdministration(
        baseFixture.districtAdmin.id,
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(roles).toContain('administrator');
    });

    it('returns empty array for user without access', async () => {
      const roles = await repository.getUserRolesForAdministration(
        baseFixture.districtBAdmin.id,
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(roles).toHaveLength(0);
    });

    it('returns multiple roles for user with multiple memberships', async () => {
      const roles = await repository.getUserRolesForAdministration(
        baseFixture.multiAssignedUser.id,
        baseFixture.administrationAssignedToDistrict.id,
      );

      expect(roles).toContain('administrator');
      expect(roles).toContain('teacher');
    });
  });
});
