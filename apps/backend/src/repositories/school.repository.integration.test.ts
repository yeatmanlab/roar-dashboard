/**
 * Integration tests for SchoolRepository.
 *
 * Tests custom methods (listAll, listAllByDistrictId, listAccessibleByDistrictId,
 * getUnrestrictedById, fetchSchoolCounts) against the real database with the base
 * fixture's org hierarchy.
 *
 * Verifies SQL correctness and proper filtering by orgType, rosteringEnded, etc.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SortOrder } from '@roar-dashboard/api-contract';
import { baseFixture } from '../test-support/fixtures';
import { ClassFactory } from '../test-support/factories/class.factory';
import { OrgFactory } from '../test-support/factories/org.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import type { SchoolWithCounts } from './school.repository';
import { SchoolRepository } from './school.repository';
import { OrgType } from '../enums/org-type.enum';
import { UserRole } from '../enums/user-role.enum';

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

    it('includes ended classes in counts when includeEnded=true', async () => {
      // Create a school with one active class and one ended class
      const school = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'School with Ended Class',
        parentOrgId: baseFixture.district.id,
      });

      await ClassFactory.create({
        name: 'Active Class',
        schoolId: school.id,
        districtId: baseFixture.district.id,
      });

      await ClassFactory.create({
        name: 'Ended Class',
        schoolId: school.id,
        districtId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      // With includeEnded=true, both classes should be counted
      const resultWithEnded = (await repository.listAll({
        page: 1,
        perPage: 1000,
        embedCounts: true,
        includeEnded: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const schoolWithEnded = resultWithEnded.items.find((s) => s.id === school.id);
      expect(schoolWithEnded?.counts?.classes).toBe(2);

      // With includeEnded=false, only the active class should be counted
      const resultWithoutEnded = (await repository.listAll({
        page: 1,
        perPage: 1000,
        embedCounts: true,
        includeEnded: false,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const schoolWithoutEnded = resultWithoutEnded.items.find((s) => s.id === school.id);
      expect(schoolWithoutEnded?.counts?.classes).toBe(1);
    });
  });

  describe('listAccessibleByDistrictId', () => {
    it('returns only schools that are both in the district and in the provided ID set', async () => {
      const result = await repository.listAccessibleByDistrictId(
        baseFixture.district.id,
        [baseFixture.schoolA.id, baseFixture.schoolB.id],
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((s) => s.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(baseFixture.schoolB.id);
    });

    it('excludes school IDs that belong to a different district', async () => {
      // schoolInDistrictB is a real school but belongs to districtB, not district
      const result = await repository.listAccessibleByDistrictId(
        baseFixture.district.id,
        [baseFixture.schoolA.id, baseFixture.schoolInDistrictB.id],
        { page: 1, perPage: 100 },
      );

      const ids = result.items.map((s) => s.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).not.toContain(baseFixture.schoolInDistrictB.id);
    });

    it('excludes school IDs not present in the provided set', async () => {
      const result = await repository.listAccessibleByDistrictId(baseFixture.district.id, [baseFixture.schoolA.id], {
        page: 1,
        perPage: 100,
      });

      const ids = result.items.map((s) => s.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).not.toContain(baseFixture.schoolB.id);
    });

    it('returns empty when the ID set is empty', async () => {
      const result = await repository.listAccessibleByDistrictId(baseFixture.district.id, [], {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });

    it('excludes ended schools by default', async () => {
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School for Accessible Test',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      const result = await repository.listAccessibleByDistrictId(
        baseFixture.district.id,
        [baseFixture.schoolA.id, endedSchool.id],
        { page: 1, perPage: 100, includeEnded: false },
      );

      const ids = result.items.map((s) => s.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).not.toContain(endedSchool.id);
    });

    it('includes ended schools when includeEnded=true', async () => {
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Ended School for Accessible Include Test',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2020-01-01'),
      });

      const result = await repository.listAccessibleByDistrictId(
        baseFixture.district.id,
        [baseFixture.schoolA.id, endedSchool.id],
        { page: 1, perPage: 100, includeEnded: true },
      );

      const ids = result.items.map((s) => s.id);
      expect(ids).toContain(baseFixture.schoolA.id);
      expect(ids).toContain(endedSchool.id);
    });

    it('attaches counts when embedCounts=true', async () => {
      const result = (await repository.listAccessibleByDistrictId(baseFixture.district.id, [baseFixture.schoolA.id], {
        page: 1,
        perPage: 100,
        embedCounts: true,
      })) as { items: SchoolWithCounts[]; totalItems: number };

      const school = result.items.find((s) => s.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect(school?.counts).toMatchObject({
        users: expect.any(Number),
        classes: expect.any(Number),
      });
      expect(school?.counts).not.toHaveProperty('schools');
    });

    it('omits counts when embedCounts=false', async () => {
      const result = await repository.listAccessibleByDistrictId(baseFixture.district.id, [baseFixture.schoolA.id], {
        page: 1,
        perPage: 100,
        embedCounts: false,
      });

      const school = result.items.find((s) => s.id === baseFixture.schoolA.id);
      expect(school).toBeDefined();
      expect((school as SchoolWithCounts).counts).toBeUndefined();
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

  describe('getUsersBySchoolId', () => {
    // baseFixture.schoolA has users enrolled at both org and class levels:
    // - schoolAStudent (org-level student)
    // - schoolATeacher (org-level teacher)
    // - schoolAAdmin (org-level administrator)
    // - schoolAPrincipal (org-level principal)
    // - classAStudent (class-level student in classInSchoolA)
    // - classATeacher (class-level teacher in classInSchoolA)

    it('returns all enrolled users for a school (org + class)', async () => {
      const result = await repository.getUsersBySchoolId(baseFixture.schoolA.id, {
        page: 1,
        perPage: 100,
      });

      // Should include both org-level and class-level users
      expect(result.totalItems).toBeGreaterThanOrEqual(6);
      const userIds = result.items.map((u) => u.id);

      // Org-level users
      expect(userIds).toContain(baseFixture.schoolAStudent.id);
      expect(userIds).toContain(baseFixture.schoolATeacher.id);
      expect(userIds).toContain(baseFixture.schoolAAdmin.id);
      expect(userIds).toContain(baseFixture.schoolAPrincipal.id);

      // Class-level users
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);

      // Should NOT include users from other schools
      expect(userIds).not.toContain(baseFixture.schoolBStudent.id);

      // Should NOT include future enrollments
      expect(userIds).not.toContain(baseFixture.futureEnrollmentStudent.id);
    });

    it('returns empty for school with no enrolled users', async () => {
      const emptySchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Empty School',
        parentOrgId: baseFixture.district.id,
      });

      const result = await repository.getUsersBySchoolId(emptySchool.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('respects pagination', async () => {
      const paginationSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Pagination School',
        parentOrgId: baseFixture.district.id,
      });

      const user1 = await UserFactory.create({ nameLast: 'Alpha' });
      const user2 = await UserFactory.create({ nameLast: 'Beta' });

      await UserOrgFactory.create({
        orgId: paginationSchool.id,
        userId: user1.id,
        role: UserRole.STUDENT,
      });

      await UserOrgFactory.create({
        orgId: paginationSchool.id,
        userId: user2.id,
        role: UserRole.STUDENT,
      });

      const page1 = await repository.getUsersBySchoolId(paginationSchool.id, {
        page: 1,
        perPage: 1,
      });

      expect(page1.items).toHaveLength(1);
      expect(page1.totalItems).toBe(2);

      const page2 = await repository.getUsersBySchoolId(paginationSchool.id, {
        page: 2,
        perPage: 1,
      });

      expect(page2.items).toHaveLength(1);
      expect(page2.totalItems).toBe(2);

      // Pages should have different users
      expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
    });

    it('applies default sorting by nameLast ascending when no orderBy specified', async () => {
      const sortTestSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'getUsersBySchoolId Sort Test School',
        parentOrgId: baseFixture.district.id,
      });
      const studentZ = await UserFactory.create({ nameLast: 'Zulu' });
      const studentA = await UserFactory.create({ nameLast: 'Alpha' });
      const studentM = await UserFactory.create({ nameLast: 'Mike' });
      await UserOrgFactory.create({ userId: studentZ.id, orgId: sortTestSchool.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: studentA.id, orgId: sortTestSchool.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: studentM.id, orgId: sortTestSchool.id, role: UserRole.STUDENT });

      const result = await repository.getUsersBySchoolId(sortTestSchool.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.nameLast).toBe('Alpha');
      expect(result.items[1]!.nameLast).toBe('Mike');
      expect(result.items[2]!.nameLast).toBe('Zulu');
    });

    it('applies sorting by username descending', async () => {
      const usernameTestSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'getUsersBySchoolId Username Sort Test',
        parentOrgId: baseFixture.district.id,
      });
      const userA = await UserFactory.create({ username: 'aaa_user' });
      const userZ = await UserFactory.create({ username: 'zzz_user' });
      const userM = await UserFactory.create({ username: 'mmm_user' });
      await UserOrgFactory.create({ userId: userA.id, orgId: usernameTestSchool.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: userZ.id, orgId: usernameTestSchool.id, role: UserRole.STUDENT });
      await UserOrgFactory.create({ userId: userM.id, orgId: usernameTestSchool.id, role: UserRole.STUDENT });

      const result = await repository.getUsersBySchoolId(usernameTestSchool.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'username', direction: SortOrder.DESC },
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.username).toBe('zzz_user');
      expect(result.items[1]!.username).toBe('mmm_user');
      expect(result.items[2]!.username).toBe('aaa_user');
    });

    it('excludes users with expired org enrollment', async () => {
      const schoolWithExpiredEnrollment = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Expired Enrollment School',
        parentOrgId: baseFixture.district.id,
      });

      await UserOrgFactory.create({
        userId: baseFixture.expiredEnrollmentStudent.id,
        orgId: schoolWithExpiredEnrollment.id,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        enrollmentEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      await UserOrgFactory.create({
        userId: baseFixture.schoolAStudent.id,
        orgId: schoolWithExpiredEnrollment.id,
        role: UserRole.STUDENT,
      });

      const result = await repository.getUsersBySchoolId(schoolWithExpiredEnrollment.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(1); // Only active users
      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(baseFixture.schoolAStudent.id);
      expect(userIds).not.toContain(baseFixture.expiredEnrollmentStudent.id);
    });

    it('excludes users with expired class enrollment', async () => {
      const schoolWithExpiredClass = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Expired Class Enrollment School',
        parentOrgId: baseFixture.district.id,
      });

      const classInSchool = await ClassFactory.create({
        name: 'Test Class',
        schoolId: schoolWithExpiredClass.id,
        districtId: baseFixture.district.id,
      });

      await UserClassFactory.create({
        userId: baseFixture.expiredClassStudent.id,
        classId: classInSchool.id,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        enrollmentEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      await UserClassFactory.create({
        userId: baseFixture.classAStudent.id,
        classId: classInSchool.id,
        role: UserRole.STUDENT,
      });

      const result = await repository.getUsersBySchoolId(schoolWithExpiredClass.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(1); // Only active users
      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('returns empty for school with rosteringEnded', async () => {
      const expiredSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Expired School',
        parentOrgId: baseFixture.district.id,
        rosteringEnded: new Date('2023-12-31'),
      });

      const student = await UserFactory.create({ nameLast: 'ExpiredSchoolStudent' });
      await UserOrgFactory.create({
        userId: student.id,
        orgId: expiredSchool.id,
        role: UserRole.STUDENT,
      });

      const result = await repository.getUsersBySchoolId(expiredSchool.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('excludes users from classes with rosteringEnded', async () => {
      const schoolWithEndedClass = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'School with Ended Class',
        parentOrgId: baseFixture.district.id,
      });

      const endedClass = await ClassFactory.create({
        name: 'Ended Class',
        schoolId: schoolWithEndedClass.id,
        districtId: baseFixture.district.id,
        rosteringEnded: new Date('2023-12-31'),
      });

      const student = await UserFactory.create({ nameLast: 'EndedClassStudent' });
      await UserClassFactory.create({
        userId: student.id,
        classId: endedClass.id,
        role: UserRole.STUDENT,
      });

      const result = await repository.getUsersBySchoolId(schoolWithEndedClass.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('deduplicates users enrolled at both org and class levels', async () => {
      const dedupSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: 'Dedup School',
        parentOrgId: baseFixture.district.id,
      });

      const dedupClass = await ClassFactory.create({
        name: 'Dedup Class',
        schoolId: dedupSchool.id,
        districtId: baseFixture.district.id,
      });

      const dualEnrolledUser = await UserFactory.create({ nameLast: 'DualEnrolled' });

      // Enroll at both org and class level
      await UserOrgFactory.create({
        userId: dualEnrolledUser.id,
        orgId: dedupSchool.id,
        role: UserRole.STUDENT,
      });

      await UserClassFactory.create({
        userId: dualEnrolledUser.id,
        classId: dedupClass.id,
        role: UserRole.TEACHER,
      });

      const result = await repository.getUsersBySchoolId(dedupSchool.id, {
        page: 1,
        perPage: 100,
      });

      // User should appear exactly once
      const userIds = result.items.map((u) => u.id);
      const matchingUsers = userIds.filter((id) => id === dualEnrolledUser.id);
      expect(matchingUsers).toHaveLength(1);

      // User should have both roles aggregated
      const user = result.items.find((u) => u.id === dualEnrolledUser.id);
      expect(user?.roles).toContain(UserRole.STUDENT);
      expect(user?.roles).toContain(UserRole.TEACHER);
    });

    describe('filters', () => {
      it('filters by role', async () => {
        const filterTestSchool = await OrgFactory.create({
          orgType: OrgType.SCHOOL,
          name: 'Filter Role Test School',
          parentOrgId: baseFixture.district.id,
        });
        const student1 = await UserFactory.create({ nameLast: 'FilterStudent1' });
        const student2 = await UserFactory.create({ nameLast: 'FilterStudent2' });
        const teacher = await UserFactory.create({ nameLast: 'FilterTeacher' });
        await UserOrgFactory.create({ userId: student1.id, orgId: filterTestSchool.id, role: UserRole.STUDENT });
        await UserOrgFactory.create({ userId: student2.id, orgId: filterTestSchool.id, role: UserRole.STUDENT });
        await UserOrgFactory.create({ userId: teacher.id, orgId: filterTestSchool.id, role: UserRole.TEACHER });

        const result = await repository.getUsersBySchoolId(filterTestSchool.id, {
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

        // Verify all returned users have the filtered role
        for (const user of result.items) {
          expect(user.roles).toContain(UserRole.STUDENT);
        }
      });

      it('filters by grade', async () => {
        const filterGradeSchool = await OrgFactory.create({
          orgType: OrgType.SCHOOL,
          name: 'Filter Grade Test School',
          parentOrgId: baseFixture.district.id,
        });
        const grade3Student = await UserFactory.create({ nameLast: 'Grade3', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'Grade5', grade: '5' });
        const grade5Student2 = await UserFactory.create({ nameLast: 'Grade5Second', grade: '5' });
        await UserOrgFactory.create({
          userId: grade3Student.id,
          orgId: filterGradeSchool.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: grade5Student.id,
          orgId: filterGradeSchool.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: grade5Student2.id,
          orgId: filterGradeSchool.id,
          role: UserRole.STUDENT,
        });

        const result = await repository.getUsersBySchoolId(filterGradeSchool.id, {
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
        const filterBothSchool = await OrgFactory.create({
          orgType: OrgType.SCHOOL,
          name: 'Filter Both Test School',
          parentOrgId: baseFixture.district.id,
        });
        const grade3Student = await UserFactory.create({ nameLast: 'G3Student', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'G5Student', grade: '5' });
        const grade5Teacher = await UserFactory.create({ nameLast: 'G5Teacher', grade: '5' });
        await UserOrgFactory.create({
          userId: grade3Student.id,
          orgId: filterBothSchool.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: grade5Student.id,
          orgId: filterBothSchool.id,
          role: UserRole.STUDENT,
        });
        await UserOrgFactory.create({
          userId: grade5Teacher.id,
          orgId: filterBothSchool.id,
          role: UserRole.TEACHER,
        });

        const result = await repository.getUsersBySchoolId(filterBothSchool.id, {
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
        const noMatchSchool = await OrgFactory.create({
          orgType: OrgType.SCHOOL,
          name: 'No Match Filter Test School',
          parentOrgId: baseFixture.district.id,
        });
        const student = await UserFactory.create({ nameLast: 'OnlyStudent' });
        await UserOrgFactory.create({ userId: student.id, orgId: noMatchSchool.id, role: UserRole.STUDENT });

        const result = await repository.getUsersBySchoolId(noMatchSchool.id, {
          page: 1,
          perPage: 100,
          role: UserRole.ADMINISTRATOR,
        });

        expect(result.totalItems).toBe(0);
        expect(result.items).toEqual([]);
      });
    });
  });

  describe('getDistinctRootOrgIds', () => {
    // Base fixture school → district mapping:
    //   schoolA          → district
    //   schoolB          → district
    //   schoolInDistrictB → districtB

    it('returns empty array when called with no ids', async () => {
      const result = await repository.getDistinctRootOrgIds([]);

      expect(result).toEqual([]);
    });

    it('returns the district for a single school', async () => {
      const result = await repository.getDistinctRootOrgIds([baseFixture.schoolA.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('deduplicates when multiple schools share the same district', async () => {
      // schoolA and schoolB both belong to district
      const result = await repository.getDistinctRootOrgIds([baseFixture.schoolA.id, baseFixture.schoolB.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns multiple districts when schools span different roots', async () => {
      const result = await repository.getDistinctRootOrgIds([baseFixture.schoolA.id, baseFixture.schoolInDistrictB.id]);

      const ids = result.map((r) => r.id);
      expect(ids).toHaveLength(2);
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).toContain(baseFixture.districtB.id);
    });

    it('returns empty array for a non-existent school id', async () => {
      const result = await repository.getDistinctRootOrgIds(['00000000-0000-0000-0000-000000000000']);

      expect(result).toEqual([]);
    });
  });
});
