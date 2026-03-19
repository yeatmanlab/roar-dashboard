/**
 * Integration tests for GroupRepository.
 *
 * Tests custom methods (getById, getAuthorizedById) against the
 * real database. Groups have a flat structure with no hierarchy.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SortOrder } from '@roar-dashboard/api-contract';
import { GroupRepository } from './group.repository';
import { UserRole } from '../enums/user-role.enum';
import { CoreDbClient } from '../test-support/db';
import { GroupFactory } from '../test-support/factories/group.factory';
import { UserGroupFactory } from '../test-support/factories/user-group.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import { baseFixture } from '../test-support/fixtures';

describe('GroupRepository', () => {
  let repository: GroupRepository;

  beforeAll(() => {
    repository = new GroupRepository(CoreDbClient);
  });

  describe('getById (inherited)', () => {
    it('returns group when it exists', async () => {
      const result = await repository.getById({ id: baseFixture.group.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.group.id);
    });

    it('returns null for nonexistent group', async () => {
      const result = await repository.getById({ id: '00000000-0000-0000-0000-000000000000' });

      expect(result).toBeNull();
    });
  });

  describe('getAuthorizedById', () => {
    describe('returns group when user has access', () => {
      it('district admin can access group', async () => {
        const districtGroup = await GroupFactory.create({
          name: 'district group',
        });

        await UserGroupFactory.create({
          userId: baseFixture.districtAdmin.id,
          groupId: districtGroup.id,
          role: UserRole.ADMINISTRATOR,
        });

        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          districtGroup.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(districtGroup.id);
      });
    });

    describe('returns null when user does not have access', () => {
      it('student cannot access group', async () => {
        const studentGroup = await GroupFactory.create({
          name: 'student group',
        });
        await UserGroupFactory.create({
          userId: baseFixture.schoolAStudent.id,
          groupId: studentGroup.id,
          role: UserRole.STUDENT,
        });

        const result = await repository.getAuthorizedById(
          { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.TEACHER] },
          studentGroup.id,
        );

        expect(result).toBeNull();
      });

      it('group with rostering ended', async () => {
        const groupWithRosteringEnded = await GroupFactory.create({
          rosteringEnded: new Date(),
        });

        await UserGroupFactory.create({
          userId: baseFixture.districtAdmin.id,
          groupId: groupWithRosteringEnded.id,
          role: UserRole.ADMINISTRATOR,
        });

        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          groupWithRosteringEnded.id,
        );

        expect(result).toBeNull();
      });

      it('group with nonexistent ID', async () => {
        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          '00000000-0000-0000-0000-000000000000',
        );

        expect(result).toBeNull();
      });
    });
  });

  describe('getUserRoleForGroup', () => {
    it('returns the role a user holds for a specific group', async () => {
      const user = await UserFactory.create();
      const group = await GroupFactory.create();
      await UserGroupFactory.create({
        userId: user.id,
        groupId: group.id,
        role: UserRole.TEACHER,
      });

      const result = await repository.getUserRolesForGroup(user.id, group.id);

      expect(result).toContain(UserRole.TEACHER);
    });
  });

  describe('getUsersByGroupId', () => {
    // baseFixture.group has exactly 1 active user:
    // - groupStudent (student)

    it('returns all enrolled users for a group', async () => {
      const result = await repository.getUsersByGroupId(baseFixture.group.id, {
        page: 1,
        perPage: 100,
      });

      // Exactly 1 user in the group
      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);

      expect(result?.items[0]?.id).toBe(baseFixture.groupStudent.id);
      // Future enrollment should be excluded
      expect(result?.items[0]?.id).not.toBe(baseFixture.futureGroupStudent.id);
    });

    it('returns enrollmentStart and role for each user', async () => {
      const result = await repository.getUsersByGroupId(baseFixture.group.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toHaveLength(1);

      expect(result?.items[0]?.id).toBe(baseFixture.groupStudent.id);
      expect(result?.items[0]?.role).toBe(UserRole.STUDENT);
      expect(result?.items[0]?.enrollmentStart).toBeInstanceOf(Date);
    });

    it('returns empty for group with no enrolled users', async () => {
      const emptyGroup = await GroupFactory.create({
        name: 'empty group',
      });

      const result = await repository.getUsersByGroupId(emptyGroup.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('respects pagination', async () => {
      const paginationGroup = await GroupFactory.create({
        name: 'pagination group',
      });

      const otherUser = await UserFactory.create({
        username: 'otheruser',
      });

      // Add users to the group
      await UserGroupFactory.create({
        groupId: paginationGroup.id,
        userId: otherUser.id,
        role: UserRole.STUDENT,
      });

      await UserGroupFactory.create({
        groupId: paginationGroup.id,
        userId: baseFixture.groupStudent.id,
        role: UserRole.STUDENT,
      });

      const page1 = await repository.getUsersByGroupId(paginationGroup.id, {
        page: 1,
        perPage: 1,
      });

      expect(page1.items).toHaveLength(1);
      expect(page1.totalItems).toBe(2);

      const page2 = await repository.getUsersByGroupId(paginationGroup.id, {
        page: 2,
        perPage: 1,
      });

      expect(page2.items).toHaveLength(1);
      expect(page2.totalItems).toBe(2);

      // Pages should have different users
      expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
    });

    it('applies default sorting by nameLast ascending when no orderBy specified', async () => {
      // Create a group with users having known lastNames for precise sorting verification
      const sortTestGroup = await GroupFactory.create({
        name: 'getUsersByGroupId Sort Test Group',
      });
      const studentZ = await UserFactory.create({ nameLast: 'Zulu' });
      const studentA = await UserFactory.create({ nameLast: 'Alpha' });
      const studentM = await UserFactory.create({ nameLast: 'Mike' });
      await UserGroupFactory.create({ userId: studentZ.id, groupId: sortTestGroup.id, role: UserRole.STUDENT });
      await UserGroupFactory.create({ userId: studentA.id, groupId: sortTestGroup.id, role: UserRole.STUDENT });
      await UserGroupFactory.create({ userId: studentM.id, groupId: sortTestGroup.id, role: UserRole.STUDENT });

      const result = await repository.getUsersByGroupId(sortTestGroup.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.nameLast).toBe('Alpha');
      expect(result.items[1]!.nameLast).toBe('Mike');
      expect(result.items[2]!.nameLast).toBe('Zulu');
    });

    it('applies sorting by username descending', async () => {
      // Create a group with users having known usernames for precise sorting verification
      const usernameTestGroup = await GroupFactory.create({
        name: 'getUsersByGroupId Username Sort Test',
      });
      const userA = await UserFactory.create({ username: 'aaa_user' });
      const userZ = await UserFactory.create({ username: 'zzz_user' });
      const userM = await UserFactory.create({ username: 'mmm_user' });
      await UserGroupFactory.create({ userId: userA.id, groupId: usernameTestGroup.id, role: UserRole.STUDENT });
      await UserGroupFactory.create({ userId: userZ.id, groupId: usernameTestGroup.id, role: UserRole.STUDENT });
      await UserGroupFactory.create({ userId: userM.id, groupId: usernameTestGroup.id, role: UserRole.STUDENT });

      const result = await repository.getUsersByGroupId(usernameTestGroup.id, {
        page: 1,
        perPage: 100,
        orderBy: { field: 'username', direction: SortOrder.DESC },
      });

      expect(result.items).toHaveLength(3);
      expect(result.items[0]!.username).toBe('zzz_user');
      expect(result.items[1]!.username).toBe('mmm_user');
      expect(result.items[2]!.username).toBe('aaa_user');
    });

    it('excludes users with expired group enrollment', async () => {
      const groupWithExpiredEnrollment = await GroupFactory.create({
        name: 'Expired Group',
      });

      await UserGroupFactory.create({
        userId: baseFixture.expiredEnrollmentStudent.id,
        groupId: groupWithExpiredEnrollment.id,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        enrollmentEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      await UserGroupFactory.create({
        userId: baseFixture.groupStudent.id,
        groupId: groupWithExpiredEnrollment.id,
        role: UserRole.STUDENT,
      });

      const result = await repository.getUsersByGroupId(groupWithExpiredEnrollment.id, {
        page: 1,
        perPage: 100,
      });

      expect(result.totalItems).toBe(1); // Only active users
      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(baseFixture.groupStudent.id);
      expect(userIds).not.toContain(baseFixture.expiredEnrollmentStudent.id);
    });

    it('returns empty for nonexistent group ID', async () => {
      const result = await repository.getUsersByGroupId('00000000-0000-0000-0000-000000000000', {
        page: 1,
        perPage: 100,
      });

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    describe('filters', () => {
      it('filters by role', async () => {
        // Create a group with users having different roles
        const filterTestGroup = await GroupFactory.create({
          name: 'Filter Role Test Group',
        });
        const student1 = await UserFactory.create({ nameLast: 'FilterStudent1' });
        const student2 = await UserFactory.create({ nameLast: 'FilterStudent2' });
        const teacher = await UserFactory.create({ nameLast: 'FilterTeacher' });
        await UserGroupFactory.create({ userId: student1.id, groupId: filterTestGroup.id, role: UserRole.STUDENT });
        await UserGroupFactory.create({ userId: student2.id, groupId: filterTestGroup.id, role: UserRole.STUDENT });
        await UserGroupFactory.create({ userId: teacher.id, groupId: filterTestGroup.id, role: UserRole.TEACHER });

        const result = await repository.getUsersByGroupId(filterTestGroup.id, {
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
          expect(user.role).toBe(UserRole.STUDENT);
        }
      });

      it('filters by grade', async () => {
        // Create a group with users having different grades
        const filterGradeGroup = await GroupFactory.create({
          name: 'Filter Grade Test Group',
        });
        const grade3Student = await UserFactory.create({ nameLast: 'Grade3', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'Grade5', grade: '5' });
        const grade5Student2 = await UserFactory.create({ nameLast: 'Grade5Second', grade: '5' });
        await UserGroupFactory.create({
          userId: grade3Student.id,
          groupId: filterGradeGroup.id,
          role: UserRole.STUDENT,
        });
        await UserGroupFactory.create({
          userId: grade5Student.id,
          groupId: filterGradeGroup.id,
          role: UserRole.STUDENT,
        });
        await UserGroupFactory.create({
          userId: grade5Student2.id,
          groupId: filterGradeGroup.id,
          role: UserRole.STUDENT,
        });

        const result = await repository.getUsersByGroupId(filterGradeGroup.id, {
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
        // Create a group with users having different roles and grades
        const filterBothGroup = await GroupFactory.create({
          name: 'Filter Both Test Group',
        });
        const grade3Student = await UserFactory.create({ nameLast: 'G3Student', grade: '3' });
        const grade5Student = await UserFactory.create({ nameLast: 'G5Student', grade: '5' });
        const grade5Teacher = await UserFactory.create({ nameLast: 'G5Teacher', grade: '5' });
        await UserGroupFactory.create({
          userId: grade3Student.id,
          groupId: filterBothGroup.id,
          role: UserRole.STUDENT,
        });
        await UserGroupFactory.create({
          userId: grade5Student.id,
          groupId: filterBothGroup.id,
          role: UserRole.STUDENT,
        });
        await UserGroupFactory.create({
          userId: grade5Teacher.id,
          groupId: filterBothGroup.id,
          role: UserRole.TEACHER,
        });

        const result = await repository.getUsersByGroupId(filterBothGroup.id, {
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
        // Create a group with only students
        const noMatchGroup = await GroupFactory.create({
          name: 'No Match Filter Test Group',
        });
        const student = await UserFactory.create({ nameLast: 'OnlyStudent' });
        await UserGroupFactory.create({ userId: student.id, groupId: noMatchGroup.id, role: UserRole.STUDENT });

        const result = await repository.getUsersByGroupId(noMatchGroup.id, {
          page: 1,
          perPage: 100,
          role: UserRole.ADMINISTRATOR,
        });

        expect(result.totalItems).toBe(0);
        expect(result.items).toEqual([]);
      });
    });
  });

  describe('getAuthorizedUsersByGroupId', () => {
    it('returns users with supervisor access', async () => {
      const adminUser = await UserFactory.create({ nameLast: 'GroupAdmin' });
      const teacherUser = await UserFactory.create({ nameLast: 'Teacher' });
      const studentUser = await UserFactory.create({ nameLast: 'Student' });
      const adminGroup = await GroupFactory.create({
        name: 'Group Admin Test Group',
      });

      await UserGroupFactory.create({ userId: adminUser.id, groupId: adminGroup.id, role: UserRole.ADMINISTRATOR });
      await UserGroupFactory.create({ userId: teacherUser.id, groupId: adminGroup.id, role: UserRole.TEACHER });
      await UserGroupFactory.create({ userId: studentUser.id, groupId: adminGroup.id, role: UserRole.STUDENT });
      const result = await repository.getAuthorizedUsersByGroupId(
        { userId: adminUser.id, allowedRoles: [UserRole.ADMINISTRATOR, UserRole.TEACHER] },
        adminGroup.id,
        { page: 1, perPage: 100 },
      );

      expect(result.totalItems).toBe(3);
      expect(result.items).toHaveLength(3);

      const userIds = result.items.map((u) => u.id);
      expect(userIds).toContain(adminUser.id);
      expect(userIds).toContain(teacherUser.id);
      expect(userIds).toContain(studentUser.id);
    });

    it('returns null with supervisory role', async () => {
      const adminUser = await UserFactory.create({ nameLast: 'GroupAdmin' });
      const teacherUser = await UserFactory.create({ nameLast: 'Teacher' });
      const studentUser = await UserFactory.create({ nameLast: 'Student' });
      const adminGroup = await GroupFactory.create({
        name: 'Group Admin Test Group',
      });

      await UserGroupFactory.create({ userId: adminUser.id, groupId: adminGroup.id, role: UserRole.ADMINISTRATOR });
      await UserGroupFactory.create({ userId: teacherUser.id, groupId: adminGroup.id, role: UserRole.TEACHER });
      await UserGroupFactory.create({ userId: studentUser.id, groupId: adminGroup.id, role: UserRole.STUDENT });
      const result = await repository.getAuthorizedUsersByGroupId(
        { userId: studentUser.id, allowedRoles: [UserRole.ADMINISTRATOR, UserRole.TEACHER] },
        adminGroup.id,
        { page: 1, perPage: 100 },
      );

      expect(result.totalItems).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });
});
