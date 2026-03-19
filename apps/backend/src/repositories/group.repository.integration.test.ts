/**
 * Integration tests for GroupRepository.
 *
 * Tests custom methods (getById, getAuthorizedById) against the
 * real database. Groups have a flat structure with no hierarchy.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { UserRole } from '../enums/user-role.enum';
import { CoreDbClient } from '../test-support/db';
import { GroupFactory } from '../test-support/factories/group.factory';
import { UserGroupFactory } from '../test-support/factories/user-group.factory';
import { baseFixture } from '../test-support/fixtures';
import { GroupRepository } from './group.repository';

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
        await UserGroupFactory.create({
          userId: baseFixture.districtAdmin.id,
          groupId: baseFixture.group.id,
          role: UserRole.ADMINISTRATOR,
        });

        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          baseFixture.group.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.group.id);
      });

      it('school teacher can access group', async () => {
        await UserGroupFactory.create({
          userId: baseFixture.schoolATeacher.id,
          groupId: baseFixture.group.id,
          role: UserRole.TEACHER,
        });

        const result = await repository.getAuthorizedById(
          { userId: baseFixture.schoolATeacher.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.group.id,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(baseFixture.group.id);
      });
    });

    describe('returns null when user does not have access', () => {
      it('student cannot access group', async () => {
        await UserGroupFactory.create({
          userId: baseFixture.schoolAStudent.id,
          groupId: baseFixture.group.id,
          role: UserRole.STUDENT,
        });

        const result = await repository.getAuthorizedById(
          { userId: baseFixture.schoolAStudent.id, allowedRoles: [UserRole.TEACHER] },
          baseFixture.group.id,
        );

        expect(result).toBeNull();
      });

      it('group with rostering ended', async () => {
        const classWithRosteringEnded = await GroupFactory.create({
          rosteringEnded: new Date(),
        });

        await UserGroupFactory.create({
          userId: baseFixture.districtAdmin.id,
          groupId: classWithRosteringEnded.id,
          role: UserRole.ADMINISTRATOR,
        });

        const result = await repository.getAuthorizedById(
          { userId: baseFixture.districtAdmin.id, allowedRoles: [UserRole.ADMINISTRATOR] },
          classWithRosteringEnded.id,
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
});
