/**
 * Integration tests for ClassRepository.
 *
 * Tests custom methods (getById, getAuthorizedById) against the
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
import { baseFixture } from '../test-support/fixtures';
import { ClassRepository } from './class.repository';
import { CoreDbClient } from '../test-support/db';
import { UserRole } from '../enums/user-role.enum';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { ClassFactory } from '../test-support/factories/class.factory';

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

  describe('getAuthorizedById', () => {
    describe('returns class when user has access', () => {
      it('district admin can access class in their district', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInSchoolA.id);
      });

      it('school teacher can access class in their school', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.schoolATeacher.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInSchoolA.id);
      });

      it('class student can access their class', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.classAStudent.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInSchoolA.id);
      });
    });

    describe('supervisory descendant access (district → school → class)', () => {
      it('district admin can access all classes in all schools under their district', async () => {
        // District admin should see classInSchoolA (under schoolA in district)
        const resultA = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
        );
        expect(resultA).not.toBeNull();
        expect(resultA!.id).toBe(baseFixture.classInSchoolA.id);

        // District admin should also see classInSchoolB (under schoolB in same district)
        const resultB = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolB.id,
        );
        expect(resultB).not.toBeNull();
        expect(resultB!.id).toBe(baseFixture.classInSchoolB.id);
      });

      it('district admin cannot access classes in a different district', async () => {
        // District admin (district A) should NOT see classInDistrictB
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInDistrictB.id,
        );
        expect(result).toBeNull();
      });

      it('district B admin can access classes only in their district', async () => {
        // District B admin should see classInDistrictB
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInDistrictB.id,
        );
        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInDistrictB.id);
      });

      it('multi-assigned user can access classes via district membership', async () => {
        // multiAssignedUser has ADMINISTRATOR at district and TEACHER at schoolA
        // Should be able to access classInSchoolB via district membership
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.multiAssignedUser.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolB.id,
        );
        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.classInSchoolB.id);
      });
    });

    describe('returns null when user lacks access', () => {
      it('district B admin cannot access class in district A', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).toBeNull();
      });

      it('school A teacher cannot access class in school B', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.schoolATeacher.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.classInSchoolB.id,
        );

        expect(result).toBeNull();
      });

      it('unassigned user cannot access any class', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.unassignedUser.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).toBeNull();
      });
    });

    it('returns null for nonexistent class ID', async () => {
      const result = await repository.getAuthorizedById(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        '00000000-0000-0000-0000-000000000000',
      );

      expect(result).toBeNull();
    });

    describe('enrollment date boundaries', () => {
      it('excludes user with expired enrollment', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.expiredEnrollmentStudent.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).toBeNull();
      });

      it('excludes user with future enrollment', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.futureEnrollmentStudent.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
        );

        expect(result).toBeNull();
      });
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
        orderBy: { field: 'username', direction: 'desc' },
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.username).toBe('zzz_user');
      expect(result.items[1]!.username).toBe('mmm_user');
      expect(result.items[2]!.username).toBe('aaa_user');
    });

    it('applies sorting by grade ascending', async () => {
      // Create a class with users having known grades for precise sorting verification
      const gradeTestClass = await ClassFactory.create({
        name: 'getUsersByClassId Grade Sort Test',
        schoolId: baseFixture.schoolA.id,
        districtId: baseFixture.district.id,
      });
      const student12 = await UserFactory.create({ nameLast: 'Senior', grade: '12' });
      const student3 = await UserFactory.create({ nameLast: 'Third', grade: '3' });
      const student7 = await UserFactory.create({ nameLast: 'Seventh', grade: '7' });
      await UserClassFactory.create({ userId: student12.id, classId: gradeTestClass.id, role: UserRole.STUDENT });
      await UserClassFactory.create({ userId: student3.id, classId: gradeTestClass.id, role: UserRole.STUDENT });
      await UserClassFactory.create({ userId: student7.id, classId: gradeTestClass.id, role: UserRole.STUDENT });

      const result = await repository.getUsersByClassId(gradeTestClass.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'grade', direction: 'asc' },
      });

      expect(result.items).toHaveLength(3);
      // Grades are enums sorted by definition order (numeric)
      expect(result.items[0]!.grade).toBe('3');
      expect(result.items[1]!.grade).toBe('7');
      expect(result.items[2]!.grade).toBe('12');
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

    it('returns empty for nonexistent class ID', async () => {
      const result = await repository.getUsersByClassId('00000000-0000-0000-0000-000000000000', {
        page: 1,
        perPage: 100,
      });

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
          grade: '5',
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
          grade: '5',
        });

        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(grade5Student.id);
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

  describe('getAuthorizedUsersByClassId', () => {
    // baseFixture.classInSchoolA has exactly 2 active users:
    // - classAStudent (student)
    // - classATeacher (teacher)
    // - expiredClassStudent is excluded due to expired enrollment

    describe('returns users when requester has access', () => {
      it('district admin can list users in class within their district', async () => {
        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 100 },
        );

        // Exactly 2 active users in classInSchoolA
        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);

        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(baseFixture.classAStudent.id);
        expect(userIds).toContain(baseFixture.classATeacher.id);
        // Expired enrollment should be excluded
        expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
      });

      it('school teacher can list users in class within their school', async () => {
        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.schoolATeacher.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 100 },
        );

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(baseFixture.classAStudent.id);
        expect(userIds).toContain(baseFixture.classATeacher.id);
      });

      it('class teacher can list users in their assigned class', async () => {
        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.classATeacher.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 100 },
        );

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(baseFixture.classAStudent.id);
        expect(userIds).toContain(baseFixture.classATeacher.id);
      });
    });

    describe('returns empty when requester lacks access', () => {
      it('district B admin cannot list users in class in district A', async () => {
        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 100 },
        );

        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
      });

      it('school A teacher cannot list users in class in school B', async () => {
        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.schoolATeacher.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.classInSchoolB.id,
          { page: 1, perPage: 100 },
        );

        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
      });

      it('unassigned user cannot list users in any class', async () => {
        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.unassignedUser.id, allowedRoles: [UserRole.STUDENT] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 100 },
        );

        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
      });
    });

    describe('cross-district isolation', () => {
      it('district admin can list users in classes across all schools in their district', async () => {
        // District admin should see users in classInSchoolA (2 active users)
        const resultA = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 100 },
        );
        expect(resultA.totalItems).toBe(2);
        expect(resultA.items).toHaveLength(2);

        // District admin should also see classInSchoolB (no users in baseFixture)
        const resultB = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolB.id,
          { page: 1, perPage: 100 },
        );
        expect(resultB.totalItems).toBe(0);
        expect(resultB.items).toHaveLength(0);
      });

      it('district B admin cannot access classes in district A', async () => {
        // District B admin CANNOT access classInSchoolA (in district A)
        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtBAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 100 },
        );
        expect(result.items).toEqual([]);
        expect(result.totalItems).toBe(0);
      });
    });

    describe('pagination and sorting', () => {
      it('respects pagination with baseFixture data', async () => {
        // classInSchoolA has 2 users, request 1 per page
        const page1 = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 1 },
        );

        expect(page1.items).toHaveLength(1);
        expect(page1.totalItems).toBe(2);

        const page2 = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
          { page: 2, perPage: 1 },
        );

        expect(page2.items).toHaveLength(1);
        expect(page2.totalItems).toBe(2);

        // Pages should have different users
        expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
      });

      it('applies default sorting by nameLast ascending', async () => {
        // Create a class with users having known lastNames for precise sorting verification
        const sortTestClass = await ClassFactory.create({
          name: 'Sort Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const studentZ = await UserFactory.create({ nameLast: 'Zebra' });
        const studentA = await UserFactory.create({ nameLast: 'Apple' });
        const studentM = await UserFactory.create({ nameLast: 'Mango' });
        await UserClassFactory.create({ userId: studentZ.id, classId: sortTestClass.id, role: UserRole.STUDENT });
        await UserClassFactory.create({ userId: studentA.id, classId: sortTestClass.id, role: UserRole.STUDENT });
        await UserClassFactory.create({ userId: studentM.id, classId: sortTestClass.id, role: UserRole.STUDENT });

        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          sortTestClass.id,
          { page: 1, perPage: 100 },
        );

        expect(result.items).toHaveLength(3);
        expect(result.items[0]!.nameLast).toBe('Apple');
        expect(result.items[1]!.nameLast).toBe('Mango');
        expect(result.items[2]!.nameLast).toBe('Zebra');
      });

      it('applies sorting by username descending', async () => {
        // Create a class with users having known usernames for precise sorting verification
        const usernameTestClass = await ClassFactory.create({
          name: 'Username Sort Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const userAlpha = await UserFactory.create({ username: 'alpha_user' });
        const userZeta = await UserFactory.create({ username: 'zeta_user' });
        const userMid = await UserFactory.create({ username: 'mid_user' });
        await UserClassFactory.create({ userId: userAlpha.id, classId: usernameTestClass.id, role: UserRole.STUDENT });
        await UserClassFactory.create({ userId: userZeta.id, classId: usernameTestClass.id, role: UserRole.STUDENT });
        await UserClassFactory.create({ userId: userMid.id, classId: usernameTestClass.id, role: UserRole.STUDENT });

        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          usernameTestClass.id,
          { page: 1, perPage: 100, orderBy: { field: 'username', direction: 'desc' } },
        );

        expect(result.items).toHaveLength(3);
        expect(result.items[0]!.username).toBe('zeta_user');
        expect(result.items[1]!.username).toBe('mid_user');
        expect(result.items[2]!.username).toBe('alpha_user');
      });
    });

    describe('enrollment boundaries', () => {
      it('excludes users with expired class enrollment', async () => {
        // baseFixture.expiredClassStudent has expired enrollment in classInSchoolA
        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.classInSchoolA.id,
          { page: 1, perPage: 100 },
        );

        expect(result.totalItems).toBe(2); // Only active users
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(baseFixture.classAStudent.id);
        expect(userIds).toContain(baseFixture.classATeacher.id);
        expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
      });

      it('excludes users with future enrollment start', async () => {
        // Create a class with a future enrollment user
        const futureTestClass = await ClassFactory.create({
          name: 'Future Enrollment Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const activeStudent = await UserFactory.create({ nameLast: 'ActiveNow' });
        const futureStudent = await UserFactory.create({ nameLast: 'FutureStudent' });

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        await UserClassFactory.create({
          userId: activeStudent.id,
          classId: futureTestClass.id,
          role: UserRole.STUDENT,
          enrollmentStart: new Date('2020-01-01'),
          enrollmentEnd: null,
        });
        await UserClassFactory.create({
          userId: futureStudent.id,
          classId: futureTestClass.id,
          role: UserRole.STUDENT,
          enrollmentStart: futureDate,
          enrollmentEnd: null,
        });

        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          futureTestClass.id,
          { page: 1, perPage: 100 },
        );

        expect(result.totalItems).toBe(1);
        expect(result.items[0]!.id).toBe(activeStudent.id);
      });
    });

    it('returns empty for nonexistent class ID', async () => {
      const result = await repository.getAuthorizedUsersByClassId(
        { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
        '00000000-0000-0000-0000-000000000000',
        { page: 1, perPage: 100 },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    describe('filters', () => {
      it('filters by role', async () => {
        // Create a class with users having different roles
        const filterTestClass = await ClassFactory.create({
          name: 'Authorized Filter Role Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const student1 = await UserFactory.create({ nameLast: 'AuthFilterStudent1' });
        const student2 = await UserFactory.create({ nameLast: 'AuthFilterStudent2' });
        const teacher = await UserFactory.create({ nameLast: 'AuthFilterTeacher' });
        await UserClassFactory.create({ userId: student1.id, classId: filterTestClass.id, role: UserRole.STUDENT });
        await UserClassFactory.create({ userId: student2.id, classId: filterTestClass.id, role: UserRole.STUDENT });
        await UserClassFactory.create({ userId: teacher.id, classId: filterTestClass.id, role: UserRole.TEACHER });

        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          filterTestClass.id,
          { page: 1, perPage: 100, role: UserRole.STUDENT },
        );

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(student1.id);
        expect(userIds).toContain(student2.id);
        expect(userIds).not.toContain(teacher.id);
      });

      it('filters by grade', async () => {
        // Create a class with users having different grades
        const filterGradeClass = await ClassFactory.create({
          name: 'Authorized Filter Grade Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const grade3Student = await UserFactory.create({ nameLast: 'AuthGrade3', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'AuthGrade5', grade: '5' });
        const grade5Student2 = await UserFactory.create({ nameLast: 'AuthGrade5Second', grade: '5' });
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

        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          filterGradeClass.id,
          { page: 1, perPage: 100, grade: '5' },
        );

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
          name: 'Authorized Filter Both Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const grade3Student = await UserFactory.create({ nameLast: 'AuthG3Student', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'AuthG5Student', grade: '5' });
        const grade5Teacher = await UserFactory.create({ nameLast: 'AuthG5Teacher', grade: '5' });
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

        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          filterBothClass.id,
          { page: 1, perPage: 100, role: UserRole.STUDENT, grade: '5' },
        );

        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(grade5Student.id);
      });

      it('returns empty when no users match filter', async () => {
        // Create a class with only students
        const noMatchClass = await ClassFactory.create({
          name: 'Authorized No Match Filter Test Class',
          schoolId: baseFixture.schoolA.id,
          districtId: baseFixture.district.id,
        });
        const student = await UserFactory.create({ nameLast: 'AuthOnlyStudent' });
        await UserClassFactory.create({ userId: student.id, classId: noMatchClass.id, role: UserRole.STUDENT });

        const result = await repository.getAuthorizedUsersByClassId(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          noMatchClass.id,
          { page: 1, perPage: 100, role: UserRole.ADMINISTRATOR },
        );

        expect(result.totalItems).toBe(0);
        expect(result.items).toEqual([]);
      });
    });
  });
});
