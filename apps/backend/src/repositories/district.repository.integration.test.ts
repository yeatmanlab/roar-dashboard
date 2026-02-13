/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DistrictRepository } from './district.repository';
import { OrgFactory } from '../test-support/factories/org.factory';
import { UserFactory } from '../test-support/factories/user.factory';
import { UserOrgFactory } from '../test-support/factories/user-org.factory';
import { OrgType } from '../enums/org-type.enum';
import { UserRole } from '../enums/user-role.enum';
// TODO: Uncomment when test-db-setup is available
// import { setupTestDatabase, teardownTestDatabase, type TestFixture } from '../test-support/test-db-setup';

describe('DistrictRepository Integration Tests', () => {
  let baseFixture: any;
  let repository: DistrictRepository;

  beforeAll(async () => {
    baseFixture = await setupTestDatabase();
    repository = new DistrictRepository();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('getById', () => {
    it('should return district by ID', async () => {
      const result = await repository.getById(baseFixture.district.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.district.id);
      expect(result?.name).toBe(baseFixture.district.name);
      expect(result?.orgType).toBe('district');
    });

    it('should return null for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const result = await repository.getById(nonExistentId);

      expect(result).toBeNull();
    });

    it('should return null when ID is a school (not a district)', async () => {
      const result = await repository.getById(baseFixture.schoolA.id);

      expect(result).toBeNull();
    });

    it('should return district with all fields', async () => {
      const result = await repository.getById(baseFixture.district.id);

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

  describe('getByIdAuthorized', () => {
    it('should return district when user has access', async () => {
      const accessControlFilter = {
        userId: baseFixture.districtAdmin.id,
        allowedRoles: [UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.STUDENT],
      };

      const result = await repository.getByIdAuthorized(baseFixture.district.id, accessControlFilter);

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.district.id);
    });

    it('should return null when user has no access', async () => {
      const unauthorizedUser = await UserFactory.create({
        email: 'unauthorized@test.com',
      });

      const accessControlFilter = {
        userId: unauthorizedUser.id,
        allowedRoles: [UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.STUDENT],
      };

      const result = await repository.getByIdAuthorized(baseFixture.district.id, accessControlFilter);

      expect(result).toBeNull();
    });

    it('should allow school admin to access parent district', async () => {
      const schoolAdmin = await UserFactory.create({
        email: 'schooladmin@test.com',
      });

      await UserOrgFactory.create({
        userId: schoolAdmin.id,
        orgId: baseFixture.schoolA.id,
        role: UserRole.ADMINISTRATOR,
      });

      const accessControlFilter = {
        userId: schoolAdmin.id,
        allowedRoles: [UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.STUDENT],
      };

      const result = await repository.getByIdAuthorized(baseFixture.district.id, accessControlFilter);

      expect(result).toBeDefined();
      expect(result?.id).toBe(baseFixture.district.id);
    });

    it('should return null for non-existent district', async () => {
      const accessControlFilter = {
        userId: baseFixture.districtAdmin.id,
        allowedRoles: [UserRole.ADMINISTRATOR],
      };

      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const result = await repository.getByIdAuthorized(nonExistentId, accessControlFilter);

      expect(result).toBeNull();
    });

    it('should return null when requesting a school ID', async () => {
      const accessControlFilter = {
        userId: baseFixture.districtAdmin.id,
        allowedRoles: [UserRole.ADMINISTRATOR],
      };

      const result = await repository.getByIdAuthorized(baseFixture.schoolA.id, accessControlFilter);

      expect(result).toBeNull();
    });

    it('should respect role filtering', async () => {
      const student = await UserFactory.create({
        email: 'student@test.com',
      });

      await UserOrgFactory.create({
        userId: student.id,
        orgId: baseFixture.district.id,
        role: UserRole.STUDENT,
      });

      // Should work with student role allowed
      const accessControlFilterWithStudent = {
        userId: student.id,
        allowedRoles: [UserRole.STUDENT, UserRole.TEACHER],
      };

      const resultWithAccess = await repository.getByIdAuthorized(
        baseFixture.district.id,
        accessControlFilterWithStudent,
      );
      expect(resultWithAccess).toBeDefined();

      // Should not work when student role not allowed
      const accessControlFilterWithoutStudent = {
        userId: student.id,
        allowedRoles: [UserRole.TEACHER, UserRole.ADMINISTRATOR],
      };

      const resultWithoutAccess = await repository.getByIdAuthorized(
        baseFixture.district.id,
        accessControlFilterWithoutStudent,
      );
      expect(resultWithoutAccess).toBeNull();
    });
  });

  describe('getByIdWithEmbeds', () => {
    it('should return district without children when embedChildren=false', async () => {
      const accessControlFilter = {
        userId: baseFixture.districtAdmin.id,
        allowedRoles: [UserRole.ADMINISTRATOR],
      };

      const result = await repository.getByIdWithEmbeds(baseFixture.district.id, accessControlFilter, false);

      expect(result).toBeDefined();
      expect(result?.children).toBeUndefined();
    });

    it('should return district with children when embedChildren=true', async () => {
      const accessControlFilter = {
        userId: baseFixture.districtAdmin.id,
        allowedRoles: [UserRole.ADMINISTRATOR],
      };

      const result = await repository.getByIdWithEmbeds(baseFixture.district.id, accessControlFilter, true);

      expect(result).toBeDefined();
      expect(result?.children).toBeDefined();
      expect(result!.children!.length).toBeGreaterThan(0);

      // Verify children are schools
      const childIds = result!.children!.map((c) => c.id);
      expect(childIds).toContain(baseFixture.schoolA.id);
    });

    it('should return null when user has no access', async () => {
      const unauthorizedUser = await UserFactory.create({
        email: 'unauthorized2@test.com',
      });

      const accessControlFilter = {
        userId: unauthorizedUser.id,
        allowedRoles: [UserRole.ADMINISTRATOR],
      };

      const result = await repository.getByIdWithEmbeds(baseFixture.district.id, accessControlFilter, true);

      expect(result).toBeNull();
    });

    it('should exclude ended children by default', async () => {
      // Create an ended school
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
        name: 'Ended School',
        rosteringEnded: new Date('2020-01-01'),
      });

      const accessControlFilter = {
        userId: baseFixture.districtAdmin.id,
        allowedRoles: [UserRole.ADMINISTRATOR],
      };

      const result = await repository.getByIdWithEmbeds(baseFixture.district.id, accessControlFilter, true);

      expect(result).toBeDefined();
      expect(result?.children).toBeDefined();

      const childIds = result!.children!.map((c) => c.id);
      expect(childIds).not.toContain(endedSchool.id);
    });

    it('should return empty children array for district with no children', async () => {
      const emptyDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Empty District',
      });

      const admin = await UserFactory.create({
        email: 'emptydistrictadmin@test.com',
      });

      await UserOrgFactory.create({
        userId: admin.id,
        orgId: emptyDistrict.id,
        role: UserRole.ADMINISTRATOR,
      });

      const accessControlFilter = {
        userId: admin.id,
        allowedRoles: [UserRole.ADMINISTRATOR],
      };

      const result = await repository.getByIdWithEmbeds(emptyDistrict.id, accessControlFilter, true);

      expect(result).toBeDefined();
      expect(result?.children).toBeDefined();
      expect(result!.children).toHaveLength(0);
    });
  });

  describe('getChildren', () => {
    it('should return child organizations of a district', async () => {
      const children = await repository.getChildren(baseFixture.district.id, false);

      expect(children.length).toBeGreaterThan(0);

      // All children should be schools with correct parent
      for (const child of children) {
        expect(child.orgType).toBe('school');
        expect(child.parentOrgId).toBe(baseFixture.district.id);
      }
    });

    it('should exclude ended children by default', async () => {
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
        name: 'Ended School 2',
        rosteringEnded: new Date('2020-01-01'),
      });

      const children = await repository.getChildren(baseFixture.district.id, false);

      const ids = children.map((c) => c.id);
      expect(ids).not.toContain(endedSchool.id);
    });

    it('should include ended children when includeEnded=true', async () => {
      const endedSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
        name: 'Ended School 3',
        rosteringEnded: new Date('2020-01-01'),
      });

      const children = await repository.getChildren(baseFixture.district.id, true);

      const ids = children.map((c) => c.id);
      expect(ids).toContain(endedSchool.id);
    });

    it('should return empty array for district with no children', async () => {
      const emptyDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Empty District 2',
      });

      const children = await repository.getChildren(emptyDistrict.id, false);

      expect(children).toHaveLength(0);
    });

    it('should return empty array for non-existent district', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const children = await repository.getChildren(nonExistentId, false);

      expect(children).toHaveLength(0);
    });

    it('should sort children by name ascending', async () => {
      // Create multiple schools with different names
      await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
        name: 'Zebra School',
      });

      await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: baseFixture.district.id,
        name: 'Alpha School',
      });

      const children = await repository.getChildren(baseFixture.district.id, false);

      expect(children.length).toBeGreaterThan(1);

      // Verify sorted by name
      for (let i = 1; i < children.length; i++) {
        expect(children[i - 1].name.toLowerCase() <= children[i].name.toLowerCase()).toBe(true);
      }
    });
  });

  describe('SQL correctness', () => {
    it('should use proper joins for authorization', async () => {
      // This test verifies that the SQL query structure is correct
      // by testing a complex authorization scenario

      const parentDistrict = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: 'Parent District',
      });

      const childSchool = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        parentOrgId: parentDistrict.id,
        name: 'Child School',
      });

      const teacher = await UserFactory.create({
        email: 'teacher-sql@test.com',
      });

      // Teacher in school should see parent district
      await UserOrgFactory.create({
        userId: teacher.id,
        orgId: childSchool.id,
        role: UserRole.TEACHER,
      });

      const accessControlFilter = {
        userId: teacher.id,
        allowedRoles: [UserRole.TEACHER],
      };

      const result = await repository.getByIdAuthorized(parentDistrict.id, accessControlFilter);

      expect(result).toBeDefined();
      expect(result?.id).toBe(parentDistrict.id);
    });

    it('should correctly filter by orgType=district', async () => {
      // Create a school with same name as district to ensure filtering works
      const testName = 'Test Org Name';

      const district = await OrgFactory.create({
        orgType: OrgType.DISTRICT,
        name: testName,
      });

      const school = await OrgFactory.create({
        orgType: OrgType.SCHOOL,
        name: testName,
      });

      // getById should only return the district
      const districtResult = await repository.getById(district.id);
      expect(districtResult).toBeDefined();
      expect(districtResult?.orgType).toBe('district');

      // getById should return null for school ID
      const schoolResult = await repository.getById(school.id);
      expect(schoolResult).toBeNull();
    });
  });
});
