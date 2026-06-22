/**
 * Integration tests for AdministrationRepository.
 *
 * Tests custom methods (listAll, getAssignedUserCountsByAdministrationIds, getAssignees) against the
 * real database with the base fixture's org hierarchy and administrations.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { AdministrationFactory } from '../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../test-support/factories/administration-org.factory';
import { AdministrationClassFactory } from '../test-support/factories/administration-class.factory';
import { AdministrationGroupFactory } from '../test-support/factories/administration-group.factory';
import { ClassFactory } from '../test-support/factories/class.factory';
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

  describe('search filter', () => {
    // A unique, namespaced token so these search admins can't collide with the
    // fixture's administrations or with admins created by other tests in this file.
    // Each admin's name embeds the token so an ilike '%token%' matches all three.
    const token = `Zephyr-${Math.random().toString(36).slice(2, 8)}`;
    let matchAlphaId: string;
    let matchBetaId: string;
    let matchUpperId: string;

    beforeAll(async () => {
      const [alpha, beta, upper] = await Promise.all([
        AdministrationFactory.create({
          name: `${token} Reading Screener Alpha`,
          createdBy: baseFixture.districtAdmin.id,
        }),
        AdministrationFactory.create({
          name: `Winter ${token} Benchmark Beta`,
          createdBy: baseFixture.districtAdmin.id,
        }),
        // Same token but upper-cased to prove case-insensitive matching.
        AdministrationFactory.create({
          name: `${token.toUpperCase()} Gamma`,
          createdBy: baseFixture.districtAdmin.id,
        }),
      ]);
      matchAlphaId = alpha.id;
      matchBetaId = beta.id;
      matchUpperId = upper.id;
    });

    describe('listAll (super-admin path)', () => {
      it('returns only administrations whose name contains the search term', async () => {
        const result = await repository.listAll({ page: 1, perPage: 100, search: token });

        const ids = result.items.map((a) => a.id).sort();
        expect(ids).toEqual([matchAlphaId, matchBetaId, matchUpperId].sort());
        // totalItems reflects the filtered set, not the whole table.
        expect(result.totalItems).toBe(3);
      });

      it('matches case-insensitively', async () => {
        const result = await repository.listAll({ page: 1, perPage: 100, search: token.toLowerCase() });

        const ids = result.items.map((a) => a.id);
        expect(ids).toContain(matchAlphaId);
        expect(ids).toContain(matchBetaId);
        // The upper-cased admin must also match a lower-cased search term.
        expect(ids).toContain(matchUpperId);
        expect(result.totalItems).toBe(3);
      });

      it('matches an interior substring of the name', async () => {
        // "Benchmark Beta" only appears in the beta admin's name.
        const result = await repository.listAll({ page: 1, perPage: 100, search: 'Benchmark Beta' });

        const ids = result.items.map((a) => a.id);
        expect(ids).toContain(matchBetaId);
        expect(ids).not.toContain(matchAlphaId);
        expect(ids).not.toContain(matchUpperId);
      });

      it('treats a whitespace-only search as no filter', async () => {
        const filtered = await repository.listAll({ page: 1, perPage: 100, search: '   ' });
        const unfiltered = await repository.listAll({ page: 1, perPage: 100 });

        expect(filtered.totalItems).toBe(unfiltered.totalItems);
      });

      it('respects pagination over the filtered set (totalItems = filtered count)', async () => {
        const page1 = await repository.listAll({
          page: 1,
          perPage: 2,
          search: token,
          orderBy: { field: 'name', direction: 'asc' },
        });

        // 3 matches, perPage 2 → first page has 2 items but totalItems still reports 3.
        expect(page1.items.length).toBe(2);
        expect(page1.totalItems).toBe(3);

        const page2 = await repository.listAll({
          page: 2,
          perPage: 2,
          search: token,
          orderBy: { field: 'name', direction: 'asc' },
        });
        expect(page2.items.length).toBe(1);
        expect(page2.totalItems).toBe(3);
      });

      it('ANDs the search term with the status filter', async () => {
        // All three search admins use the factory's default active window (dateStart in
        // the recent past, dateEnd in the near future), so status=active keeps them and
        // status=past removes them — proving search is combined with status, not replaced.
        const active = await repository.listAll({ page: 1, perPage: 100, search: token, status: 'active' });
        const activeIds = active.items.map((a) => a.id).sort();
        expect(activeIds).toEqual([matchAlphaId, matchBetaId, matchUpperId].sort());

        const past = await repository.listAll({ page: 1, perPage: 100, search: token, status: 'past' });
        const pastIds = past.items.map((a) => a.id);
        expect(pastIds).not.toContain(matchAlphaId);
        expect(pastIds).not.toContain(matchBetaId);
        expect(pastIds).not.toContain(matchUpperId);
      });
    });

    describe('getByIds (authorized / non-super-admin path)', () => {
      it('narrows the authorized id set by the search term', async () => {
        // Simulate the FGA-resolved id set for a non-super-admin: pass all three
        // matching admins plus an unrelated one. Search must keep only name matches.
        const unrelated = await AdministrationFactory.create({
          name: 'Completely Different Admin',
          createdBy: baseFixture.districtAdmin.id,
        });

        const authorizedIds = [matchAlphaId, matchBetaId, matchUpperId, unrelated.id];
        const result = await repository.getByIds(authorizedIds, { page: 1, perPage: 100, search: token });

        const ids = result.items.map((a) => a.id).sort();
        expect(ids).toEqual([matchAlphaId, matchBetaId, matchUpperId].sort());
        expect(result.totalItems).toBe(3);
      });

      it('never widens beyond the authorized id set', async () => {
        // Only one matching admin is authorized; the other two match the term but
        // are not in the id set, so they must not appear.
        const result = await repository.getByIds([matchAlphaId], { page: 1, perPage: 100, search: token });

        const ids = result.items.map((a) => a.id);
        expect(ids).toEqual([matchAlphaId]);
        expect(result.totalItems).toBe(1);
      });

      it('matches case-insensitively within the authorized set', async () => {
        const result = await repository.getByIds([matchUpperId], {
          page: 1,
          perPage: 100,
          search: token.toLowerCase(),
        });

        expect(result.items.map((a) => a.id)).toEqual([matchUpperId]);
        expect(result.totalItems).toBe(1);
      });

      it('ANDs the search term with the status filter on the authorized path', async () => {
        const authorizedIds = [matchAlphaId, matchBetaId, matchUpperId];

        const active = await repository.getByIds(authorizedIds, {
          page: 1,
          perPage: 100,
          search: token,
          status: 'active',
        });
        expect(active.items.map((a) => a.id).sort()).toEqual([...authorizedIds].sort());

        const past = await repository.getByIds(authorizedIds, {
          page: 1,
          perPage: 100,
          search: token,
          status: 'past',
        });
        expect(past.items).toHaveLength(0);
        expect(past.totalItems).toBe(0);
      });

      it('respects pagination over the filtered, authorized set', async () => {
        const authorizedIds = [matchAlphaId, matchBetaId, matchUpperId];
        const page1 = await repository.getByIds(authorizedIds, {
          page: 1,
          perPage: 2,
          search: token,
          orderBy: { field: 'name', direction: 'asc' },
        });

        expect(page1.items.length).toBe(2);
        expect(page1.totalItems).toBe(3);
      });
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

      // classInSchoolA has 3 active users (classAStudent, classATeacher, schoolAStudent); expiredClassStudent excluded
      expect(counts.get(baseFixture.administrationAssignedToClassA.id)).toBe(3);
    });

    it('counts users via org hierarchy paths (viaOrgToOrgUsers and viaOrgToClassUsers)', async () => {
      const counts = await repository.getAssignedUserCountsByAdministrationIds([
        baseFixture.administrationAssignedToDistrict.id,
      ]);

      // administrationAssignedToDistrict is assigned to district, which via ltree includes:
      // - viaOrgToOrgUsers: districtAdmin, schoolAAdmin, schoolAPrincipal, schoolATeacher, multiAssignedUser (district+schoolA)
      // - viaOrgToClassUsers (students now enroll at the class level): classAStudent, classATeacher, schoolAStudent
      //   (classInSchoolA); schoolBStudent (classInSchoolB); grade5Student, grade3Student, grade5EllStudent (classInSchoolC)
      // Excluded: expiredEnrollmentStudent, futureEnrollmentStudent, expiredClassStudent
      const count = counts.get(baseFixture.administrationAssignedToDistrict.id);
      expect(count).toBe(12);
    });

    it('deduplicates users reachable via multiple paths', async () => {
      // multiAssignedUser has active enrollments at both district AND schoolA. Both orgs are in the
      // district subtree, so viaOrgToOrgUsers emits two rows for them (one per enrollment).
      // The full UNION ALL produces 13 rows (11 single-path users — 4 org-level + 7 class-level — plus 2 rows for multiAssignedUser),
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
      expect(counts.get(baseFixture.administrationAssignedToClassA.id)).toBe(3);
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

      // schoolA has 4 active org-level users (schoolAAdmin, schoolAPrincipal, schoolATeacher,
      // multiAssignedUser) + 3 active class-level users in classInSchoolA (classAStudent, classATeacher,
      // schoolAStudent). expiredEnrollmentStudent's enrollment ended 7 days ago and must be excluded.
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

      // expiredClassStudent (and expired/future enrollment students) are excluded for inactive enrollments
      // Active in classInSchoolA: classAStudent, classATeacher, schoolAStudent
      expect(counts.get(baseFixture.administrationAssignedToClassA.id)).toBe(3);
    });

    it('throws when called with an empty administrationIds array', async () => {
      await expect(repository.getAssignedUserCountsByAdministrationIds([])).rejects.toThrow();
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

  describe('getTreeNodes', () => {
    const defaultOptions = { page: 1, perPage: 25 };

    describe('root level (no parent)', () => {
      it('returns districts directly assigned to the administration', async () => {
        // administrationAssignedToDistrict has baseFixture.district via administration_orgs
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          undefined,
          undefined,
          defaultOptions,
        );

        const ids = result.items.map((item) => item.id);
        expect(ids).toContain(baseFixture.district.id);

        const districtNode = result.items.find((item) => item.id === baseFixture.district.id);
        expect(districtNode).toBeDefined();
        expect(districtNode!.entityType).toBe('district');
        expect(districtNode!.name).toBe(baseFixture.district.name);
      });

      it('returns all 4 entity types when all are directly assigned', async () => {
        const admin = await AdministrationFactory.create({
          name: 'Tree All Types Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await Promise.all([
          AdministrationOrgFactory.create({ administrationId: admin.id, orgId: baseFixture.district.id }),
          AdministrationOrgFactory.create({ administrationId: admin.id, orgId: baseFixture.schoolA.id }),
          AdministrationClassFactory.create({ administrationId: admin.id, classId: baseFixture.classInSchoolB.id }),
          AdministrationGroupFactory.create({ administrationId: admin.id, groupId: baseFixture.group.id }),
        ]);

        const result = await repository.getTreeNodes(admin.id, undefined, undefined, defaultOptions);

        const entityTypes = result.items.map((item) => item.entityType);
        expect(entityTypes).toContain('district');
        expect(entityTypes).toContain('school');
        expect(entityTypes).toContain('class');
        expect(entityTypes).toContain('group');
        expect(result.totalItems).toBe(4);
      });

      it('filters by FGA accessible district IDs when provided', async () => {
        // Create admin assigned to both districts
        const admin = await AdministrationFactory.create({
          name: 'Tree FGA Filter Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await Promise.all([
          AdministrationOrgFactory.create({ administrationId: admin.id, orgId: baseFixture.district.id }),
          AdministrationOrgFactory.create({ administrationId: admin.id, orgId: baseFixture.districtB.id }),
        ]);

        // Only district A is accessible
        const result = await repository.getTreeNodes(admin.id, undefined, undefined, defaultOptions, {
          districtIds: [baseFixture.district.id],
        });

        const ids = result.items.map((item) => item.id);
        expect(ids).toContain(baseFixture.district.id);
        expect(ids).not.toContain(baseFixture.districtB.id);
      });

      it('returns empty when FGA provides an empty accessible list', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          undefined,
          undefined,
          defaultOptions,
          { districtIds: [], groupIds: [] },
        );

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('returns empty for an administration with no assignments', async () => {
        const emptyAdmin = await AdministrationFactory.create({
          name: 'Tree Empty Admin Test',
          createdBy: baseFixture.districtAdmin.id,
        });

        const result = await repository.getTreeNodes(emptyAdmin.id, undefined, undefined, defaultOptions);

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });
    });

    describe('hasChildren', () => {
      it('district has hasChildren=true when it has child schools', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          undefined,
          undefined,
          defaultOptions,
        );

        const districtNode = result.items.find((item) => item.id === baseFixture.district.id);
        expect(districtNode).toBeDefined();
        // baseFixture.district has schoolA and schoolB
        expect(districtNode!.hasChildren).toBe(true);
      });

      it('class and group nodes always have hasChildren=false', async () => {
        const admin = await AdministrationFactory.create({
          name: 'Tree hasChildren Leaf Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await Promise.all([
          AdministrationClassFactory.create({ administrationId: admin.id, classId: baseFixture.classInSchoolA.id }),
          AdministrationGroupFactory.create({ administrationId: admin.id, groupId: baseFixture.group.id }),
        ]);

        const result = await repository.getTreeNodes(admin.id, undefined, undefined, defaultOptions);

        for (const item of result.items) {
          expect(item.hasChildren).toBe(false);
        }
      });
    });

    describe('district drill-down', () => {
      it('returns all child schools of the district', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'district',
          baseFixture.district.id,
          defaultOptions,
        );

        const ids = result.items.map((item) => item.id);
        // baseFixture.district has schoolA, schoolB, and schoolC as children
        expect(ids).toContain(baseFixture.schoolA.id);
        expect(ids).toContain(baseFixture.schoolB.id);

        for (const item of result.items) {
          expect(item.entityType).toBe('school');
        }
      });

      it('school nodes report hasChildren based on whether they have classes', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'district',
          baseFixture.district.id,
          defaultOptions,
        );

        const schoolANode = result.items.find((item) => item.id === baseFixture.schoolA.id);
        expect(schoolANode).toBeDefined();
        // schoolA has classInSchoolA
        expect(schoolANode!.hasChildren).toBe(true);
      });

      it('filters schools by FGA accessible IDs', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'district',
          baseFixture.district.id,
          defaultOptions,
          { schoolIds: [baseFixture.schoolA.id] },
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(baseFixture.schoolA.id);
      });

      it('returns empty for a district with no child schools', async () => {
        // districtB has schoolInDistrictB, but let's test with a fresh district if possible
        // Use districtB — it has one school (schoolInDistrictB)
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'district',
          '00000000-0000-0000-0000-000000000000', // non-existent district
          defaultOptions,
        );

        expect(result.items).toHaveLength(0);
      });
    });

    describe('school drill-down', () => {
      it('returns all child classes of the school', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'school',
          baseFixture.schoolA.id,
          defaultOptions,
        );

        const ids = result.items.map((item) => item.id);
        expect(ids).toContain(baseFixture.classInSchoolA.id);

        for (const item of result.items) {
          expect(item.entityType).toBe('class');
          expect(item.hasChildren).toBe(false);
        }
      });

      it('filters classes by FGA accessible IDs when empty', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'school',
          baseFixture.schoolA.id,
          defaultOptions,
          { classIds: [] }, // empty = no access
        );

        expect(result.items).toHaveLength(0);
      });

      it('filters classes to only FGA-accessible IDs when non-empty', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'school',
          baseFixture.schoolA.id,
          defaultOptions,
          { classIds: [baseFixture.classInSchoolA.id] },
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(baseFixture.classInSchoolA.id);
      });

      it('uses the fga_filter_ids temp-table JOIN when class IDs are provided', async () => {
        // Seed a second class in schoolA so the FGA filter has a non-trivial choice
        // to make. Without the temp-table join filtering correctly, both classes
        // would come back; with it, only the allow-listed one should appear.
        const allowedClass = await ClassFactory.create({
          name: 'Allowed Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const forbiddenClass = await ClassFactory.create({
          name: 'Forbidden Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });

        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'school',
          baseFixture.schoolA.id,
          defaultOptions,
          // Allow `allowedClass` and the seeded `classInSchoolA`, but not `forbiddenClass`.
          { classIds: [allowedClass.id, baseFixture.classInSchoolA.id] },
        );

        const ids = result.items.map((item) => item.id);
        expect(ids).toContain(allowedClass.id);
        expect(ids).toContain(baseFixture.classInSchoolA.id);
        expect(ids).not.toContain(forbiddenClass.id);
      });

      it('pins JOIN cardinality with a single-id filter (regression guard against degenerate JOIN)', async () => {
        // Defense-in-depth against a Drizzle SQL composition bug where the JOIN's
        // ON predicate is dropped (degenerate CROSS JOIN) or the empty-INSERT
        // branch silently produces extra rows. Pass exactly one id and assert the
        // result is exactly one row — both `items.length` and `totalItems` from
        // the COUNT(*) OVER() must agree.
        const onlyAllowedClass = await ClassFactory.create({
          name: 'Sole Allowed Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        // Two more classes in the same school act as negative controls — the
        // single-id filter should exclude them.
        await ClassFactory.create({
          name: 'Decoy Class A',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        await ClassFactory.create({
          name: 'Decoy Class B',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });

        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'school',
          baseFixture.schoolA.id,
          defaultOptions,
          { classIds: [onlyAllowedClass.id] },
        );

        expect(result.items).toHaveLength(1);
        expect(result.totalItems).toBe(1);
        expect(result.items[0]!.id).toBe(onlyAllowedClass.id);
      });
    });

    describe('leaf node drill-down', () => {
      it('returns empty for class parent', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'class',
          baseFixture.classInSchoolA.id,
          defaultOptions,
        );

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('returns empty for group parent', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToGroup.id,
          'group',
          baseFixture.group.id,
          defaultOptions,
        );

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });
    });

    describe('pagination', () => {
      it('paginates root level results', async () => {
        const admin = await AdministrationFactory.create({
          name: 'Tree Pagination Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await Promise.all([
          AdministrationOrgFactory.create({ administrationId: admin.id, orgId: baseFixture.district.id }),
          AdministrationOrgFactory.create({ administrationId: admin.id, orgId: baseFixture.districtB.id }),
          AdministrationGroupFactory.create({ administrationId: admin.id, groupId: baseFixture.group.id }),
        ]);

        const page1 = await repository.getTreeNodes(admin.id, undefined, undefined, { page: 1, perPage: 2 });
        expect(page1.items).toHaveLength(2);
        expect(page1.totalItems).toBe(3);

        const page2 = await repository.getTreeNodes(admin.id, undefined, undefined, { page: 2, perPage: 2 });
        expect(page2.items).toHaveLength(1);
        expect(page2.totalItems).toBe(3);

        // No overlap between pages
        const page1Ids = page1.items.map((item) => item.id);
        const page2Ids = page2.items.map((item) => item.id);
        for (const id of page2Ids) {
          expect(page1Ids).not.toContain(id);
        }
      });

      it('sorts by name ascending with id tiebreaker', async () => {
        const result = await repository.getTreeNodes(
          baseFixture.administrationAssignedToDistrict.id,
          'district',
          baseFixture.district.id,
          { page: 1, perPage: 100 },
        );

        // Verify sorted by name
        for (let i = 1; i < result.items.length; i++) {
          const prev = result.items[i - 1]!.name.toLowerCase();
          const curr = result.items[i]!.name.toLowerCase();
          expect(prev <= curr).toBe(true);
        }
      });
    });
  });
});
