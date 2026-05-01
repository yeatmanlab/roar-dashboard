/**
 * Tests the custom `findByAuthId`, `getUserEntityMemberships`,
 * `createWithMemberships`, `findClassParentSchool`, and `existsByUniqueFields` methods,
 * plus light coverage of inherited BaseRepository methods against the real `users` table.
 *
 * Thorough BaseRepository CRUD coverage is in base.repository.integration.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { baseFixture } from '../test-support/fixtures';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { UserClassFactory } from '../test-support/factories/user-class.factory';
import { GroupFactory } from '../test-support/factories/group.factory';
import { FamilyFactory } from '../test-support/factories/family.factory';
import { UserFamilyFactory } from '../test-support/factories/user-family.factory';
import { UserRole } from '../enums/user-role.enum';
import { UserType } from '../enums/user-type.enum';
import { AuthProvider } from '../enums/auth-provider.enum';
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

  describe('findClassParentSchool', () => {
    it('returns the parent school id for a class that exists', async () => {
      const result = await repository.findClassParentSchool(baseFixture.classInSchoolA.id);

      expect(result).toBe(baseFixture.schoolA.id);
    });

    it('returns null for a non-existent class id', async () => {
      const result = await repository.findClassParentSchool('00000000-0000-0000-0000-000000000000');

      expect(result).toBeNull();
    });
  });

  describe('existsByUniqueFields', () => {
    it('returns true when email matches an existing user', async () => {
      const result = await repository.existsByUniqueFields({
        email: baseFixture.districtAdmin.email!,
      });

      expect(result).toBe(true);
    });

    it('returns true when the assessmentPid matches an existing user', async () => {
      const result = await repository.existsByUniqueFields({
        assessmentPid: baseFixture.districtAdmin.assessmentPid!,
      });

      expect(result).toBe(true);
    });

    it('returns false when no fields match any user', async () => {
      const result = await repository.existsByUniqueFields({
        email: 'nobody@example.com',
        assessmentPid: 'nonexistent-pid',
      });

      expect(result).toBe(false);
    });

    it('returns false when called with no fields', async () => {
      const result = await repository.existsByUniqueFields({});

      expect(result).toBe(false);
    });
  });

  describe('createWithMemberships', () => {
    const enrollmentStart = new Date('2025-01-01T00:00:00Z');

    it('creates user row and org memberships atomically', async () => {
      const email = `create-with-orgs-${Date.now()}@example.com`;

      const result = await repository.createWithMemberships(
        {
          email,
          assessmentPid: `pid-${email}`,
          authId: `firebase-uid-${email}`,
          authProvider: [AuthProvider.PASSWORD],
          nameFirst: 'Test',
          nameLast: 'User',
          userType: UserType.STUDENT,
        },
        [{ orgId: baseFixture.district.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
        [],
        [],
        [],
      );

      expect(result.id).toBeDefined();

      const created = await repository.getById({ id: result.id });
      expect(created).not.toBeNull();
      expect(created!.email).toBe(email);

      const memberships = await repository.getUserEntityMemberships(result.id);
      const districtMembership = memberships.find((m) => m.entityId === baseFixture.district.id);
      expect(districtMembership).toBeDefined();
    });

    it('creates user row and class, group memberships', async () => {
      const email = `create-multi-${Date.now()}@example.com`;
      const group = await GroupFactory.create();

      const result = await repository.createWithMemberships(
        {
          email,
          assessmentPid: `pid-${email}`,
          authProvider: [AuthProvider.PASSWORD],
          nameFirst: 'Multi',
          nameLast: 'Member',
          userType: UserType.STUDENT,
        },
        [],
        [{ classId: baseFixture.classInSchoolA.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
        [{ groupId: group.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
        [],
      );

      expect(result.id).toBeDefined();

      const memberships = await repository.getUserEntityMemberships(result.id);
      const classMembership = memberships.find((m) => m.entityId === baseFixture.classInSchoolA.id);
      const groupMembership = memberships.find((m) => m.entityId === group.id);

      expect(classMembership).toBeDefined();
      expect(groupMembership).toBeDefined();
    });

    it('creates user row with org, class, group, and family memberships atomically', async () => {
      const email = `create-all-types-${Date.now()}@example.com`;
      const group = await GroupFactory.create();
      const family = await FamilyFactory.create();

      const result = await repository.createWithMemberships(
        {
          email,
          assessmentPid: `pid-${email}`,
          authProvider: [AuthProvider.PASSWORD],
          nameFirst: 'All',
          nameLast: 'Types',
          userType: UserType.STUDENT,
        },
        [{ orgId: baseFixture.district.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
        [{ classId: baseFixture.classInSchoolA.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
        [{ groupId: group.id, role: UserRole.STUDENT as UserRole, enrollmentStart }],
        [{ familyId: family.id, role: 'child', joinedOn: enrollmentStart, leftOn: null }],
      );

      expect(result.id).toBeDefined();

      const memberships = await repository.getUserEntityMemberships(result.id);
      const entityTypes = new Set(memberships.map((m) => m.entityType));
      expect(entityTypes.has('district')).toBe(true);
      expect(entityTypes.has('class')).toBe(true);
      expect(entityTypes.has('group')).toBe(true);
      expect(entityTypes.has('family')).toBe(true);
    });

    it('rolls back the entire transaction when a membership entityId is invalid', async () => {
      const email = `rollback-test-${Date.now()}@example.com`;

      await expect(
        repository.createWithMemberships(
          {
            email,
            assessmentPid: `pid-${email}`,
            authProvider: [AuthProvider.PASSWORD],
            nameFirst: 'Rollback',
            nameLast: 'Test',
            userType: UserType.STUDENT,
          },
          [{ orgId: '00000000-0000-0000-0000-000000000099', role: UserRole.STUDENT as UserRole, enrollmentStart }],
          [],
          [],
          [],
        ),
      ).rejects.toThrow();

      // The user row must NOT exist — transaction rolled back
      const [row] = await (
        await import('../db/clients')
      ).CoreDbClient.select()
        .from((await import('../db/schema')).users)
        .where((await import('drizzle-orm')).eq((await import('../db/schema')).users.email, email));

      expect(row).toBeUndefined();
    });

    it('throws on duplicate email (unique constraint)', async () => {
      const email = baseFixture.districtAdmin.email!;

      await expect(
        repository.createWithMemberships(
          {
            email,
            assessmentPid: `pid-unique-${Date.now()}`,
            authProvider: [AuthProvider.PASSWORD],
            nameFirst: 'Dup',
            nameLast: 'Email',
            userType: UserType.STUDENT,
          },
          [],
          [],
          [],
          [],
        ),
      ).rejects.toThrow();
    });
  });
});
