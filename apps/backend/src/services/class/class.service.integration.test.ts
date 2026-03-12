/**
 * Integration tests for ClassService.
 *
 * Tests the service layer against the real database to verify authorization
 * logic that spans multiple layers (service + repository + access controls).
 *
 * Key behavior:
 * - Super admin: Uses getUsersByClassId (no access control filtering)
 * - Non-super admin: Uses getAuthorizedUsersByClassId (with access control filtering)
 *
 * baseFixture.classInSchoolA has exactly 2 active users:
 * - classAStudent (student)
 * - classATeacher (teacher)
 * - expiredClassStudent is excluded due to expired enrollment
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { UserRole } from '../../enums/user-role.enum';
import { ApiError } from '../../errors/api-error';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import { baseFixture } from '../../test-support/fixtures';
import { ClassService } from './class.service';

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
    // ═══════════════════════════════════════════════════════════════════════════
    // Super Admin Path (uses getUsersByClassId - no access control filtering)
    // ═══════════════════════════════════════════════════════════════════════════

    describe('super admin (getUsersByClassId path)', () => {
      it('returns all active users in class without access control filtering', async () => {
        const authContext = {
          userId: baseFixture.unassignedUser.id, // userId doesn't matter for super admin
          isSuperAdmin: true,
        };

        const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

        // Super admin sees all 2 active users via getUsersByClassId
        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);

        const userIds = result.items.map((u) => u.id);
        expect(userIds).toContain(baseFixture.classAStudent.id);
        expect(userIds).toContain(baseFixture.classATeacher.id);
        // Expired enrollment excluded
        expect(userIds).not.toContain(baseFixture.expiredClassStudent.id);
      });

      it('respects pagination', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const page1 = await service.listUsers(authContext, baseFixture.classInSchoolA.id, {
          ...defaultUserOptions,
          page: 1,
          perPage: 1,
        });

        expect(page1.items).toHaveLength(1);
        expect(page1.totalItems).toBe(2);

        const page2 = await service.listUsers(authContext, baseFixture.classInSchoolA.id, {
          ...defaultUserOptions,
          page: 2,
          perPage: 1,
        });

        expect(page2.items).toHaveLength(1);
        expect(page2.totalItems).toBe(2);
        expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Non-Super Admin Path (uses getAuthorizedUsersByClassId - with access control)
    // ═══════════════════════════════════════════════════════════════════════════

    describe('non-super admin (getAuthorizedUsersByClassId path)', () => {
      describe('supervisory roles can list users', () => {
        it('district admin can list users via descendant access', async () => {
          const authContext = {
            userId: baseFixture.districtAdmin.id,
            isSuperAdmin: false,
          };

          const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

          // District admin sees 2 active users via getAuthorizedUsersByClassId
          expect(result.totalItems).toBe(2);
          expect(result.items).toHaveLength(2);

          const userIds = result.items.map((u) => u.id);
          expect(userIds).toContain(baseFixture.classAStudent.id);
          expect(userIds).toContain(baseFixture.classATeacher.id);
        });

        it('school admin can list users in class within their school', async () => {
          const authContext = {
            userId: baseFixture.schoolAAdmin.id,
            isSuperAdmin: false,
          };

          const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

          expect(result.totalItems).toBe(2);
          expect(result.items).toHaveLength(2);
        });

        it('class teacher can list users in their assigned class', async () => {
          const authContext = {
            userId: baseFixture.classATeacher.id,
            isSuperAdmin: false,
          };

          const result = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);

          expect(result.totalItems).toBe(2);
          expect(result.items).toHaveLength(2);
        });
      });

      describe('supervised roles are forbidden', () => {
        it('student cannot list users', async () => {
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

        it('guardian cannot list users', async () => {
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

        it('parent cannot list users', async () => {
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
      });

      describe('cross-district isolation', () => {
        it('district B admin cannot access class in district A', async () => {
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

        it('district B student cannot access class in district A', async () => {
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

      describe('cross-school access within district', () => {
        it('class teacher cannot access other classes in same school', async () => {
          // Create another class in school A that classATeacher is NOT assigned to
          const anotherClassInSchoolA = await ClassFactory.create({
            name: 'Another Class in School A',
            schoolId: baseFixture.schoolA.id,
            districtId: baseFixture.district.id,
          });

          const authContext = {
            userId: baseFixture.classATeacher.id,
            isSuperAdmin: false,
          };

          // classATeacher is only assigned to classInSchoolA, not anotherClassInSchoolA
          const error = await service
            .listUsers(authContext, anotherClassInSchoolA.id, defaultUserOptions)
            .catch((e) => e);

          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
        });

        it('school A teacher cannot access class in school B', async () => {
          const authContext = {
            userId: baseFixture.schoolATeacher.id,
            isSuperAdmin: false,
          };

          const error = await service
            .listUsers(authContext, baseFixture.classInSchoolB.id, defaultUserOptions)
            .catch((e) => e);

          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
        });

        it('admin at school A and class teacher at school B can access both', async () => {
          // Create one unassigned class in school B for the negative test case
          const unassignedClassInSchoolB = await ClassFactory.create({
            name: 'Unassigned Class in School B',
            schoolId: baseFixture.schoolB.id,
            districtId: baseFixture.district.id,
          });

          // schoolAAdmin is admin at school A only (not district)
          // Give them teacher access to classInSchoolB for this test
          await UserClassFactory.create({
            userId: baseFixture.schoolAAdmin.id,
            classId: baseFixture.classInSchoolB.id,
            role: UserRole.TEACHER,
          });

          const authContext = {
            userId: baseFixture.schoolAAdmin.id,
            isSuperAdmin: false,
          };

          // Can access classInSchoolA via admin role at school A
          const resultSchoolA = await service.listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions);
          expect(resultSchoolA.totalItems).toBeGreaterThanOrEqual(2);

          // Can access assigned class in school B (baseFixture.classInSchoolB)
          const resultAssignedClassB = await service.listUsers(
            authContext,
            baseFixture.classInSchoolB.id,
            defaultUserOptions,
          );
          expect(resultAssignedClassB.items).toBeDefined();

          // Cannot access unassigned class in school B (only has class-level teacher role there)
          const error = await service
            .listUsers(authContext, unassignedClassInSchoolB.id, defaultUserOptions)
            .catch((e) => e);

          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
        });
      });

      describe('pagination and sorting', () => {
        it('respects pagination options', async () => {
          const authContext = {
            userId: baseFixture.districtAdmin.id,
            isSuperAdmin: false,
          };

          const page1 = await service.listUsers(authContext, baseFixture.classInSchoolA.id, {
            ...defaultUserOptions,
            page: 1,
            perPage: 1,
          });

          expect(page1.items).toHaveLength(1);
          expect(page1.totalItems).toBeGreaterThanOrEqual(2);

          const page2 = await service.listUsers(authContext, baseFixture.classInSchoolA.id, {
            ...defaultUserOptions,
            page: 2,
            perPage: 1,
          });

          expect(page2.items).toHaveLength(1);
          expect(page2.totalItems).toBeGreaterThanOrEqual(2);
          expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
        });

        it('respects sortBy and sortOrder options', async () => {
          // Create a class with users having known names for sorting verification
          const sortTestClass = await ClassFactory.create({
            name: 'Sort Test Class',
            schoolId: baseFixture.schoolA.id,
            districtId: baseFixture.district.id,
          });
          const userAlpha = await UserFactory.create({ nameLast: 'Alpha', username: 'user_alpha' });
          const userZeta = await UserFactory.create({ nameLast: 'Zeta', username: 'user_zeta' });
          const userMid = await UserFactory.create({ nameLast: 'Mid', username: 'user_mid' });
          await UserClassFactory.create({ userId: userAlpha.id, classId: sortTestClass.id, role: UserRole.STUDENT });
          await UserClassFactory.create({ userId: userZeta.id, classId: sortTestClass.id, role: UserRole.STUDENT });
          await UserClassFactory.create({ userId: userMid.id, classId: sortTestClass.id, role: UserRole.STUDENT });

          const authContext = {
            userId: baseFixture.districtAdmin.id,
            isSuperAdmin: false,
          };

          // Test sortBy=username, sortOrder=desc
          const result = await service.listUsers(authContext, sortTestClass.id, {
            page: 1,
            perPage: 100,
            sortBy: 'username',
            sortOrder: 'desc',
          });

          expect(result.items).toHaveLength(3);
          expect(result.items[0]!.username).toBe('user_zeta');
          expect(result.items[1]!.username).toBe('user_mid');
          expect(result.items[2]!.username).toBe('user_alpha');
        });
      });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Edge Cases (apply to both paths)
    // ═══════════════════════════════════════════════════════════════════════════

    describe('edge cases', () => {
      it('returns 404 when class does not exist', async () => {
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

      it('returns 403 when unassigned user tries to list users', async () => {
        const authContext = {
          userId: baseFixture.unassignedUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listUsers(authContext, baseFixture.classInSchoolA.id, defaultUserOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });
  });
});
