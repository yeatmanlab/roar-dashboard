/**
 * Integration tests for ClassRepository.
 *
 * Tests custom methods (getById, getUsersByClassId, listBySchoolId) against the
 * real database with the base fixture's org hierarchy and classes.
 *
 * ## BaseFixture Structure Used
 *
 * ```
 * district (District A)
 * ├── schoolA
 * │   └── classInSchoolA
 * └── schoolB
 *     └── classInSchoolB
 *
 * districtB (District B - separate branch)
 * └── schoolInDistrictB
 *     └── classInDistrictB
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SortOrder } from '@roar-dashboard/api-contract';
import { ClassRepository } from './class.repository';
import { UserRole } from '../enums/user-role.enum';
import { CoreDbClient } from '../test-support/db';
import { ClassFactory } from '../test-support/factories/class.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import { baseFixture } from '../test-support/fixtures';

describe('ClassRepository', () => {
  let repository: ClassRepository;

  beforeAll(() => {
    repository = new ClassRepository(CoreDbClient);
  });

  describe('getById (inherited)', () => {
    it('returns class when it exists', async () => {
      const result = await repository.getById({ id: baseFixture.classInSchoolA.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.classInSchoolA.id);
    });

    it('returns null for nonexistent class', async () => {
      const result = await repository.getById({ id: '00000000-0000-0000-0000-000000000000' });

      expect(result).toBeNull();
    });
  });

  describe('getUsersByClassId', () => {
    // baseFixture.classInSchoolA has exactly 2 active users:
    // - classAStudent (student)
    // - classATeacher (teacher)
    // - expiredClassStudent is excluded due to expired enrollment

    it('returns all enrolled users for a class', async () => {
      const result = await repository.getUsersByClassId(baseFixture.classInSchoolA.id, {
        page: 1,
        perPage: 100,
      });

      // Exactly 2 active users in classInSchoolA
      expect(result.totalItems).toBe(2);
      expect(result.items).toHaveLength(2);

      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      // Expired enrollment should be excluded
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('returns empty for class with no enrolled users', async () => {
      // classInSchoolB has no direct class enrollments in base fixture
      const result = await repository.getUsersByClassId(baseFixture.classInSchoolB.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('respects pagination', async () => {
      // classInSchoolA has 2 users, request 1 per page
      const page1 = await repository.getUsersByClassId(baseFixture.classInSchoolA.id, {
        page: 1,
        perPage: 1,
      });

      expect(page1.items).toHaveLength(1);
      expect(page1.totalItems).toBe(2);

      const page2 = await repository.getUsersByClassId(baseFixture.classInSchoolA.id, {
        page: 2,
        perPage: 1,
      });

      expect(page2.items).toHaveLength(1);
      expect(page2.totalItems).toBe(2);

      // Pages should have different users
      expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
    });

    it('applies default sorting by nameLast ascending when no orderBy specified', async () => {
      // Create a class with users having known lastNames for precise sorting verification
      const sortTestClass = await ClassFactory.create({
        name: 'getUsersByClassId Sort Test Class',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });
      const studentZ = await UserFactory.create({ nameLast: 'Zulu' });
      const studentA = await UserFactory.create({ nameLast: 'Alpha' });
      const studentM = await UserFactory.create({ nameLast: 'Mike' });
      await UserClassFactory.create({ userId: studentZ.id, classId: sortTestClass.id, role: UserRole.STUDENT });
      await UserClassFactory.create({ userId: studentA.id, classId: sortTestClass.id, role: UserRole.STUDENT });
      await UserClassFactory.create({ userId: studentM.id, classId: sortTestClass.id, role: UserRole.STUDENT });

      const result = await repository.getUsersByClassId(sortTestClass.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.nameLast).toBe('Alpha');
      expect(result.items[1]!.nameLast).toBe('Mike');
      expect(result.items[2]!.nameLast).toBe('Zulu');
    });

    it('applies sorting by username descending', async () => {
      // Create a class with users having known usernames for precise sorting verification
      const usernameTestClass = await ClassFactory.create({
        name: 'getUsersByClassId Username Sort Test',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });
      const userA = await UserFactory.create({ username: 'aaa_user' });
      const userZ = await UserFactory.create({ username: 'zzz_user' });
      const userM = await UserFactory.create({ username: 'mmm_user' });
      await UserClassFactory.create({ userId: userA.id, classId: usernameTestClass.id, role: UserRole.STUDENT });
      await UserClassFactory.create({ userId: userZ.id, classId: usernameTestClass.id, role: UserRole.STUDENT });
      await UserClassFactory.create({ userId: userM.id, classId: usernameTestClass.id, role: UserRole.STUDENT });

      const result = await repository.getUsersByClassId(usernameTestClass.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'username', direction: SortOrder.DESC },
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.username).toBe('zzz_user');
      expect(result.items[1]!.username).toBe('mmm_user');
      expect(result.items[2]!.username).toBe('aaa_user');
    });

    it('excludes users with expired class enrollment', async () => {
      // baseFixture.expiredClassStudent has expired enrollment in classInSchoolA
      const result = await repository.getUsersByClassId(baseFixture.classInSchoolA.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(2); // Only active users
      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(baseFixture.classAStudent.id);
      expect(userIds).toContain(baseFixture.classATeacher.id);
      expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
    });

    it('returns empty for expired class (rosteringEnded set)', async () => {
      // Create a class with rosteringEnded set
      const ClassFactory = (await import('../test-support/factories/class.factory')).ClassFactory;
      const UserClassFactory = (await import('../test-support/factories/user-class.factory')).UserClassFactory;

      const expiredClass = await ClassFactory.create({
        name: 'Expired Class',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
        rosteringEnded: new Date('2023-12-31'),
      });

      const student = await UserFactory.create({ nameLast: 'ExpiredClassStudent' });
      await UserClassFactory.create({
        userId: student.id,
        classId: expiredClass.id,
        role: UserRole.STUDENT,
      });

      // District admin should get empty results for expired class
      const result = await repository.getUsersByClassId(expiredClass.id, { page: 1, perPage: 100 });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    describe('filters', () => {
      it('filters by role', async () => {
        // Create a class with users having different roles
        const filterTestClass = await ClassFactory.create({
          name: 'Filter Role Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const student1 = await UserFactory.create({ nameLast: 'FilterStudent1' });
        const student2 = await UserFactory.create({ nameLast: 'FilterStudent2' });
        const teacher = await UserFactory.create({ nameLast: 'FilterTeacher' });
        await UserClassFactory.create({ userId: student1.id, classId: filterTestClass.id, role: UserRole.STUDENT });
        await UserClassFactory.create({ userId: student2.id, classId: filterTestClass.id, role: UserRole.STUDENT });
        await UserClassFactory.create({ userId: teacher.id, classId: filterTestClass.id, role: UserRole.TEACHER });

        const result = await repository.getUsersByClassId(filterTestClass.id, {
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
        // Create a class with users having different grades
        const filterGradeClass = await ClassFactory.create({
          name: 'Filter Grade Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const grade3Student = await UserFactory.create({ nameLast: 'Grade3', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'Grade5', grade: '5' });
        const grade5Student2 = await UserFactory.create({ nameLast: 'Grade5Second', grade: '5' });
        await UserClassFactory.create({
          userId: grade3Student.id,
          classId: filterGradeClass.id,
          role: UserRole.STUDENT,
        });
        await UserClassFactory.create({
          userId: grade5Student.id,
          classId: filterGradeClass.id,
          role: UserRole.STUDENT,
        });
        await UserClassFactory.create({
          userId: grade5Student2.id,
          classId: filterGradeClass.id,
          role: UserRole.STUDENT,
        });

        const result = await repository.getUsersByClassId(filterGradeClass.id, {
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
        // Create a class with users having different roles and grades
        const filterBothClass = await ClassFactory.create({
          name: 'Filter Both Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const grade3Student = await UserFactory.create({ nameLast: 'G3Student', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'G5Student', grade: '5' });
        const grade5Teacher = await UserFactory.create({ nameLast: 'G5Teacher', grade: '5' });
        await UserClassFactory.create({
          userId: grade3Student.id,
          classId: filterBothClass.id,
          role: UserRole.STUDENT,
        });
        await UserClassFactory.create({
          userId: grade5Student.id,
          classId: filterBothClass.id,
          role: UserRole.STUDENT,
        });
        await UserClassFactory.create({
          userId: grade5Teacher.id,
          classId: filterBothClass.id,
          role: UserRole.TEACHER,
        });

        const result = await repository.getUsersByClassId(filterBothClass.id, {
          page: 1,
          perPage: 100,
          role: UserRole.STUDENT,
          grade: ['5'],
        });

        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(grade5Student.id);
        expect(result.items[0]!.roles).toContain(UserRole.STUDENT);
      });

      it('returns empty when no users match filter', async () => {
        // Create a class with only students
        const noMatchClass = await ClassFactory.create({
          name: 'No Match Filter Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const student = await UserFactory.create({ nameLast: 'OnlyStudent' });
        await UserClassFactory.create({ userId: student.id, classId: noMatchClass.id, role: UserRole.STUDENT });

        const result = await repository.getUsersByClassId(noMatchClass.id, {
          page: 1,
          perPage: 100,
          role: UserRole.ADMINISTRATOR,
        });

        expect(result.totalItems).toBe(0);
        expect(result.items).toEqual([]);
      });
    });
  });

  describe('getDistinctRootIds', () => {
    // Base fixture class → district mapping:
    //   classInSchoolA  → schoolA  → district
    //   classInSchoolB  → schoolB  → district
    //   classInDistrictB → schoolInDistrictB → districtB

    it('returns empty array when called with no ids', async () => {
      const result = await repository.getDistinctRootIds([]);

      expect(result).toEqual([]);
    });

    it('returns the district for a single class', async () => {
      const result = await repository.getDistinctRootIds([baseFixture.classInSchoolA.id]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('deduplicates when multiple classes share the same district', async () => {
      // classInSchoolA and classInSchoolB both fall under district via different schools
      const result = await repository.getDistinctRootIds([
        baseFixture.classInSchoolA.id,
        baseFixture.classInSchoolB.id,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(baseFixture.district.id);
    });

    it('returns multiple districts when classes span different roots', async () => {
      const result = await repository.getDistinctRootIds([
        baseFixture.classInSchoolA.id,
        baseFixture.classInDistrictB.id,
      ]);

      const ids = result.map((r) => r.id);
      expect(ids).toHaveLength(2);
      expect(ids).toContain(baseFixture.district.id);
      expect(ids).toContain(baseFixture.districtB.id);
    });

    it('returns empty array for a non-existent class id', async () => {
      const result = await repository.getDistinctRootIds(['00000000-0000-0000-0000-000000000000']);

      expect(result).toEqual([]);
    });
  });
});
