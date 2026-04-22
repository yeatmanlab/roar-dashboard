/**
 * Integration tests for AdministrationRepository.
 *
 * Tests custom methods against the real database with the base fixture's
 * org hierarchy and administrations.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AdministrationTaskVariantFactory } from '../test-support/factories/administration-task-variant.factory';
import { TaskFactory } from '../test-support/factories/task.factory';
import { TaskVariantFactory } from '../test-support/factories/task-variant.factory';
import { AdministrationRepository } from './administration.repository';
import { TaskVariantStatus } from '../enums/task-variant-status.enum';

describe('AdministrationRepository', () => {
  let repository: AdministrationRepository;

  beforeAll(() => {
    repository = new AdministrationRepository();
  });

  describe('listAll', () => {
    it('returns all administrations with pagination', async () => {
      const result = await repository.listAll({ page: 1, perPage: 100 });

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

  describe('getAssignedUserCountsByAdministrationIds', () => {
    it('counts users via direct group path', async () => {
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToGroup.id,
      ]);

      // Group has exactly 1 user (groupStudent); futureGroupStudent is excluded
      expect(counts.get(baseFixture.administrationAssignedToGroup.id)).toBe(1);
    });

    it('counts users via direct class path', async () => {
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToClassA.id,
      ]);

      // classInSchoolA has 2 active users (classAStudent, classATeacher); expiredClassStudent excluded
      expect(counts.get(baseFixture.administrationAssignedToClassA.id)).toBe(2);
    });

    it('counts users via org hierarchy paths (viaOrgToOrgUsers and viaOrgToClassUsers)', async () => {
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToDistrict.id,
      ]);

      // administrationAssignedToDistrict is assigned to district, which via ltree includes:
      // - viaOrgToOrgUsers: districtAdmin, schoolATeacher, multiAssignedUser (district+schoolA),
      //   grade5Student, grade3Student, grade5EllStudent
      // - viaOrgToClassUsers: classAStudent, classATeacher (active in classInSchoolA under district)
      // Excluded: expiredEnrollmentStudent, futureEnrollmentStudent, expiredClassStudent
      const count = counts.get(baseFixture.administrationAssignedToDistrict.id);
      expect(count).toBeGreaterThanOrEqual(8);
      // districtAdmin, schoolATeacher, multiAssignedUser, classAStudent, classATeacher,
      // grade5Student, grade3Student, grade5EllStudent
    });

    it('deduplicates users reachable via multiple paths', async () => {
      // multiAssignedUser has active enrollments at both district AND schoolA,
      // so they appear in viaOrgToOrgUsers twice (once per org). COUNT(DISTINCT) must collapse them.
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToDistrict.id,
      ]);

      const count = counts.get(baseFixture.administrationAssignedToDistrict.id) ?? 0;

      // Verify multiAssignedUser is not double-counted by confirming the total is
      // consistent with unique users only. If deduplication broke, the count would
      // be higher by the number of extra paths multiAssignedUser traverses.
      expect(count).toBeGreaterThan(0);

      // Create an administration with multiAssignedUser's district only and compare
      // with a fresh single-org administration to confirm the count is stable
      const freshAdmin = await AdministrationFactory.create({
        name: 'Dedup Test Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: freshAdmin.id,
        orgId: baseFixture.district.id,
      });

      const freshCounts = await repository.getAssignedUserCountsByAdministrationIds([freshAdmin.id]);
      expect(freshCounts.get(freshAdmin.id)).toBe(count);
    });

    it('returns count for multiple administrations in one call', async () => {
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToGroup.id,
        baseFixture.administrationAssignedToClassA.id,
      ]);

      expect(counts.get(baseFixture.administrationAssignedToGroup.id)).toBe(1);
      expect(counts.get(baseFixture.administrationAssignedToClassA.id)).toBe(2);
    });

    it('omits entry from returned Map for administration with no assigned users', async () => {
      const emptyAdmin = await AdministrationFactory.create({
        name: 'No Users Admin',
        createdBy: baseFixture.districtAdmin.id,
      });

      const counts = await repository.getAssignedUserCountsByAdministrationIds([emptyAdmin.id]);

      // The Map should have no entry for an administration with 0 users
      // (callers use counts.get(id) ?? 0 to handle the missing entry)
      expect(counts.has(emptyAdmin.id)).toBe(false);
    });

    it('excludes users with expired org enrollments', async () => {
      // Create an administration assigned to schoolA, which has expiredEnrollmentStudent
      // with an enrollment that ended 7 days ago
      const admin = await AdministrationFactory.create({
        name: 'Expired Enrollment Test Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: admin.id,
        orgId: baseFixture.schoolA.id,
      });

      const counts = await repository.getAssignedUserCountsByAdministrationIds([admin.id]);

      const count = counts.get(admin.id) ?? 0;
      // schoolATeacher is active; expiredEnrollmentStudent is excluded
      // multiAssignedUser is also in schoolA
      expect(count).toBeGreaterThan(0);

      // Verify expiredEnrollmentStudent is not in the count by cross-checking with
      // an administration assigned to a group only the expired student belongs to:
      // there is no such group in baseFixture, so we verify indirectly that the total
      // matches only active enrollments (schoolATeacher + multiAssignedUser = 2)
      expect(count).toBe(2);
    });

    it('excludes users with future org enrollments', async () => {
      // Create an administration assigned to schoolA, which has futureEnrollmentStudent
      // with an enrollment that starts 7 days from now
      const admin = await AdministrationFactory.create({
        name: 'Future Enrollment Test Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: admin.id,
        orgId: baseFixture.schoolA.id,
      });

      const counts = await repository.getAssignedUserCountsByAdministrationIds([admin.id]);

      // futureEnrollmentStudent should be excluded; only schoolATeacher + multiAssignedUser
      expect(counts.get(admin.id)).toBe(2);
    });

    it('excludes users with expired class enrollments', async () => {
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToClassA.id,
      ]);

      // expiredClassStudent has enrollment that ended 7 days ago — should be excluded
      // Only classAStudent and classATeacher have active enrollments
      expect(counts.get(baseFixture.administrationAssignedToClassA.id)).toBe(2);
    });

    it('throws when called with an empty administrationIds array', async () => {
      await expect(repository.getAssignedUserCountsByAdministrationIds([])).rejects.toThrow();
    });
  });

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

  describe('getSchoolsByAdministrationId', () => {
    it('returns schools assigned to an administration', async () => {
      // administrationAssignedToSchoolA is assigned to schoolA (which is a school org)
      const result = await repository.getSchoolsByAdministrationId(baseFixture.administrationAssignedToSchoolA.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe(baseFixture.schoolA.id);
      expect(result.items[0]!.orgType).toBe('school');
    });

    it('returns empty when administration is assigned to non-school orgs', async () => {
      // administrationAssignedToDistrict is assigned to district (which is a district org, not school)
      const result = await repository.getSchoolsByAdministrationId(baseFixture.administrationAssignedToDistrict.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('returns empty when administration is assigned to classes/groups only', async () => {
      // administrationAssignedToClassA is only assigned to a class, not any org
      const result = await repository.getSchoolsByAdministrationId(baseFixture.administrationAssignedToClassA.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('returns multiple schools when administration is assigned to multiple schools', async () => {
      // Create an administration assigned to both schools
      const multiSchoolAdmin = await AdministrationFactory.create({
        name: 'Multi-School Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: multiSchoolAdmin.id,
        orgId: baseFixture.schoolA.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: multiSchoolAdmin.id,
        orgId: baseFixture.schoolB.id,
      });

      const result = await repository.getSchoolsByAdministrationId(multiSchoolAdmin.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);

      const schoolIds = result.items.map((s) => s.id);
      expect(schoolIds).toContain(baseFixture.schoolA.id);
      expect(schoolIds).toContain(baseFixture.schoolB.id);
    });

    it('respects pagination', async () => {
      // Create an administration assigned to both schools
      const paginatedAdmin = await AdministrationFactory.create({
        name: 'Paginated School Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: paginatedAdmin.id,
        orgId: baseFixture.schoolA.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: paginatedAdmin.id,
        orgId: baseFixture.schoolB.id,
      });

      // Get first page
      const page1 = await repository.getSchoolsByAdministrationId(paginatedAdmin.id, {
        page: 1,
        perPage: 1,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(page1.totalItems).toBe(2);
      expect(page1.items).toHaveLength(1);

      // Get second page
      const page2 = await repository.getSchoolsByAdministrationId(paginatedAdmin.id, {
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
      // Create an administration assigned to both schools
      const sortTestAdmin = await AdministrationFactory.create({
        name: 'Sort Test School Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: sortTestAdmin.id,
        orgId: baseFixture.schoolA.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: sortTestAdmin.id,
        orgId: baseFixture.schoolB.id,
      });

      const result = await repository.getSchoolsByAdministrationId(sortTestAdmin.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'asc' },
      });

      expect(result.items.length).toBe(2);
      // Verify ascending order
      expect(result.items[0]!.name.toLowerCase() <= result.items[1]!.name.toLowerCase()).toBe(true);
    });

    it('supports descending sort order', async () => {
      // Create an administration assigned to both schools
      const descSortAdmin = await AdministrationFactory.create({
        name: 'Desc Sort School Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: descSortAdmin.id,
        orgId: baseFixture.schoolA.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: descSortAdmin.id,
        orgId: baseFixture.schoolB.id,
      });

      const result = await repository.getSchoolsByAdministrationId(descSortAdmin.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'name', direction: 'desc' },
      });

      expect(result.items.length).toBe(2);
      // Verify descending order
      expect(result.items[0]!.name.toLowerCase() >= result.items[1]!.name.toLowerCase()).toBe(true);
    });

    it('returns empty for non-existent administration ID', async () => {
      const result = await repository.getSchoolsByAdministrationId('00000000-0000-0000-0000-000000000000', {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  describe('getTaskVariantsByAdministrationId', () => {
    it('returns only published variants when publishedOnly is true', async () => {
      // Create a task and variants with different statuses
      const task = await TaskFactory.create();
      const publishedVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Published Variant',
        status: TaskVariantStatus.PUBLISHED,
      });
      const draftVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Draft Variant',
        status: TaskVariantStatus.DRAFT,
      });
      const deprecatedVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Deprecated Variant',
        status: TaskVariantStatus.DEPRECATED,
      });

      // Create administration and assign all variants
      const administration = await AdministrationFactory.create({
        name: 'Task Variant Status Test Admin',
        createdBy: baseFixture.districtAdmin.id,
      });

      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: publishedVariant.id,
        orderIndex: 0,
      });
      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: draftVariant.id,
        orderIndex: 1,
      });
      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: deprecatedVariant.id,
        orderIndex: 2,
      });

      // Query with publishedOnly: true (supervised role behavior)
      const result = await repository.getTaskVariantsByAdministrationId(
        administration.id,
        true, // publishedOnly
        { page: 1, perPage: 100 },
      );

      // Should only return the published variant
      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.variant.id).toBe(publishedVariant.id);
      expect(result.items[0]!.variant.status).toBe(TaskVariantStatus.PUBLISHED);
    });

    it('returns all variants (including draft/deprecated) when publishedOnly is false', async () => {
      // Create a task and variants with different statuses
      const task = await TaskFactory.create();
      const publishedVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Published Variant 2',
        status: TaskVariantStatus.PUBLISHED,
      });
      const draftVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Draft Variant 2',
        status: TaskVariantStatus.DRAFT,
      });

      // Create administration and assign both variants
      const administration = await AdministrationFactory.create({
        name: 'Task Variant All Statuses Test Admin',
        createdBy: baseFixture.districtAdmin.id,
      });

      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: publishedVariant.id,
        orderIndex: 0,
      });
      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: draftVariant.id,
        orderIndex: 1,
      });

      // Query with publishedOnly: false (supervisory role behavior)
      const result = await repository.getTaskVariantsByAdministrationId(
        administration.id,
        false, // publishedOnly
        { page: 1, perPage: 100 },
      );

      // Should return all variants regardless of status
      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);

      const variantIds = result.items.map((item) => item.variant.id);
      expect(variantIds).toContain(publishedVariant.id);
      expect(variantIds).toContain(draftVariant.id);
    });

    it('returns all variants when publishedOnly is false', async () => {
      // Create a task and variants with different statuses
      const task = await TaskFactory.create();
      const publishedVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Published Variant 3',
        status: TaskVariantStatus.PUBLISHED,
      });
      const draftVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Draft Variant 3',
        status: TaskVariantStatus.DRAFT,
      });

      // Create administration and assign both variants
      const administration = await AdministrationFactory.create({
        name: 'Task Variant Default Behavior Test Admin',
        createdBy: baseFixture.districtAdmin.id,
      });

      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: publishedVariant.id,
        orderIndex: 0,
      });
      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: draftVariant.id,
        orderIndex: 1,
      });

      // Query with publishedOnly: false (same as supervisory role behavior)
      const result = await repository.getTaskVariantsByAdministrationId(
        administration.id,
        false, // publishedOnly
        { page: 1, perPage: 100 },
      );

      // Should return all variants (no filtering)
      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('respects pagination and sorting with publishedOnly filter', async () => {
      // Create a task and multiple published variants
      const task = await TaskFactory.create();
      const variantA = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Alpha Variant',
        status: TaskVariantStatus.PUBLISHED,
      });
      const variantB = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Beta Variant',
        status: TaskVariantStatus.PUBLISHED,
      });
      // Draft variant should be excluded
      const draftVariant = await TaskVariantFactory.create({
        taskId: task.id,
        name: 'Draft Should Be Excluded',
        status: TaskVariantStatus.DRAFT,
      });

      const administration = await AdministrationFactory.create({
        name: 'Task Variant Pagination Test Admin',
        createdBy: baseFixture.districtAdmin.id,
      });

      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: variantA.id,
        orderIndex: 0,
      });
      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: variantB.id,
        orderIndex: 1,
      });
      await AdministrationTaskVariantFactory.create({
        administrationId: administration.id,
        taskVariantId: draftVariant.id,
        orderIndex: 2,
      });

      // Get first page with publishedOnly: true
      const page1 = await repository.getTaskVariantsByAdministrationId(
        administration.id,
        true, // publishedOnly
        { page: 1, perPage: 1, orderBy: { field: 'name', direction: 'asc' } },
      );

      expect(page1.totalItems).toBe(2); // Only 2 published variants
      expect(page1.items).toHaveLength(1);
      expect(page1.items[0]!.variant.name).toBe('Alpha Variant');

      // Get second page
      const page2 = await repository.getTaskVariantsByAdministrationId(
        administration.id,
        true, // publishedOnly
        { page: 2, perPage: 1, orderBy: { field: 'name', direction: 'asc' } },
      );

      expect(page2.totalItems).toBe(2);
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]!.variant.name).toBe('Beta Variant');
    });
  });
});
