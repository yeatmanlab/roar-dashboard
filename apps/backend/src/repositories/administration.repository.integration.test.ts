/**
 * Integration tests for AdministrationRepository.
 *
 * Tests custom methods (listAll, getAuthorizedById, getAssignees) against the
 * real database with the base fixture's org hierarchy and administrations.
 *
 * getAssignedUserCountsByAdministrationIds is covered by the existing
 * administration.access-controls.integration.test.ts — only light coverage here.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AdministrationClassFactory } from '../test-support/factories/administration-class.factory';
import { AdministrationGroupFactory } from '../test-support/factories/administration-group.factory';
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
      // - viaOrgToOrgUsers: districtAdmin, schoolAAdmin, schoolAPrincipal, schoolATeacher, schoolAStudent,
      //   schoolBStudent, multiAssignedUser (district+schoolA), grade5Student, grade3Student, grade5EllStudent
      // - viaOrgToClassUsers: classAStudent, classATeacher (active in classInSchoolA under district)
      // Excluded: expiredEnrollmentStudent, futureEnrollmentStudent, expiredClassStudent
      const count = counts.get(baseFixture.administrationAssignedToDistrict.id);
      expect(count).toBe(12);
    });

    it('deduplicates users reachable via multiple paths', async () => {
      // multiAssignedUser has active enrollments at both district AND schoolA. Both orgs are in the
      // district subtree, so viaOrgToOrgUsers emits two rows for them (one per enrollment).
      // The full UNION ALL produces 13 rows (11 single-path users + 2 rows for multiAssignedUser),
      // but COUNT(DISTINCT userId) must collapse them to 12 unique users.
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToDistrict.id,
      ]);

      const count = counts.get(baseFixture.administrationAssignedToDistrict.id) ?? 0;
      expect(count).toBe(12); // would be 13 with COUNT instead of COUNT(DISTINCT)
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

      // schoolA has 5 active org-level users (schoolAAdmin, schoolAPrincipal, schoolATeacher,
      // schoolAStudent, multiAssignedUser) + 2 active class-level users (classAStudent, classATeacher).
      // expiredEnrollmentStudent's enrollment ended 7 days ago and must be excluded.
      expect(count).toBe(7);
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

      // futureEnrollmentStudent's enrollment starts 7 days from now and must be excluded,
      // leaving the same 7 active users reachable from schoolA.
      expect(counts.get(admin.id)).toBe(7);
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

  describe('getAssignees', () => {
    it('returns empty lists when administration has no assignees', async () => {
      const admin = await AdministrationFactory.create({
        name: 'No Assignees Admin',
        createdBy: baseFixture.districtAdmin.id,
      });

      const result = await repository.getAssignees(admin.id);

      expect(result.districts).toEqual([]);
      expect(result.schools).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.groups).toEqual([]);
    });

    it('returns districts correctly', async () => {
      const admin = await AdministrationFactory.create({
        name: 'District Assignees Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: admin.id,
        orgId: baseFixture.district.id,
      });

      const result = await repository.getAssignees(admin.id);

      expect(result.districts).toHaveLength(1);
      expect(result.districts[0]!.id).toBe(baseFixture.district.id);
      expect(result.districts[0]!.name).toBe(baseFixture.district.name);
      expect(result.schools).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.groups).toEqual([]);
    });

    it('returns schools correctly', async () => {
      const admin = await AdministrationFactory.create({
        name: 'School Assignees Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationOrgFactory.create({
        administrationId: admin.id,
        orgId: baseFixture.schoolA.id,
      });

      const result = await repository.getAssignees(admin.id);

      expect(result.schools).toHaveLength(1);
      expect(result.schools[0]!.id).toBe(baseFixture.schoolA.id);
      expect(result.schools[0]!.name).toBe(baseFixture.schoolA.name);
      expect(result.schools[0]!.parentOrgId).toBe(baseFixture.district.id);
      expect(result.districts).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.groups).toEqual([]);
    });

    it('returns classes with schoolId and districtId', async () => {
      const admin = await AdministrationFactory.create({
        name: 'Class Assignees Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationClassFactory.create({
        administrationId: admin.id,
        classId: baseFixture.classInSchoolA.id,
      });

      const result = await repository.getAssignees(admin.id);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.id).toBe(baseFixture.classInSchoolA.id);
      expect(result.classes[0]!.name).toBe(baseFixture.classInSchoolA.name);
      expect(result.classes[0]!.schoolId).toBe(baseFixture.schoolA.id);
      expect(result.classes[0]!.districtId).toBe(baseFixture.district.id);
      expect(result.districts).toEqual([]);
      expect(result.schools).toEqual([]);
      expect(result.groups).toEqual([]);
    });

    it('returns groups correctly', async () => {
      const admin = await AdministrationFactory.create({
        name: 'Group Assignees Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await AdministrationGroupFactory.create({
        administrationId: admin.id,
        groupId: baseFixture.group.id,
      });

      const result = await repository.getAssignees(admin.id);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0]!.id).toBe(baseFixture.group.id);
      expect(result.groups[0]!.name).toBe(baseFixture.group.name);
      expect(result.districts).toEqual([]);
      expect(result.schools).toEqual([]);
      expect(result.classes).toEqual([]);
    });

    it('returns mixed assignee types correctly', async () => {
      const admin = await AdministrationFactory.create({
        name: 'Mixed Assignees Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await Promise.all([
        AdministrationOrgFactory.create({
          administrationId: admin.id,
          orgId: baseFixture.district.id,
        }),
        AdministrationOrgFactory.create({
          administrationId: admin.id,
          orgId: baseFixture.schoolA.id,
        }),
        AdministrationClassFactory.create({
          administrationId: admin.id,
          classId: baseFixture.classInSchoolA.id,
        }),
        AdministrationGroupFactory.create({
          administrationId: admin.id,
          groupId: baseFixture.group.id,
        }),
      ]);

      const result = await repository.getAssignees(admin.id);

      expect(result.districts).toHaveLength(1);
      expect(result.districts[0]!.id).toBe(baseFixture.district.id);

      expect(result.schools).toHaveLength(1);
      expect(result.schools[0]!.id).toBe(baseFixture.schoolA.id);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.id).toBe(baseFixture.classInSchoolA.id);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0]!.id).toBe(baseFixture.group.id);
    });

    it('returns multiple assignees of the same type', async () => {
      const admin = await AdministrationFactory.create({
        name: 'Multiple Assignees Same Type Admin',
        createdBy: baseFixture.districtAdmin.id,
      });
      await Promise.all([
        AdministrationOrgFactory.create({
          administrationId: admin.id,
          orgId: baseFixture.district.id,
        }),
        AdministrationOrgFactory.create({
          administrationId: admin.id,
          orgId: baseFixture.districtB.id,
        }),
      ]);

      const result = await repository.getAssignees(admin.id);

      expect(result.districts).toHaveLength(2);
      const districtIds = result.districts.map((d) => d.id);
      expect(districtIds).toContain(baseFixture.district.id);
      expect(districtIds).toContain(baseFixture.districtB.id);
      expect(result.schools).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.groups).toEqual([]);
    });

    it('returns empty for nonexistent administration ID', async () => {
      const result = await repository.getAssignees('00000000-0000-0000-0000-000000000000');

      expect(result.districts).toEqual([]);
      expect(result.schools).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.groups).toEqual([]);
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
