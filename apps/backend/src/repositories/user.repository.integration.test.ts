/**
 * Integration tests for UserRepository.
 *
 * Tests the custom `findByAuthId` and `getUserEntityMemberships` methods,
 * plus light coverage of inherited BaseRepository methods against the real `users` table.
 *
 * Thorough BaseRepository CRUD coverage is in base.repository.integration.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { FamilyFactory } from '../test-support/factories/family.factory';
import { UserFamilyFactory } from '../test-support/factories/user-family.factory';
import { UserRole } from '../enums/user-role.enum';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeAll(() => {
    repository = new UserRepository();
  });

  describe('findByAuthId', () => {
    it('returns user when found by authId', async () => {
      const result = await repository.findByAuthId(baseFixture.districtAdmin.authId!);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.districtAdmin.id);
      expect(result!.authId).toBe(baseFixture.districtAdmin.authId);
    });

    it('returns null for nonexistent authId', async () => {
      const result = await repository.findByAuthId('nonexistent-auth-id-xyz');

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('returns user', async () => {
      const result = await repository.getById({ id: baseFixture.schoolAStudent.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(baseFixture.schoolAStudent.id);
    });
  });

  describe('create (inherited)', () => {
    it('creates user', async () => {
      const userData = UserFactory.build();
      const result = await repository.create({ data: userData });

      expect(result).not.toBeNull();
      expect(result.id).toBeDefined();
    });
  });

  describe('getUserEntityMemberships', () => {
    it('returns org memberships with mapped entity types', async () => {
      // districtAdmin has a district-level org membership via baseFixture
      const result = await repository.getUserEntityMemberships(baseFixture.districtAdmin.id);

      const orgMemberships = result.filter((m) => m.entityType === 'district' || m.entityType === 'school');
      expect(orgMemberships.length).toBeGreaterThan(0);

      // Verify the district membership is present
      const districtMembership = result.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeDefined();
      expect(districtMembership!.entityType).toBe('district');
    });

    it('returns class memberships', async () => {
      // classAStudent has a direct class membership via baseFixture
      const result = await repository.getUserEntityMemberships(baseFixture.classAStudent.id);

      const classMemberships = result.filter((m) => m.entityType === 'class');
      expect(classMemberships.length).toBeGreaterThan(0);

      const classMembership = result.find((m) => m.entityId === baseFixture.classInSchoolA.id);
      expect(classMembership).toBeDefined();
      expect(classMembership!.entityType).toBe('class');
    });

    it('returns group memberships', async () => {
      // groupStudent has a group membership via baseFixture
      const result = await repository.getUserEntityMemberships(baseFixture.groupStudent.id);

      const groupMemberships = result.filter((m) => m.entityType === 'group');
      expect(groupMemberships.length).toBeGreaterThan(0);
    });

    it('returns family memberships', async () => {
      const parent = await UserFactory.create({ dob: '1985-01-01' });
      const family = await FamilyFactory.create();
      await UserFamilyFactory.create({ userId: parent.id, familyId: family.id, role: 'parent' });

      const result = await repository.getUserEntityMemberships(parent.id);

      const familyMemberships = result.filter((m) => m.entityType === 'family');
      expect(familyMemberships).toHaveLength(1);
      expect(familyMemberships[0]!.entityId).toBe(family.id);
    });

    it('returns memberships across all entity types for multi-assigned user', async () => {
      const user = await UserFactory.create();
      const family = await FamilyFactory.create();

      await UserOrgFactory.create({
        userId: user.id,
        orgId: baseFixture.district.id,
        role: UserRole.ADMINISTRATOR,
      });
      await UserClassFactory.create({
        userId: user.id,
        classId: baseFixture.classInSchoolA.id,
        role: UserRole.TEACHER,
      });
      await UserFamilyFactory.create({ userId: user.id, familyId: family.id, role: 'parent' });

      const result = await repository.getUserEntityMemberships(user.id);

      const entityTypes = new Set(result.map((m) => m.entityType));
      expect(entityTypes.has('district')).toBe(true);
      expect(entityTypes.has('class')).toBe(true);
      expect(entityTypes.has('family')).toBe(true);
    });

    it('returns empty array for user with no active memberships', async () => {
      // unassignedUser has no junction table entries
      const result = await repository.getUserEntityMemberships(baseFixture.unassignedUser.id);

      expect(result).toHaveLength(0);
    });

    it('excludes expired enrollments', async () => {
      const result = await repository.getUserEntityMemberships(baseFixture.expiredEnrollmentStudent.id);

      // Expired enrollment student's enrollments are past endDate — should be excluded
      // by isEnrollmentActive filter
      const districtMembership = result.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeUndefined();
    });

    it('excludes future enrollments', async () => {
      const result = await repository.getUserEntityMemberships(baseFixture.futureEnrollmentStudent.id);

      // Future enrollment student's enrollments haven't started yet — should be excluded
      const districtMembership = result.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeUndefined();
    });
  });
});
