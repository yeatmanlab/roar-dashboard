/**
 * Integration tests for ClassService.
 *
 * Tests the service layer against the real database to verify authorization
 * logic that spans multiple layers (service + repository + access controls).
 *
 * These tests complement the unit tests by verifying end-to-end behavior
 * with actual database queries and the base fixture's org hierarchy.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ClassService } from './class.service';
import { baseFixture } from '../../test-support/fixtures';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { UserRole } from '../../enums/user-role.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';

describe('ClassService (integration)', () => {
  let service: ReturnType<typeof ClassService>;

  beforeAll(() => {
    service = ClassService();
  });

  const defaultUserOptions = {
    page: 1,
    perPage: 100,
    sortBy: 'nameLast' as const,
    sortOrder: 'asc' as const,
  };

  describe('listUsers', () => {
    describe('supervised role authorization', () => {
      it('should return 403 when student tries to list users', async () => {
        // classAStudent is a student in classInSchoolA
        // Student does NOT have Classes.LIST permission, so they fail at verifyClassAccess
        const authContext = {
          userId: baseFixture.classAStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toBe(ApiErrorMessage.FORBIDDEN);
      });

      it('should return 403 when guardian tries to list users', async () => {
        // Guardian does NOT have Classes.LIST permission, so they fail at verifyClassAccess
        const guardianUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'ClassGuardian' });
        await UserClassFactory.create({
          userId: guardianUser.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.GUARDIAN,
        });

        const authContext = {
          userId: guardianUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when parent tries to list users', async () => {
        // Parent does NOT have Classes.LIST permission, so they fail at verifyClassAccess
        const parentUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'ClassParent' });
        await UserClassFactory.create({
          userId: parentUser.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.PARENT,
        });

        const authContext = {
          userId: parentUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when relative tries to list users', async () => {
        // Relative does NOT have Classes.LIST permission, so they fail at verifyClassAccess
        const relativeUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'ClassRelative' });
        await UserClassFactory.create({
          userId: relativeUser.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.RELATIVE,
        });

        const authContext = {
          userId: relativeUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });

    describe('supervisory role authorization', () => {
      it('should allow class-level teacher to list users', async () => {
        // classATeacher is a teacher in classInSchoolA
        const authContext = {
          userId: baseFixture.classATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

        // Should return users in the class
        expect(result.items.length).toBeGreaterThanOrEqual(1);
      });

      it('should allow school-level teacher to list users via descendant access', async () => {
        // schoolATeacher is a teacher at School A
        // They should see users in classInSchoolA via descendant access
        const authContext = {
          userId: baseFixture.schoolATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

        expect(result.items.length).toBeGreaterThanOrEqual(1);
      });

      it('should allow district admin to list users via descendant access', async () => {
        // districtAdmin is at district level, which is grandparent of classInSchoolA
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

        expect(result.items.length).toBeGreaterThanOrEqual(1);
      });

      it('should allow administrator role to list users', async () => {
        // schoolAAdmin is an administrator at School A
        const authContext = {
          userId: baseFixture.schoolAAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

        expect(result.items.length).toBeGreaterThanOrEqual(1);
      });

      it('should allow user with teacher role for class but admin role for school to list users', async () => {
        // Create a user with teacher role at class level but admin role at school level
        const teacherWithSchoolAdmin = await UserFactory.create({
          nameFirst: 'TeacherWithAdmin',
          nameLast: 'User',
        });
        await UserClassFactory.create({
          userId: teacherWithSchoolAdmin.id,
          classId: baseFixture.classInSchoolA.id,
          role: UserRole.TEACHER,
        });
        await UserOrgFactory.create({
          userId: teacherWithSchoolAdmin.id,
          orgId: baseFixture.schoolA.id,
          role: UserRole.ADMINISTRATOR,
        });

        const authContext = {
          userId: teacherWithSchoolAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

        expect(result.items.length).toBeGreaterThanOrEqual(1);
      });

      it('should allow admin at school A to access all classes in school A, but class-level teacher at school B can only access assigned class', async () => {
        // Create a second class in school B to test access restrictions
        const secondClassInSchoolB = await ClassFactory.create({
          name: 'Second Class in School B',
          schoolId: baseFixture.schoolB.id,
          districtId: baseFixture.district.id,
        });

        // User is:
        // - Admin at school A (org-level) -> can access ALL classes in school A
        // - Teacher at classInSchoolB only (class-level) -> can ONLY access that specific class
        const adminSchoolATeacherClassB = await UserFactory.create({
          nameFirst: 'AdminA',
          nameLast: 'TeacherClassB',
        });
        await UserOrgFactory.create({
          userId: adminSchoolATeacherClassB.id,
          orgId: baseFixture.schoolA.id,
          role: UserRole.ADMINISTRATOR,
        });
        await UserClassFactory.create({
          userId: adminSchoolATeacherClassB.id,
          classId: baseFixture.classInSchoolB.id,
          role: UserRole.TEACHER,
        });

        const authContext = {
          userId: adminSchoolATeacherClassB.id,
          isSuperAdmin: false,
        };

        // Should be able to access classInSchoolA via admin role at school A (descendant access)
        const resultSchoolA = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);
        expect(resultSchoolA.items).toBeDefined();

        // Should be able to access assigned class in school B
        const resultAssignedClassB = await service.listUsers(
          authContext,
          baseFixture.classInSchoolB.id,
          defaultUserOptions,
        );
        expect(resultAssignedClassB.items).toBeDefined();

        // Should NOT be able to access unassigned class in school B (only has class-level teacher role)
        const error = await service.listUsers(authContext, secondClassInSchoolB.id, defaultUserOptions).catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });

    describe('super admin authorization', () => {
      it('should allow super admin to list all users without filtering', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id, // userId doesn't matter for super admin
          isSuperAdmin: true,
        };

        const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

        // Super admin should see ALL users in the class
        expect(result.items.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('access control edge cases', () => {
      it('should return 404 when class does not exist', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listUsers(authContext, '00000000-0000-0000-0000-000000000000', defaultUserOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      });

      it('should return 403 when user has no access to class', async () => {
        // districtBAdmin has no access to classInSchoolA (in district A)
        const authContext = {
          userId: baseFixture.districtBAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when user from different district tries to list users', async () => {
        // districtBStudent is in districtB, should not access classInSchoolA in district A
        const authContext = {
          userId: baseFixture.districtBStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });

    describe('pagination', () => {
      it('should respect pagination options', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, {
          page: 1,
          perPage: 1,
          sortBy: 'nameLast' as const,
          sortOrder: 'asc' as const,
        });

        // Should return at most 1 item per page
        expect(result.items.length).toBeLessThanOrEqual(1);
      });
    });
  });
});
