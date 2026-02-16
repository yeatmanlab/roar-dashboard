/**
 * Integration tests for AdministrationService.
 *
 * Tests the service layer against the real database to verify authorization
 * logic that spans multiple layers (service + repository + access controls).
 *
 * These tests complement the unit tests by verifying end-to-end behavior
 * with actual database queries and the base fixture's org hierarchy.
 */
import { describe, it, expect } from 'vitest';
import { AdministrationService } from './administration.service';
import { baseFixture } from '../../test-support/fixtures';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { UserGroupFactory } from '../../test-support/factories/user-group.factory';
import { TaskFactory } from '../../test-support/factories/task.factory';
import { TaskVariantFactory } from '../../test-support/factories/task-variant.factory';
import { AdministrationTaskVariantFactory } from '../../test-support/factories/administration-task-variant.factory';
import { AgreementFactory } from '../../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../../test-support/factories/agreement-version.factory';
import { AdministrationAgreementFactory } from '../../test-support/factories/administration-agreement.factory';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../../test-support/factories/administration-org.factory';
import { AdministrationClassFactory } from '../../test-support/factories/administration-class.factory';
import { AdministrationGroupFactory } from '../../test-support/factories/administration-group.factory';
import type { AssignmentWithOptional } from '../../repositories/administration.repository';
import { UserRole } from '../../enums/user-role.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';

describe('AdministrationService (integration)', () => {
  const service = AdministrationService();

  const defaultDistrictOptions = {
    page: 1,
    perPage: 100,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  };

  const defaultSchoolOptions = {
    page: 1,
    perPage: 100,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  };

  const defaultClassOptions = {
    page: 1,
    perPage: 100,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  };

  const defaultGroupOptions = {
    page: 1,
    perPage: 100,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  };

  const defaultTaskVariantOptions = {
    page: 1,
    perPage: 100,
    sortBy: 'orderIndex' as const,
    sortOrder: 'asc' as const,
  };

  describe('listDistricts', () => {
    describe('supervised role authorization', () => {
      it('should return 403 when student tries to list districts', async () => {
        // schoolAStudent is a student at School A, which is under district
        // administrationAssignedToDistrict is assigned to district
        // Student CAN access the administration but should NOT be able to list districts
        const authContext = {
          userId: baseFixture.schoolAStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toBe(ApiErrorMessage.FORBIDDEN);
      });

      it('should return 403 when class-level student tries to list districts', async () => {
        // classAStudent is a student in classInSchoolA
        // They have access to administrationAssignedToDistrict via class → school → district ancestry
        const authContext = {
          userId: baseFixture.classAStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when guardian tries to list districts', async () => {
        // Create a guardian user assigned to the district
        const guardianUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'Guardian' });
        await UserOrgFactory.create({
          userId: guardianUser.id,
          orgId: baseFixture.district.id,
          role: UserRole.GUARDIAN,
        });

        const authContext = {
          userId: guardianUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when parent tries to list districts', async () => {
        // Create a parent user assigned to the district
        const parentUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'Parent' });
        await UserOrgFactory.create({
          userId: parentUser.id,
          orgId: baseFixture.district.id,
          role: UserRole.PARENT,
        });

        const authContext = {
          userId: parentUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when relative tries to list districts', async () => {
        // Create a relative user assigned to the district
        const relativeUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'Relative' });
        await UserOrgFactory.create({
          userId: relativeUser.id,
          orgId: baseFixture.district.id,
          role: UserRole.RELATIVE,
        });

        const authContext = {
          userId: relativeUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });

    describe('supervisory role authorization', () => {
      it('should allow teacher to list districts with filtering', async () => {
        // schoolATeacher is a teacher at School A
        // They should be able to list districts for administrationAssignedToDistrict
        // and see only the district they have access to
        const authContext = {
          userId: baseFixture.schoolATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listDistricts(
          authContext,
          baseFixture.administrationAssignedToDistrict.id,
          defaultDistrictOptions,
        );

        // Teacher at School A has access to parent district via ancestor access
        expect(result.items.length).toBeGreaterThanOrEqual(1);
        const districtIds = result.items.map((d) => d.id);
        expect(districtIds).toContain(baseFixture.district.id);
      });

      it('should allow administrator to list districts with filtering', async () => {
        // districtAdmin is an administrator at district level
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listDistricts(
          authContext,
          baseFixture.administrationAssignedToDistrict.id,
          defaultDistrictOptions,
        );

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.district.id);
      });

      it('should allow class-level teacher to list districts', async () => {
        // classATeacher is a teacher in classInSchoolA
        const authContext = {
          userId: baseFixture.classATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listDistricts(
          authContext,
          baseFixture.administrationAssignedToDistrict.id,
          defaultDistrictOptions,
        );

        // Class-level teacher should see the district via ancestor access
        expect(result.items.length).toBeGreaterThanOrEqual(1);
        const districtIds = result.items.map((d) => d.id);
        expect(districtIds).toContain(baseFixture.district.id);
      });

      it('should filter districts to only those accessible to the user', async () => {
        // Create an administration assigned to both districts
        const multiDistrictAdmin = await AdministrationFactory.create({
          name: 'Multi-District Service Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: multiDistrictAdmin.id,
          orgId: baseFixture.district.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: multiDistrictAdmin.id,
          orgId: baseFixture.districtB.id,
        });

        // districtAdmin only has access to district (not districtB)
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listDistricts(authContext, multiDistrictAdmin.id, defaultDistrictOptions);

        // Should only see the district they have access to
        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(baseFixture.district.id);
        // Should NOT see districtB
        const districtIds = result.items.map((d) => d.id);
        expect(districtIds).not.toContain(baseFixture.districtB.id);
      });

      it('should filter districts based on school-level membership (ancestor access)', async () => {
        // Scenario:
        // - Administration assigned to District A, District B, and District C
        // - User A: teacher at School A (in District A) -> sees only District A
        // - User B: teacher at schoolInDistrictB (in District B) -> sees only District B
        // - User C: teacher at School C1 (in District C) -> sees only District C
        // - User D: admin at District A -> sees only District A
        //
        // This validates that school-level membership grants access to parent district
        // via ancestor access, but not to other districts.
        //
        // Note: baseFixture.schoolB is under district (District A), not districtB.
        // Use schoolInDistrictB for testing District B access.

        // Create a third district and school for this test
        const districtC = await OrgFactory.create({
          name: 'District C',
          orgType: 'district',
        });
        const schoolC1 = await OrgFactory.create({
          name: 'School C1',
          orgType: 'school',
          parentOrgId: districtC.id,
        });

        // Create an administration assigned to all three districts
        const threeDistrictAdmin = await AdministrationFactory.create({
          name: 'Three-District Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: threeDistrictAdmin.id,
          orgId: baseFixture.district.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: threeDistrictAdmin.id,
          orgId: baseFixture.districtB.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: threeDistrictAdmin.id,
          orgId: districtC.id,
        });

        // Create teachers at schoolInDistrictB and School C1
        // (baseFixture has schoolATeacher for District A's School A)
        const teacherInDistrictB = await UserFactory.create({ nameFirst: 'Teacher', nameLast: 'DistrictB' });
        await UserOrgFactory.create({
          userId: teacherInDistrictB.id,
          orgId: baseFixture.schoolInDistrictB.id,
          role: UserRole.TEACHER,
        });

        const teacherC = await UserFactory.create({ nameFirst: 'Teacher', nameLast: 'C' });
        await UserOrgFactory.create({
          userId: teacherC.id,
          orgId: schoolC1.id,
          role: UserRole.TEACHER,
        });

        // User A (schoolATeacher): teacher at School A -> should see District A only
        const resultA = await service.listDistricts(
          { userId: baseFixture.schoolATeacher.id, isSuperAdmin: false },
          threeDistrictAdmin.id,
          defaultDistrictOptions,
        );
        expect(resultA.totalItems).toBe(1);
        expect(resultA.items[0]!.id).toBe(baseFixture.district.id);

        // User B (teacherInDistrictB): teacher at schoolInDistrictB -> should see District B only
        const resultB = await service.listDistricts(
          { userId: teacherInDistrictB.id, isSuperAdmin: false },
          threeDistrictAdmin.id,
          defaultDistrictOptions,
        );
        expect(resultB.totalItems).toBe(1);
        expect(resultB.items[0]!.id).toBe(baseFixture.districtB.id);

        // User C (teacherC): teacher at School C1 -> should see District C only
        const resultC = await service.listDistricts(
          { userId: teacherC.id, isSuperAdmin: false },
          threeDistrictAdmin.id,
          defaultDistrictOptions,
        );
        expect(resultC.totalItems).toBe(1);
        expect(resultC.items[0]!.id).toBe(districtC.id);

        // District admin (districtAdmin): admin at District A -> should see District A only
        const resultDistrictAdmin = await service.listDistricts(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: false },
          threeDistrictAdmin.id,
          defaultDistrictOptions,
        );
        expect(resultDistrictAdmin.totalItems).toBe(1);
        expect(resultDistrictAdmin.items[0]!.id).toBe(baseFixture.district.id);
      });
    });

    describe('super admin authorization', () => {
      it('should allow super admin to see all districts without filtering', async () => {
        // Create an administration assigned to both districts
        const multiDistrictAdmin = await AdministrationFactory.create({
          name: 'Multi-District Super Admin Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: multiDistrictAdmin.id,
          orgId: baseFixture.district.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: multiDistrictAdmin.id,
          orgId: baseFixture.districtB.id,
        });

        const authContext = {
          userId: baseFixture.districtAdmin.id, // userId doesn't matter for super admin
          isSuperAdmin: true,
        };

        const result = await service.listDistricts(authContext, multiDistrictAdmin.id, defaultDistrictOptions);

        // Super admin should see ALL districts
        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const districtIds = result.items.map((d) => d.id);
        expect(districtIds).toContain(baseFixture.district.id);
        expect(districtIds).toContain(baseFixture.districtB.id);
      });
    });

    describe('access control edge cases', () => {
      it('should return 404 when administration does not exist', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listDistricts(authContext, '00000000-0000-0000-0000-000000000000', defaultDistrictOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      });

      it('should return 403 when user has no access to administration', async () => {
        // districtBAdmin has no access to administrationAssignedToDistrict
        const authContext = {
          userId: baseFixture.districtBAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        // This is the "no access to administration" error, not "supervised user" error
        expect((error as ApiError).message).toBe('You do not have permission to perform this action');
      });
    });
  });

  describe('listSchools', () => {
    describe('supervised role authorization', () => {
      it('should return 403 when student tries to list schools', async () => {
        // schoolAStudent is a student at School A
        // administrationAssignedToSchoolA is assigned to schoolA
        // Student CAN access the administration but should NOT be able to list schools
        const authContext = {
          userId: baseFixture.schoolAStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listSchools(authContext, baseFixture.administrationAssignedToSchoolA.id, defaultSchoolOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toBe(ApiErrorMessage.FORBIDDEN);
      });

      it('should return 403 when class-level student tries to list schools', async () => {
        // classAStudent is a student in classInSchoolA
        // They have access to administrationAssignedToSchoolA via class → school ancestry
        const authContext = {
          userId: baseFixture.classAStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listSchools(authContext, baseFixture.administrationAssignedToSchoolA.id, defaultSchoolOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });

    describe('supervisory role authorization', () => {
      it('should allow teacher to list schools with filtering', async () => {
        // schoolATeacher is a teacher at School A
        // They should be able to list schools for administrationAssignedToSchoolA
        const authContext = {
          userId: baseFixture.schoolATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listSchools(
          authContext,
          baseFixture.administrationAssignedToSchoolA.id,
          defaultSchoolOptions,
        );

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.schoolA.id);
      });

      it('should allow administrator to list schools with filtering', async () => {
        // schoolAAdmin is an administrator at school A level
        const authContext = {
          userId: baseFixture.schoolAAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listSchools(
          authContext,
          baseFixture.administrationAssignedToSchoolA.id,
          defaultSchoolOptions,
        );

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.schoolA.id);
      });

      it('should allow district admin to list schools via descendant access', async () => {
        // districtAdmin is at district level, which is parent of schoolA
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listSchools(
          authContext,
          baseFixture.administrationAssignedToSchoolA.id,
          defaultSchoolOptions,
        );

        // District admin should see schoolA via descendant access
        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.schoolA.id);
      });

      it('should filter schools to only those accessible to the user', async () => {
        // Create an administration assigned to both schools
        const multiSchoolAdmin = await AdministrationFactory.create({
          name: 'Multi-School Service Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: multiSchoolAdmin.id,
          orgId: baseFixture.schoolA.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: multiSchoolAdmin.id,
          orgId: baseFixture.schoolB.id,
        });

        // schoolAAdmin only has access to schoolA (not schoolB)
        const authContext = {
          userId: baseFixture.schoolAAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listSchools(authContext, multiSchoolAdmin.id, defaultSchoolOptions);

        // Should only see the school they have access to
        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(baseFixture.schoolA.id);
        // Should NOT see schoolB
        const schoolIds = result.items.map((s) => s.id);
        expect(schoolIds).not.toContain(baseFixture.schoolB.id);
      });
    });

    describe('super admin authorization', () => {
      it('should allow super admin to see all schools without filtering', async () => {
        // Create an administration assigned to both schools
        const multiSchoolAdmin = await AdministrationFactory.create({
          name: 'Multi-School Super Admin Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: multiSchoolAdmin.id,
          orgId: baseFixture.schoolA.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: multiSchoolAdmin.id,
          orgId: baseFixture.schoolB.id,
        });

        const authContext = {
          userId: baseFixture.districtAdmin.id, // userId doesn't matter for super admin
          isSuperAdmin: true,
        };

        const result = await service.listSchools(authContext, multiSchoolAdmin.id, defaultSchoolOptions);

        // Super admin should see ALL schools
        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const schoolIds = result.items.map((s) => s.id);
        expect(schoolIds).toContain(baseFixture.schoolA.id);
        expect(schoolIds).toContain(baseFixture.schoolB.id);
      });
    });

    describe('access control edge cases', () => {
      it('should return 404 when administration does not exist', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listSchools(authContext, '00000000-0000-0000-0000-000000000000', defaultSchoolOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      });

      it('should return 403 when user has no access to administration', async () => {
        // districtBAdmin has no access to administrationAssignedToSchoolA (in district A)
        const authContext = {
          userId: baseFixture.districtBAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listSchools(authContext, baseFixture.administrationAssignedToSchoolA.id, defaultSchoolOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        // This is the "no access to administration" error, not "supervised user" error
        expect((error as ApiError).message).toBe('You do not have permission to perform this action');
      });
    });
  });

  describe('listClasses', () => {
    describe('supervised role authorization', () => {
      it('should return 403 when student tries to list classes', async () => {
        // classAStudent is a student in classInSchoolA
        // administrationAssignedToClassA is assigned to classInSchoolA
        // Student CAN access the administration but should NOT be able to list classes
        const authContext = {
          userId: baseFixture.classAStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listClasses(authContext, baseFixture.administrationAssignedToClassA.id, defaultClassOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toBe(ApiErrorMessage.FORBIDDEN);
      });

      it('should return 403 when school-level student tries to list classes', async () => {
        // schoolAStudent is a student at School A
        // They have access to administrationAssignedToClassA via school → class ancestry
        const authContext = {
          userId: baseFixture.schoolAStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listClasses(authContext, baseFixture.administrationAssignedToClassA.id, defaultClassOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when guardian tries to list classes', async () => {
        // Create a guardian user assigned to the class
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
          .listClasses(authContext, baseFixture.administrationAssignedToClassA.id, defaultClassOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when parent tries to list classes', async () => {
        // Create a parent user assigned to the class
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
          .listClasses(authContext, baseFixture.administrationAssignedToClassA.id, defaultClassOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when relative tries to list classes', async () => {
        // Create a relative user assigned to the class
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
          .listClasses(authContext, baseFixture.administrationAssignedToClassA.id, defaultClassOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });

    describe('supervisory role authorization', () => {
      it('should allow teacher to list classes with filtering', async () => {
        // classATeacher is a teacher in classInSchoolA
        // They should be able to list classes for administrationAssignedToClassA
        const authContext = {
          userId: baseFixture.classATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listClasses(
          authContext,
          baseFixture.administrationAssignedToClassA.id,
          defaultClassOptions,
        );

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.classInSchoolA.id);
      });

      it('should allow school-level teacher to list classes via descendant access', async () => {
        // schoolATeacher is a teacher at School A
        // They should see classInSchoolA via descendant access
        const authContext = {
          userId: baseFixture.schoolATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listClasses(
          authContext,
          baseFixture.administrationAssignedToClassA.id,
          defaultClassOptions,
        );

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.classInSchoolA.id);
      });

      it('should allow district admin to list classes via descendant access', async () => {
        // districtAdmin is at district level, which is grandparent of classInSchoolA
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listClasses(
          authContext,
          baseFixture.administrationAssignedToClassA.id,
          defaultClassOptions,
        );

        // District admin should see classInSchoolA via descendant access
        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.classInSchoolA.id);
      });

      it('should filter classes to only those accessible to the user', async () => {
        // Create an administration assigned to both classes
        const multiClassAdmin = await AdministrationFactory.create({
          name: 'Multi-Class Service Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationClassFactory.create({
          administrationId: multiClassAdmin.id,
          classId: baseFixture.classInSchoolA.id,
        });
        await AdministrationClassFactory.create({
          administrationId: multiClassAdmin.id,
          classId: baseFixture.classInSchoolB.id,
        });

        // classATeacher only has access to classInSchoolA (not classInSchoolB)
        const authContext = {
          userId: baseFixture.classATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listClasses(authContext, multiClassAdmin.id, defaultClassOptions);

        // Should only see the class they have access to
        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(baseFixture.classInSchoolA.id);
        // Should NOT see classInSchoolB
        const classIds = result.items.map((c) => c.id);
        expect(classIds).not.toContain(baseFixture.classInSchoolB.id);
      });

      it('should filter classes based on school-level membership (descendant access)', async () => {
        // Scenario:
        // - Administration assigned to classInSchoolA and classInSchoolB
        // - schoolATeacher: teacher at School A -> sees only classInSchoolA
        // - Create a teacher at School B -> should see only classInSchoolB
        //
        // This validates that school-level membership grants access to child classes
        // via descendant access, but not to classes in sibling schools.

        // Create an administration assigned to both classes
        const twoClassAdmin = await AdministrationFactory.create({
          name: 'Two-Class Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationClassFactory.create({
          administrationId: twoClassAdmin.id,
          classId: baseFixture.classInSchoolA.id,
        });
        await AdministrationClassFactory.create({
          administrationId: twoClassAdmin.id,
          classId: baseFixture.classInSchoolB.id,
        });

        // Create a teacher at School B
        const schoolBTeacher = await UserFactory.create({ nameFirst: 'SchoolB', nameLast: 'Teacher' });
        await UserOrgFactory.create({
          userId: schoolBTeacher.id,
          orgId: baseFixture.schoolB.id,
          role: UserRole.TEACHER,
        });

        // schoolATeacher: teacher at School A -> should see classInSchoolA only
        const resultA = await service.listClasses(
          { userId: baseFixture.schoolATeacher.id, isSuperAdmin: false },
          twoClassAdmin.id,
          defaultClassOptions,
        );
        expect(resultA.totalItems).toBe(1);
        expect(resultA.items[0]!.id).toBe(baseFixture.classInSchoolA.id);

        // schoolBTeacher: teacher at School B -> should see classInSchoolB only
        const resultB = await service.listClasses(
          { userId: schoolBTeacher.id, isSuperAdmin: false },
          twoClassAdmin.id,
          defaultClassOptions,
        );
        expect(resultB.totalItems).toBe(1);
        expect(resultB.items[0]!.id).toBe(baseFixture.classInSchoolB.id);

        // districtAdmin: admin at district -> should see both classes
        const resultDistrict = await service.listClasses(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: false },
          twoClassAdmin.id,
          defaultClassOptions,
        );
        expect(resultDistrict.totalItems).toBe(2);
        const classIds = resultDistrict.items.map((c) => c.id);
        expect(classIds).toContain(baseFixture.classInSchoolA.id);
        expect(classIds).toContain(baseFixture.classInSchoolB.id);
      });

      it('should filter classes across different districts', async () => {
        // Scenario:
        // - Administration assigned to classInSchoolA (District A) and classInDistrictB (District B)
        // - districtAdmin: admin at District A -> sees only classInSchoolA
        // - districtBAdmin: admin at District B -> sees only classInDistrictB

        const crossDistrictClassAdmin = await AdministrationFactory.create({
          name: 'Cross-District Class Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationClassFactory.create({
          administrationId: crossDistrictClassAdmin.id,
          classId: baseFixture.classInSchoolA.id,
        });
        await AdministrationClassFactory.create({
          administrationId: crossDistrictClassAdmin.id,
          classId: baseFixture.classInDistrictB.id,
        });

        // districtAdmin -> should see classInSchoolA only
        const resultA = await service.listClasses(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: false },
          crossDistrictClassAdmin.id,
          defaultClassOptions,
        );
        expect(resultA.totalItems).toBe(1);
        expect(resultA.items[0]!.id).toBe(baseFixture.classInSchoolA.id);

        // districtBAdmin -> should see classInDistrictB only
        const resultB = await service.listClasses(
          { userId: baseFixture.districtBAdmin.id, isSuperAdmin: false },
          crossDistrictClassAdmin.id,
          defaultClassOptions,
        );
        expect(resultB.totalItems).toBe(1);
        expect(resultB.items[0]!.id).toBe(baseFixture.classInDistrictB.id);
      });
    });

    describe('super admin authorization', () => {
      it('should allow super admin to see all classes without filtering', async () => {
        // Create an administration assigned to classes in both schools
        const multiClassAdmin = await AdministrationFactory.create({
          name: 'Multi-Class Super Admin Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationClassFactory.create({
          administrationId: multiClassAdmin.id,
          classId: baseFixture.classInSchoolA.id,
        });
        await AdministrationClassFactory.create({
          administrationId: multiClassAdmin.id,
          classId: baseFixture.classInSchoolB.id,
        });

        const authContext = {
          userId: baseFixture.districtAdmin.id, // userId doesn't matter for super admin
          isSuperAdmin: true,
        };

        const result = await service.listClasses(authContext, multiClassAdmin.id, defaultClassOptions);

        // Super admin should see ALL classes
        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const classIds = result.items.map((c) => c.id);
        expect(classIds).toContain(baseFixture.classInSchoolA.id);
        expect(classIds).toContain(baseFixture.classInSchoolB.id);
      });
    });

    describe('access control edge cases', () => {
      it('should return 404 when administration does not exist', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listClasses(authContext, '00000000-0000-0000-0000-000000000000', defaultClassOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      });

      it('should return 403 when user has no access to administration', async () => {
        // districtBAdmin has no access to administrationAssignedToClassA (in district A)
        const authContext = {
          userId: baseFixture.districtBAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listClasses(authContext, baseFixture.administrationAssignedToClassA.id, defaultClassOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        // This is the "no access to administration" error, not "supervised user" error
        expect((error as ApiError).message).toBe('You do not have permission to perform this action');
      });
    });
  });

  describe('listGroups', () => {
    describe('supervised role authorization', () => {
      it('should return 403 when student tries to list groups', async () => {
        // groupStudent is a student in the standalone group
        // administrationAssignedToGroup is assigned to that group
        // Student CAN access the administration but should NOT be able to list groups
        const authContext = {
          userId: baseFixture.groupStudent.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listGroups(authContext, baseFixture.administrationAssignedToGroup.id, defaultGroupOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toBe(ApiErrorMessage.FORBIDDEN);
      });

      it('should return 403 when guardian tries to list groups', async () => {
        // Create a guardian user assigned to the group
        const guardianUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'GroupGuardian' });
        await UserGroupFactory.create({
          userId: guardianUser.id,
          groupId: baseFixture.group.id,
          role: UserRole.GUARDIAN,
        });

        const authContext = {
          userId: guardianUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listGroups(authContext, baseFixture.administrationAssignedToGroup.id, defaultGroupOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when parent tries to list groups', async () => {
        // Create a parent user assigned to the group
        const parentUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'GroupParent' });
        await UserGroupFactory.create({
          userId: parentUser.id,
          groupId: baseFixture.group.id,
          role: UserRole.PARENT,
        });

        const authContext = {
          userId: parentUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listGroups(authContext, baseFixture.administrationAssignedToGroup.id, defaultGroupOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });

      it('should return 403 when relative tries to list groups', async () => {
        // Create a relative user assigned to the group
        const relativeUser = await UserFactory.create({ nameFirst: 'Test', nameLast: 'GroupRelative' });
        await UserGroupFactory.create({
          userId: relativeUser.id,
          groupId: baseFixture.group.id,
          role: UserRole.RELATIVE,
        });

        const authContext = {
          userId: relativeUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listGroups(authContext, baseFixture.administrationAssignedToGroup.id, defaultGroupOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });

    describe('supervisory role authorization', () => {
      it('should allow teacher to list groups they are a member of', async () => {
        // Create a teacher user assigned to the group
        const groupTeacher = await UserFactory.create({ nameFirst: 'Test', nameLast: 'GroupTeacher' });
        await UserGroupFactory.create({
          userId: groupTeacher.id,
          groupId: baseFixture.group.id,
          role: UserRole.TEACHER,
        });

        const authContext = {
          userId: groupTeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listGroups(
          authContext,
          baseFixture.administrationAssignedToGroup.id,
          defaultGroupOptions,
        );

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.group.id);
      });

      it('should allow administrator to list groups they are a member of', async () => {
        // Create an administrator user assigned to the group
        const groupAdmin = await UserFactory.create({ nameFirst: 'Test', nameLast: 'GroupAdmin' });
        await UserGroupFactory.create({
          userId: groupAdmin.id,
          groupId: baseFixture.group.id,
          role: UserRole.ADMINISTRATOR,
        });

        const authContext = {
          userId: groupAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listGroups(
          authContext,
          baseFixture.administrationAssignedToGroup.id,
          defaultGroupOptions,
        );

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.id).toBe(baseFixture.group.id);
      });

      it('should filter groups to only those the user is a member of', async () => {
        // Create an administration assigned to multiple groups
        const group2 = await GroupFactory.create({ name: 'Test Group 2' });

        const multiGroupAdmin = await AdministrationFactory.create({
          name: 'Multi-Group Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationGroupFactory.create({
          administrationId: multiGroupAdmin.id,
          groupId: baseFixture.group.id,
        });
        await AdministrationGroupFactory.create({
          administrationId: multiGroupAdmin.id,
          groupId: group2.id,
        });

        // Create a teacher who is only a member of group1
        const groupTeacher = await UserFactory.create({ nameFirst: 'Test', nameLast: 'MultiGroupTeacher' });
        await UserGroupFactory.create({
          userId: groupTeacher.id,
          groupId: baseFixture.group.id,
          role: UserRole.TEACHER,
        });

        const authContext = {
          userId: groupTeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listGroups(authContext, multiGroupAdmin.id, defaultGroupOptions);

        // Should only see the group they are a member of
        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.id).toBe(baseFixture.group.id);
        // Should NOT see group2
        const groupIds = result.items.map((g) => g.id);
        expect(groupIds).not.toContain(group2.id);
      });

      it('should return empty when teacher has no group membership for administration groups', async () => {
        // Create a teacher who has access to the administration via another path (e.g., org)
        // but is not a member of the group
        const nonMemberTeacher = await UserFactory.create({ nameFirst: 'NonMember', nameLast: 'Teacher' });
        // Give them org-level access so they can access the administration
        await UserOrgFactory.create({
          userId: nonMemberTeacher.id,
          orgId: baseFixture.district.id,
          role: UserRole.TEACHER,
        });

        // Create an admin assigned to both the district (for access) and a group
        const mixedAdmin = await AdministrationFactory.create({
          name: 'Mixed Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: mixedAdmin.id,
          orgId: baseFixture.district.id,
        });
        await AdministrationGroupFactory.create({
          administrationId: mixedAdmin.id,
          groupId: baseFixture.group.id,
        });

        const authContext = {
          userId: nonMemberTeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listGroups(authContext, mixedAdmin.id, defaultGroupOptions);

        // Teacher has access to the administration but is not a member of any groups assigned to it
        expect(result.totalItems).toBe(0);
        expect(result.items).toHaveLength(0);
      });
    });

    describe('super admin authorization', () => {
      it('should allow super admin to see all groups without filtering', async () => {
        // Create an administration assigned to multiple groups
        const group2 = await GroupFactory.create({ name: 'Super Admin Test Group 2' });

        const multiGroupAdmin = await AdministrationFactory.create({
          name: 'Multi-Group Super Admin Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationGroupFactory.create({
          administrationId: multiGroupAdmin.id,
          groupId: baseFixture.group.id,
        });
        await AdministrationGroupFactory.create({
          administrationId: multiGroupAdmin.id,
          groupId: group2.id,
        });

        const authContext = {
          userId: baseFixture.districtAdmin.id, // userId doesn't matter for super admin
          isSuperAdmin: true,
        };

        const result = await service.listGroups(authContext, multiGroupAdmin.id, defaultGroupOptions);

        // Super admin should see ALL groups
        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
        const groupIds = result.items.map((g) => g.id);
        expect(groupIds).toContain(baseFixture.group.id);
        expect(groupIds).toContain(group2.id);
      });
    });

    describe('access control edge cases', () => {
      it('should return 404 when administration does not exist', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listGroups(authContext, '00000000-0000-0000-0000-000000000000', defaultGroupOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      });

      it('should return 403 when user has no access to administration', async () => {
        // districtBAdmin has no access to administrationAssignedToGroup
        const authContext = {
          userId: baseFixture.districtBAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listGroups(authContext, baseFixture.administrationAssignedToGroup.id, defaultGroupOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        // This is the "no access to administration" error
        expect((error as ApiError).message).toBe('You do not have permission to perform this action');
      });

      it('should not return groups for users with future enrollment', async () => {
        // futureGroupStudent has an enrollment that starts in the future
        // Create a teacher with the same future enrollment
        const futureGroupTeacher = await UserFactory.create({ nameFirst: 'Future', nameLast: 'GroupTeacher' });
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
        await UserGroupFactory.create({
          userId: futureGroupTeacher.id,
          groupId: baseFixture.group.id,
          role: UserRole.TEACHER,
          enrollmentStart: futureDate,
        });

        const authContext = {
          userId: futureGroupTeacher.id,
          isSuperAdmin: false,
        };

        // Teacher should have access to the administration (via some other path or the base fixture setup)
        // but should not see the group because enrollment hasn't started yet
        // For this test, we need to ensure the teacher has access to the administration via some active enrollment

        // Create an administration that the teacher has access to via an active org enrollment
        // but also has a group assigned where the teacher's enrollment is in the future
        const mixedAdmin = await AdministrationFactory.create({
          name: 'Future Enrollment Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        // Give teacher active access via district
        await UserOrgFactory.create({
          userId: futureGroupTeacher.id,
          orgId: baseFixture.district.id,
          role: UserRole.TEACHER,
        });
        await AdministrationOrgFactory.create({
          administrationId: mixedAdmin.id,
          orgId: baseFixture.district.id,
        });
        await AdministrationGroupFactory.create({
          administrationId: mixedAdmin.id,
          groupId: baseFixture.group.id,
        });

        const result = await service.listGroups(authContext, mixedAdmin.id, defaultGroupOptions);

        // Teacher's group enrollment is in the future, so should not see the group
        expect(result.totalItems).toBe(0);
        expect(result.items).toHaveLength(0);
      });
    });

    describe('pagination', () => {
      it('should correctly paginate group results', async () => {
        // Create multiple groups assigned to an administration
        const groups = await Promise.all([
          GroupFactory.create({ name: 'Pagination Group A' }),
          GroupFactory.create({ name: 'Pagination Group B' }),
          GroupFactory.create({ name: 'Pagination Group C' }),
        ]);

        const paginationAdmin = await AdministrationFactory.create({
          name: 'Pagination Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await Promise.all(
          groups.map((group) =>
            AdministrationGroupFactory.create({
              administrationId: paginationAdmin.id,
              groupId: group.id,
            }),
          ),
        );

        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        // Get first page with 2 items
        const page1 = await service.listGroups(authContext, paginationAdmin.id, {
          page: 1,
          perPage: 2,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        expect(page1.totalItems).toBe(3);
        expect(page1.items).toHaveLength(2);
        expect(page1.items[0]!.name).toBe('Pagination Group A');
        expect(page1.items[1]!.name).toBe('Pagination Group B');

        // Get second page
        const page2 = await service.listGroups(authContext, paginationAdmin.id, {
          page: 2,
          perPage: 2,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        expect(page2.totalItems).toBe(3);
        expect(page2.items).toHaveLength(1);
        expect(page2.items[0]!.name).toBe('Pagination Group C');
      });
    });
  });

  describe('listTaskVariants', () => {
    describe('role access (all roles with administration access allowed)', () => {
      // Unlike districts/schools/classes/groups which restrict supervised users,
      // task variants are accessible to ALL users with administration access.
      // Students need to see task variants to know which assessments to take.

      it('should allow student to list task variants (students need to know their assessments)', async () => {
        // Create an administration with task variants that a student has access to
        const task = await TaskFactory.create({ name: 'Student Access Test Task' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, name: 'Student Access Test Variant' });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Student Access Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.district.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant.id,
          orderIndex: 0,
        });

        // schoolAStudent has access to the administration via district
        // and SHOULD be able to list task variants (unlike districts/schools/classes/groups)
        const authContext = {
          userId: baseFixture.schoolAStudent.id,
          isSuperAdmin: false,
        };

        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        // Students CAN access task variants - this is intentional
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.variant.id).toBe(variant.id);
        expect(result.items[0]!.variant.name).toBe('Student Access Test Variant');
        expect(result.items[0]!.task.name).toBe('Student Access Test Task');
      });

      it('should allow class-level student to list task variants', async () => {
        // Test access through class membership (different from org-level access tested above)
        const task = await TaskFactory.create({ name: 'Class Student Access Test Task' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, name: 'Class Student Test Variant' });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Class Student Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationClassFactory.create({
          administrationId: administration.id,
          classId: baseFixture.classInSchoolA.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant.id,
          orderIndex: 0,
        });

        // classAStudent has access via class membership
        const authContext = {
          userId: baseFixture.classAStudent.id,
          isSuperAdmin: false,
        };

        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        // Students CAN access task variants - they need this to know their assessments
        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.variant.id).toBe(variant.id);
      });

      // Note: Guardians/parents/relatives have a separate access path via family relationships
      // (see role-permissions.ts comment) and are not tested here since they don't have
      // Administrations.READ permission directly. Their access, if any, is handled
      // through a different mechanism outside the scope of this endpoint.
    });

    describe('supervisory role authorization', () => {
      it('should allow teacher to list task variants', async () => {
        const task = await TaskFactory.create({ name: 'Teacher Task Test' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, name: 'Teacher Variant' });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Teacher Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.schoolA.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant.id,
          orderIndex: 0,
        });

        // schoolATeacher has access via schoolA
        const authContext = {
          userId: baseFixture.schoolATeacher.id,
          isSuperAdmin: false,
        };

        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.variant.id).toBe(variant.id);
        expect(result.items[0]!.variant.name).toBe('Teacher Variant');
        expect(result.items[0]!.task.id).toBe(task.id);
        expect(result.items[0]!.task.name).toBe('Teacher Task Test');
        expect(result.items[0]!.assignment.orderIndex).toBe(0);
      });

      it('should allow administrator to list task variants', async () => {
        const task = await TaskFactory.create({ name: 'Admin Task Test' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, name: 'Admin Variant' });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Admin Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.district.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant.id,
          orderIndex: 0,
        });

        // districtAdmin has access via district
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        expect(result.items.length).toBe(1);
        expect(result.items[0]!.variant.id).toBe(variant.id);
      });
    });

    describe('super admin authorization', () => {
      it('should allow super admin to see all task variants', async () => {
        const task1 = await TaskFactory.create({ name: 'Super Admin Task 1' });
        const task2 = await TaskFactory.create({ name: 'Super Admin Task 2' });
        const variant1 = await TaskVariantFactory.create({ taskId: task1.id, name: 'Variant 1' });
        const variant2 = await TaskVariantFactory.create({ taskId: task2.id, name: 'Variant 2' });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Super Admin Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant1.id,
          orderIndex: 0,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant2.id,
          orderIndex: 1,
        });

        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        expect(result.totalItems).toBe(2);
        expect(result.items).toHaveLength(2);
      });
    });

    describe('eligibility filtering for supervised roles', () => {
      /**
       * Condition field semantics:
       * - assigned_if (conditionsAssignment): Determines VISIBILITY - if condition passes, variant is shown
       * - optional_if (conditionsRequirements): Determines OPTIONAL flag - if condition passes, variant is optional
       *
       * For supervised roles (students), the response contains:
       * - Filtered list (only variants where assigned_if passes)
       * - Each item has assignment.optional (boolean) instead of raw conditions
       */

      it('should filter task variants for student based on assigned_if condition', async () => {
        // Uses pre-seeded fixture: grade5Student sees variantForGrade5 + variantForAllGrades + variantOptionalForEll
        // but NOT variantForGrade3 (assigned_if: grade 3)
        const authContext = { userId: baseFixture.grade5Student.id, isSuperAdmin: false };
        const result = await service.listTaskVariants(
          authContext,
          baseFixture.administrationAssignedToDistrict.id,
          defaultTaskVariantOptions,
        );

        // Grade 5 student should see: variantForAllGrades, variantForGrade5, variantOptionalForEll (3 total)
        // Should NOT see: variantForGrade3
        expect(result.items).toHaveLength(3);
        const variantIds = result.items.map((item) => item.variant.id);
        expect(variantIds).toContain(baseFixture.variantForGrade5.id);
        expect(variantIds).toContain(baseFixture.variantForAllGrades.id);
        expect(variantIds).toContain(baseFixture.variantOptionalForEll.id);
        expect(variantIds).not.toContain(baseFixture.variantForGrade3.id);
        expect(result.totalItems).toBe(3);
      });

      it('should set optional flag based on optional_if condition for students', async () => {
        // Uses pre-seeded fixture: grade5EllStudent (grade 5, statusEll='active')
        // variantOptionalForEll has optional_if: statusEll='active', so it's optional for this student
        const authContext = { userId: baseFixture.grade5EllStudent.id, isSuperAdmin: false };
        const result = await service.listTaskVariants(
          authContext,
          baseFixture.administrationAssignedToDistrict.id,
          defaultTaskVariantOptions,
        );

        // ELL student sees same 3 variants as grade5Student
        expect(result.items).toHaveLength(3);

        // Check optional flags
        const variantForAllItem = result.items.find((item) => item.variant.id === baseFixture.variantForAllGrades.id);
        const variantForGrade5Item = result.items.find((item) => item.variant.id === baseFixture.variantForGrade5.id);
        const variantOptionalForEllItem = result.items.find(
          (item) => item.variant.id === baseFixture.variantOptionalForEll.id,
        );

        // variantForAllGrades: no optional_if → required
        expect((variantForAllItem?.assignment as AssignmentWithOptional).optional).toBe(false);
        // variantForGrade5: no optional_if → required
        expect((variantForGrade5Item?.assignment as AssignmentWithOptional).optional).toBe(false);
        // variantOptionalForEll: optional_if passes (ELL active) → optional
        expect((variantOptionalForEllItem?.assignment as AssignmentWithOptional).optional).toBe(true);
      });

      it('should not filter task variants for supervisory roles', async () => {
        // Uses pre-seeded fixture: schoolATeacher (supervisory role) should see ALL variants
        // including variantForGrade3 which students wouldn't see
        const authContext = { userId: baseFixture.schoolATeacher.id, isSuperAdmin: false };
        const result = await service.listTaskVariants(
          authContext,
          baseFixture.administrationAssignedToDistrict.id,
          defaultTaskVariantOptions,
        );

        // Teacher sees all 4 variants
        expect(result.items).toHaveLength(4);
        expect(result.totalItems).toBe(4);

        // Supervisory roles should get raw conditions, not optional flag
        expect((result.items[0]?.assignment as Partial<AssignmentWithOptional>).optional).toBeUndefined();
      });

      it('should show all variants to super admin regardless of conditions', async () => {
        // Uses pre-seeded fixture: super admin sees all variants
        const authContext = { userId: baseFixture.districtAdmin.id, isSuperAdmin: true };
        const result = await service.listTaskVariants(
          authContext,
          baseFixture.administrationAssignedToDistrict.id,
          defaultTaskVariantOptions,
        );

        // Super admin sees all 4 variants
        expect(result.items).toHaveLength(4);
        expect(result.totalItems).toBe(4);
      });

      it('should handle composite AND conditions for assigned_if', async () => {
        const student = await UserFactory.create({ grade: '5' });
        await UserOrgFactory.create({
          userId: student.id,
          orgId: baseFixture.district.id,
          role: UserRole.STUDENT,
        });

        const task = await TaskFactory.create({ name: 'Composite AND Test Task' });
        const variantInRange = await TaskVariantFactory.create({ taskId: task.id, name: 'In Grade Range' });
        const variantOutOfRange = await TaskVariantFactory.create({ taskId: task.id, name: 'Out of Grade Range' });

        const administration = await AdministrationFactory.create({
          name: 'Composite AND Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.district.id,
        });

        // assigned_if: grade >= 3 AND grade <= 6 (student is grade 5, should pass)
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variantInRange.id,
          orderIndex: 0,
          conditionsAssignment: {
            op: 'AND',
            conditions: [
              { field: 'studentData.grade', op: 'GREATER_THAN_OR_EQUAL', value: 3 },
              { field: 'studentData.grade', op: 'LESS_THAN_OR_EQUAL', value: 6 },
            ],
          },
        });

        // assigned_if: grade >= 7 AND grade <= 10 (student is grade 5, should fail)
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variantOutOfRange.id,
          orderIndex: 1,
          conditionsAssignment: {
            op: 'AND',
            conditions: [
              { field: 'studentData.grade', op: 'GREATER_THAN_OR_EQUAL', value: 7 },
              { field: 'studentData.grade', op: 'LESS_THAN_OR_EQUAL', value: 10 },
            ],
          },
        });

        const authContext = { userId: student.id, isSuperAdmin: false };
        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.variant.id).toBe(variantInRange.id);
      });

      it('should handle composite OR conditions for assigned_if', async () => {
        const student = await UserFactory.create({ grade: '5' });
        await UserOrgFactory.create({
          userId: student.id,
          orgId: baseFixture.district.id,
          role: UserRole.STUDENT,
        });

        const task = await TaskFactory.create({ name: 'Composite OR Test Task' });
        const variantMatchesOR = await TaskVariantFactory.create({ taskId: task.id, name: 'Matches OR' });
        const variantNoMatch = await TaskVariantFactory.create({ taskId: task.id, name: 'No OR Match' });

        const administration = await AdministrationFactory.create({
          name: 'Composite OR Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.district.id,
        });

        // assigned_if: grade == 3 OR grade == 5 (student is grade 5, should pass)
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variantMatchesOR.id,
          orderIndex: 0,
          conditionsAssignment: {
            op: 'OR',
            conditions: [
              { field: 'studentData.grade', op: 'EQUAL', value: 3 },
              { field: 'studentData.grade', op: 'EQUAL', value: 5 },
            ],
          },
        });

        // assigned_if: grade == 1 OR grade == 2 (student is grade 5, should fail)
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variantNoMatch.id,
          orderIndex: 1,
          conditionsAssignment: {
            op: 'OR',
            conditions: [
              { field: 'studentData.grade', op: 'EQUAL', value: 1 },
              { field: 'studentData.grade', op: 'EQUAL', value: 2 },
            ],
          },
        });

        const authContext = { userId: student.id, isSuperAdmin: false };
        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.variant.id).toBe(variantMatchesOR.id);
      });

      it('should return empty array when no variants match assigned_if', async () => {
        const student = await UserFactory.create({ grade: '1' });
        await UserOrgFactory.create({
          userId: student.id,
          orgId: baseFixture.district.id,
          role: UserRole.STUDENT,
        });

        const task = await TaskFactory.create({ name: 'No Match Test Task' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, name: 'Grade 5 Only Variant' });

        const administration = await AdministrationFactory.create({
          name: 'No Match Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.district.id,
        });

        // assigned_if: grade 5 (student is grade 1, should not see)
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant.id,
          orderIndex: 0,
          conditionsAssignment: { field: 'studentData.grade', op: 'EQUAL', value: 5 },
        });

        const authContext = { userId: student.id, isSuperAdmin: false };
        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });

      it('should handle composite conditions for optional_if', async () => {
        const student = await UserFactory.create({ grade: '5', statusEll: 'active', statusIep: 'true' });
        await UserOrgFactory.create({
          userId: student.id,
          orgId: baseFixture.district.id,
          role: UserRole.STUDENT,
        });

        const task = await TaskFactory.create({ name: 'Composite Optional Test Task' });
        const variantOptionalAND = await TaskVariantFactory.create({ taskId: task.id, name: 'Optional AND' });
        const variantRequiredAND = await TaskVariantFactory.create({ taskId: task.id, name: 'Required AND' });

        const administration = await AdministrationFactory.create({
          name: 'Composite Optional Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.district.id,
        });

        // Assigned to all, optional_if: ELL active AND IEP true (both pass → optional)
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variantOptionalAND.id,
          orderIndex: 0,
          conditionsRequirements: {
            op: 'AND',
            conditions: [
              { field: 'studentData.statusEll', op: 'EQUAL', value: 'active' },
              { field: 'studentData.statusIep', op: 'EQUAL', value: 'true' },
            ],
          },
        });

        // Assigned to all, optional_if: ELL inactive AND IEP true (ELL fails → required)
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variantRequiredAND.id,
          orderIndex: 1,
          conditionsRequirements: {
            op: 'AND',
            conditions: [
              { field: 'studentData.statusEll', op: 'EQUAL', value: 'inactive' },
              { field: 'studentData.statusIep', op: 'EQUAL', value: 'true' },
            ],
          },
        });

        const authContext = { userId: student.id, isSuperAdmin: false };
        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        expect(result.items).toHaveLength(2);

        const optionalItem = result.items.find((item) => item.variant.id === variantOptionalAND.id);
        const requiredItem = result.items.find((item) => item.variant.id === variantRequiredAND.id);

        expect((optionalItem?.assignment as AssignmentWithOptional).optional).toBe(true);
        expect((requiredItem?.assignment as AssignmentWithOptional).optional).toBe(false);
      });

      it('should exclude variants when user has null field referenced in assigned_if condition', async () => {
        // Student with null grade - should NOT match assigned_if: grade === 5
        const studentWithNullGrade = await UserFactory.create({ grade: null });
        await UserOrgFactory.create({
          userId: studentWithNullGrade.id,
          orgId: baseFixture.district.id,
          role: UserRole.STUDENT,
        });

        const task = await TaskFactory.create({ name: 'Null Field Test Task' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, name: 'Grade Required Variant' });

        const administration = await AdministrationFactory.create({
          name: 'Null Field Test Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.district.id,
        });

        // assigned_if: grade equals 5 (student has null grade, should not see)
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant.id,
          orderIndex: 0,
          conditionsAssignment: { field: 'studentData.grade', op: 'EQUAL', value: 5 },
        });

        const authContext = { userId: studentWithNullGrade.id, isSuperAdmin: false };
        const result = await service.listTaskVariants(authContext, administration.id, defaultTaskVariantOptions);

        // Variant should be excluded because null grade cannot match grade === 5
        expect(result.items).toHaveLength(0);
        expect(result.totalItems).toBe(0);
      });
    });

    describe('sorting', () => {
      it('should sort by orderIndex by default (ascending)', async () => {
        // Uses pre-seeded fixture: 4 variants with orderIndex 0, 1, 2, 3
        const result = await service.listTaskVariants(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: true },
          baseFixture.administrationAssignedToDistrict.id,
          defaultTaskVariantOptions,
        );

        // Should be sorted by orderIndex: 0, 1, 2, 3
        expect(result.items[0]!.assignment.orderIndex).toBe(0);
        expect(result.items[0]!.variant.id).toBe(baseFixture.variantForAllGrades.id);
        expect(result.items[1]!.assignment.orderIndex).toBe(1);
        expect(result.items[1]!.variant.id).toBe(baseFixture.variantForGrade5.id);
        expect(result.items[2]!.assignment.orderIndex).toBe(2);
        expect(result.items[2]!.variant.id).toBe(baseFixture.variantForGrade3.id);
        expect(result.items[3]!.assignment.orderIndex).toBe(3);
        expect(result.items[3]!.variant.id).toBe(baseFixture.variantOptionalForEll.id);
      });

      it('should sort by name when requested', async () => {
        const task = await TaskFactory.create({ name: 'Name Sort Test Task' });
        const variant1 = await TaskVariantFactory.create({ taskId: task.id, name: 'Zebra' });
        const variant2 = await TaskVariantFactory.create({ taskId: task.id, name: 'Apple' });
        const variant3 = await TaskVariantFactory.create({ taskId: task.id, name: 'Mango' });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Name Sort Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant1.id,
          orderIndex: 0,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant2.id,
          orderIndex: 1,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant3.id,
          orderIndex: 2,
        });

        const result = await service.listTaskVariants(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: true },
          administration.id,
          {
            ...defaultTaskVariantOptions,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        );

        // Should be sorted by name alphabetically: Apple, Mango, Zebra
        expect(result.items[0]!.variant.name).toBe('Apple');
        expect(result.items[1]!.variant.name).toBe('Mango');
        expect(result.items[2]!.variant.name).toBe('Zebra');
      });

      it('should sort by orderIndex descending when requested', async () => {
        const task = await TaskFactory.create({ name: 'Desc Sort Test Task' });
        const variant1 = await TaskVariantFactory.create({ taskId: task.id, name: 'First' });
        const variant2 = await TaskVariantFactory.create({ taskId: task.id, name: 'Second' });
        const variant3 = await TaskVariantFactory.create({ taskId: task.id, name: 'Third' });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Desc Sort Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant1.id,
          orderIndex: 0,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant2.id,
          orderIndex: 1,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant3.id,
          orderIndex: 2,
        });

        const result = await service.listTaskVariants(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: true },
          administration.id,
          {
            ...defaultTaskVariantOptions,
            sortBy: 'orderIndex',
            sortOrder: 'desc',
          },
        );

        // Should be sorted by orderIndex descending: 2, 1, 0
        expect(result.items[0]!.assignment.orderIndex).toBe(2);
        expect(result.items[0]!.variant.id).toBe(variant3.id);
        expect(result.items[1]!.assignment.orderIndex).toBe(1);
        expect(result.items[1]!.variant.id).toBe(variant2.id);
        expect(result.items[2]!.assignment.orderIndex).toBe(0);
        expect(result.items[2]!.variant.id).toBe(variant1.id);
      });
    });

    describe('response shape validation', () => {
      it('should return proper response shape with all fields', async () => {
        const task = await TaskFactory.create({ name: 'Shape Test Task' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, name: 'Shape Test Variant' });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Shape Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant.id,
          orderIndex: 5,
        });

        const result = await service.listTaskVariants(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: true },
          administration.id,
          defaultTaskVariantOptions,
        );

        expect(result.totalItems).toBe(1);
        expect(result.items).toHaveLength(1);

        const item = result.items[0]!;
        expect(item.variant).toHaveProperty('id', variant.id);
        expect(item.variant).toHaveProperty('name', 'Shape Test Variant');
        expect(item.assignment).toHaveProperty('orderIndex', 5);
        expect(item.task).toHaveProperty('id', task.id);
        expect(item.task).toHaveProperty('name', 'Shape Test Task');
      });

      it('should handle null variant name', async () => {
        const task = await TaskFactory.create({ name: 'Null Name Test Task' });
        const variant = await TaskVariantFactory.create({ taskId: task.id, name: null });

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Null Name Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await AdministrationTaskVariantFactory.create({
          administrationId: administration.id,
          taskVariantId: variant.id,
          orderIndex: 0,
        });

        const result = await service.listTaskVariants(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: true },
          administration.id,
          defaultTaskVariantOptions,
        );

        expect(result.items[0]!.variant.name).toBeNull();
      });

      it('should return empty array for administration with no task variants', async () => {
        // Create an administration without assigning any task variants
        const administration = await AdministrationFactory.create({
          name: 'Empty Task Variants Admin',
          createdBy: baseFixture.districtAdmin.id,
        });
        // Give the admin access to this administration
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.district.id,
        });

        const result = await service.listTaskVariants(
          { userId: baseFixture.districtAdmin.id, isSuperAdmin: true },
          administration.id,
          defaultTaskVariantOptions,
        );

        expect(result.totalItems).toBe(0);
        expect(result.items).toEqual([]);
      });
    });

    describe('access control edge cases', () => {
      it('should return 404 when administration does not exist', async () => {
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listTaskVariants(authContext, '00000000-0000-0000-0000-000000000000', defaultTaskVariantOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      });

      it('should return 403 when user has no access to administration', async () => {
        // Create an administration in districtB that districtAdmin has no access to
        const administration = await AdministrationFactory.create({
          name: 'Task Variant No Access Test',
          createdBy: baseFixture.districtBAdmin.id,
        });
        await AdministrationOrgFactory.create({
          administrationId: administration.id,
          orgId: baseFixture.districtB.id,
        });

        // districtAdmin has no access to districtB
        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listTaskVariants(authContext, administration.id, defaultTaskVariantOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
        expect((error as ApiError).message).toBe('You do not have permission to perform this action');
      });
    });

    describe('pagination', () => {
      it('should correctly paginate task variant results', async () => {
        const task = await TaskFactory.create({ name: 'Pagination Task' });
        const variants = await Promise.all([
          TaskVariantFactory.create({ taskId: task.id, name: 'Pagination Variant A' }),
          TaskVariantFactory.create({ taskId: task.id, name: 'Pagination Variant B' }),
          TaskVariantFactory.create({ taskId: task.id, name: 'Pagination Variant C' }),
        ]);

        const administration = await AdministrationFactory.create({
          name: 'Task Variant Pagination Test',
          createdBy: baseFixture.districtAdmin.id,
        });
        await Promise.all(
          variants.map((variant, index) =>
            AdministrationTaskVariantFactory.create({
              administrationId: administration.id,
              taskVariantId: variant.id,
              orderIndex: index,
            }),
          ),
        );

        const authContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: true,
        };

        // Get first page with 2 items
        const page1 = await service.listTaskVariants(authContext, administration.id, {
          page: 1,
          perPage: 2,
          sortBy: 'orderIndex',
          sortOrder: 'asc',
        });

        expect(page1.totalItems).toBe(3);
        expect(page1.items).toHaveLength(2);
        expect(page1.items[0]!.assignment.orderIndex).toBe(0);
        expect(page1.items[1]!.assignment.orderIndex).toBe(1);

        // Get second page
        const page2 = await service.listTaskVariants(authContext, administration.id, {
          page: 2,
          perPage: 2,
          sortBy: 'orderIndex',
          sortOrder: 'asc',
        });

        expect(page2.totalItems).toBe(3);
        expect(page2.items).toHaveLength(1);
        expect(page2.items[0]!.assignment.orderIndex).toBe(2);
      });
    });
  });

  describe('listAgreements', () => {
    const defaultAgreementOptions = {
      page: 1,
      perPage: 100,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
      locale: 'en-US',
    };

    describe('authorization', () => {
      it('should allow students to list agreements', async () => {
        // Unlike districts/schools/classes, students CAN access agreements
        // because they need to know what to sign
        const authContext = {
          userId: baseFixture.schoolAStudent.id,
          isSuperAdmin: false,
        };

        // Create test data for this test
        // Set requiresMajorityAge: false to ensure agreement is visible regardless of student's age
        const agreement = await AgreementFactory.create({ agreementType: 'consent', requiresMajorityAge: false });
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: agreement.id } },
        );
        await AdministrationAgreementFactory.create(undefined, {
          transient: {
            administrationId: baseFixture.administrationAssignedToDistrict.id,
            agreementId: agreement.id,
          },
        });

        const result = await service.listAgreements(
          authContext,
          baseFixture.administrationAssignedToDistrict.id,
          defaultAgreementOptions,
        );

        expect(result.items.length).toBeGreaterThanOrEqual(1);
        const found = result.items.find((item) => item.agreement.id === agreement.id);
        expect(found).toBeDefined();
      });

      it('should return 404 when administration does not exist', async () => {
        const authContext = {
          userId: baseFixture.schoolAStudent.id,
          isSuperAdmin: false,
        };

        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const error = await service.listAgreements(authContext, nonExistentId, defaultAgreementOptions).catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      });

      it('should return 403 when user lacks access to administration', async () => {
        // Create a user with no administration access
        const isolatedUser = await UserFactory.create({ userType: 'student' });
        const authContext = {
          userId: isolatedUser.id,
          isSuperAdmin: false,
        };

        const error = await service
          .listAgreements(authContext, baseFixture.administrationAssignedToDistrict.id, defaultAgreementOptions)
          .catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(403);
      });
    });

    describe('data retrieval', () => {
      it('should return agreements with current version for requested locale', async () => {
        // Create an isolated administration for this test
        const administration = await AdministrationFactory.create({ createdBy: baseFixture.schoolATeacher.id });
        const school = await OrgFactory.create({ orgType: 'school' });
        await AdministrationOrgFactory.create({ administrationId: administration.id, orgId: school.id });

        // Create teacher with access
        const teacher = await UserFactory.create({ userType: 'educator' });
        await UserOrgFactory.create({ userId: teacher.id, orgId: school.id, role: UserRole.TEACHER });

        // Create agreement with English (US) and Spanish versions
        const agreement = await AgreementFactory.create({ name: 'Test Agreement', agreementType: 'tos' });
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true, githubFilename: 'TOS_EN.md' },
          { transient: { agreementId: agreement.id } },
        );
        await AgreementVersionFactory.create(
          { locale: 'es', isCurrent: true, githubFilename: 'TOS_ES.md' },
          { transient: { agreementId: agreement.id } },
        );

        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: agreement.id },
        });

        const authContext = { userId: teacher.id, isSuperAdmin: false };

        // Request English (US) version
        const resultEn = await service.listAgreements(authContext, administration.id, {
          ...defaultAgreementOptions,
          locale: 'en-US',
        });

        expect(resultEn.items).toHaveLength(1);
        expect(resultEn.items[0]!.agreement.name).toBe('Test Agreement');
        expect(resultEn.items[0]!.currentVersion).not.toBeNull();
        expect(resultEn.items[0]!.currentVersion!.locale).toBe('en-US');
        expect(resultEn.items[0]!.currentVersion!.githubFilename).toBe('TOS_EN.md');

        // Request Spanish version
        const resultEs = await service.listAgreements(authContext, administration.id, {
          ...defaultAgreementOptions,
          locale: 'es',
        });

        expect(resultEs.items).toHaveLength(1);
        expect(resultEs.items[0]!.currentVersion!.locale).toBe('es');
        expect(resultEs.items[0]!.currentVersion!.githubFilename).toBe('TOS_ES.md');
      });

      it('should return null currentVersion when no version exists for requested locale', async () => {
        const administration = await AdministrationFactory.create({ createdBy: baseFixture.schoolATeacher.id });
        const school = await OrgFactory.create({ orgType: 'school' });
        await AdministrationOrgFactory.create({ administrationId: administration.id, orgId: school.id });

        const teacher = await UserFactory.create({ userType: 'educator' });
        await UserOrgFactory.create({ userId: teacher.id, orgId: school.id, role: UserRole.TEACHER });

        // Create agreement with only English (US) version
        const agreement = await AgreementFactory.create({ agreementType: 'consent' });
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: agreement.id } },
        );
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: agreement.id },
        });

        const authContext = { userId: teacher.id, isSuperAdmin: false };

        // Request French version (doesn't exist)
        const result = await service.listAgreements(authContext, administration.id, {
          ...defaultAgreementOptions,
          locale: 'fr',
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.currentVersion).toBeNull();
      });

      it('should filter by agreementType', async () => {
        const administration = await AdministrationFactory.create({ createdBy: baseFixture.schoolATeacher.id });
        const school = await OrgFactory.create({ orgType: 'school' });
        await AdministrationOrgFactory.create({ administrationId: administration.id, orgId: school.id });

        const teacher = await UserFactory.create({ userType: 'educator' });
        await UserOrgFactory.create({ userId: teacher.id, orgId: school.id, role: UserRole.TEACHER });

        // Create different agreement types
        const tosAgreement = await AgreementFactory.create({ agreementType: 'tos', name: 'TOS Agreement' });
        const consentAgreement = await AgreementFactory.create({ agreementType: 'consent', name: 'Consent Agreement' });

        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: tosAgreement.id } },
        );
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: consentAgreement.id } },
        );

        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: tosAgreement.id },
        });
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: consentAgreement.id },
        });

        const authContext = { userId: teacher.id, isSuperAdmin: false };

        // Filter by TOS only
        const result = await service.listAgreements(authContext, administration.id, {
          ...defaultAgreementOptions,
          agreementType: 'tos',
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.agreementType).toBe('tos');
        expect(result.items[0]!.agreement.name).toBe('TOS Agreement');
      });

      it('should sort agreements by name', async () => {
        const administration = await AdministrationFactory.create({ createdBy: baseFixture.schoolATeacher.id });
        const school = await OrgFactory.create({ orgType: 'school' });
        await AdministrationOrgFactory.create({ administrationId: administration.id, orgId: school.id });

        const teacher = await UserFactory.create({ userType: 'educator' });
        await UserOrgFactory.create({ userId: teacher.id, orgId: school.id, role: UserRole.TEACHER });

        // Create agreements with specific names for sorting
        const agreementZ = await AgreementFactory.create({ name: 'Zebra Agreement' });
        const agreementA = await AgreementFactory.create({ name: 'Apple Agreement' });

        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: agreementZ.id } },
        );
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: agreementA.id } },
        );

        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: agreementZ.id },
        });
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: agreementA.id },
        });

        const authContext = { userId: teacher.id, isSuperAdmin: false };

        // Sort ascending
        const resultAsc = await service.listAgreements(authContext, administration.id, {
          ...defaultAgreementOptions,
          sortBy: 'name',
          sortOrder: 'asc',
        });

        expect(resultAsc.items).toHaveLength(2);
        expect(resultAsc.items[0]!.agreement.name).toBe('Apple Agreement');
        expect(resultAsc.items[1]!.agreement.name).toBe('Zebra Agreement');

        // Sort descending
        const resultDesc = await service.listAgreements(authContext, administration.id, {
          ...defaultAgreementOptions,
          sortBy: 'name',
          sortOrder: 'desc',
        });

        expect(resultDesc.items).toHaveLength(2);
        expect(resultDesc.items[0]!.agreement.name).toBe('Zebra Agreement');
        expect(resultDesc.items[1]!.agreement.name).toBe('Apple Agreement');
      });
    });

    describe('majority age filtering', () => {
      it('should filter out requiresMajorityAge agreements for student under 18 (by dob)', async () => {
        // Create isolated administration
        const administration = await AdministrationFactory.create({ createdBy: baseFixture.schoolATeacher.id });
        const school = await OrgFactory.create({ orgType: 'school' });
        await AdministrationOrgFactory.create({ administrationId: administration.id, orgId: school.id });

        // Create student under 18 (10 years old)
        const tenYearsAgo = new Date();
        tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
        const dobString = tenYearsAgo.toISOString().split('T')[0]!;
        const youngStudent = await UserFactory.create({ userType: 'student', dob: dobString });
        await UserOrgFactory.create({ userId: youngStudent.id, orgId: school.id, role: UserRole.STUDENT });

        // Create regular and majority-age agreements
        const regularAgreement = await AgreementFactory.create({
          name: 'Regular Agreement',
          requiresMajorityAge: false,
        });
        const adultAgreement = await AgreementFactory.create({
          name: 'Adult Agreement',
          requiresMajorityAge: true,
        });

        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: regularAgreement.id } },
        );
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: adultAgreement.id } },
        );
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: regularAgreement.id },
        });
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: adultAgreement.id },
        });

        const authContext = { userId: youngStudent.id, isSuperAdmin: false };
        const result = await service.listAgreements(authContext, administration.id, defaultAgreementOptions);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]!.agreement.name).toBe('Regular Agreement');
      });

      it('should include requiresMajorityAge agreements for student 18+ (by dob)', async () => {
        const administration = await AdministrationFactory.create({ createdBy: baseFixture.schoolATeacher.id });
        const school = await OrgFactory.create({ orgType: 'school' });
        await AdministrationOrgFactory.create({ administrationId: administration.id, orgId: school.id });

        // Create adult student (20 years old)
        const twentyYearsAgo = new Date();
        twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
        const dobString = twentyYearsAgo.toISOString().split('T')[0]!;
        const adultStudent = await UserFactory.create({ userType: 'student', dob: dobString });
        await UserOrgFactory.create({ userId: adultStudent.id, orgId: school.id, role: UserRole.STUDENT });

        // Create both types of agreements
        const regularAgreement = await AgreementFactory.create({ requiresMajorityAge: false });
        const adultAgreement = await AgreementFactory.create({ requiresMajorityAge: true });

        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: regularAgreement.id } },
        );
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: adultAgreement.id } },
        );
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: regularAgreement.id },
        });
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: adultAgreement.id },
        });

        const authContext = { userId: adultStudent.id, isSuperAdmin: false };
        const result = await service.listAgreements(authContext, administration.id, defaultAgreementOptions);

        expect(result.items).toHaveLength(2);
      });

      it('should filter by grade when dob is not available', async () => {
        const administration = await AdministrationFactory.create({ createdBy: baseFixture.schoolATeacher.id });
        const school = await OrgFactory.create({ orgType: 'school' });
        await AdministrationOrgFactory.create({ administrationId: administration.id, orgId: school.id });

        // Create student with grade 11 (typical age 17, under 18) but no dob
        const studentGrade11 = await UserFactory.create({ userType: 'student', dob: null, grade: '11' });
        await UserOrgFactory.create({ userId: studentGrade11.id, orgId: school.id, role: UserRole.STUDENT });

        // Create student with grade 12 (typical age 18+) but no dob
        const studentGrade12 = await UserFactory.create({ userType: 'student', dob: null, grade: '12' });
        await UserOrgFactory.create({ userId: studentGrade12.id, orgId: school.id, role: UserRole.STUDENT });

        // Create both types of agreements
        const regularAgreement = await AgreementFactory.create({
          name: 'Regular',
          requiresMajorityAge: false,
        });
        const adultAgreement = await AgreementFactory.create({
          name: 'Adult Only',
          requiresMajorityAge: true,
        });

        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: regularAgreement.id } },
        );
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: adultAgreement.id } },
        );
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: regularAgreement.id },
        });
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: adultAgreement.id },
        });

        // Grade 11 student should only see regular agreement
        const authContextGrade11 = { userId: studentGrade11.id, isSuperAdmin: false };
        const resultGrade11 = await service.listAgreements(
          authContextGrade11,
          administration.id,
          defaultAgreementOptions,
        );
        expect(resultGrade11.items).toHaveLength(1);
        expect(resultGrade11.items[0]!.agreement.name).toBe('Regular');

        // Grade 12 student should see both agreements
        const authContextGrade12 = { userId: studentGrade12.id, isSuperAdmin: false };
        const resultGrade12 = await service.listAgreements(
          authContextGrade12,
          administration.id,
          defaultAgreementOptions,
        );
        expect(resultGrade12.items).toHaveLength(2);
      });

      it('should not filter for supervisory roles (teachers see all)', async () => {
        const administration = await AdministrationFactory.create({ createdBy: baseFixture.schoolATeacher.id });
        const school = await OrgFactory.create({ orgType: 'school' });
        await AdministrationOrgFactory.create({ administrationId: administration.id, orgId: school.id });

        const teacher = await UserFactory.create({ userType: 'educator' });
        await UserOrgFactory.create({ userId: teacher.id, orgId: school.id, role: UserRole.TEACHER });

        const regularAgreement = await AgreementFactory.create({ requiresMajorityAge: false });
        const adultAgreement = await AgreementFactory.create({ requiresMajorityAge: true });

        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: regularAgreement.id } },
        );
        await AgreementVersionFactory.create(
          { locale: 'en-US', isCurrent: true },
          { transient: { agreementId: adultAgreement.id } },
        );
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: regularAgreement.id },
        });
        await AdministrationAgreementFactory.create(undefined, {
          transient: { administrationId: administration.id, agreementId: adultAgreement.id },
        });

        const authContext = { userId: teacher.id, isSuperAdmin: false };
        const result = await service.listAgreements(authContext, administration.id, defaultAgreementOptions);

        // Teachers see all agreements regardless of requiresMajorityAge
        expect(result.items).toHaveLength(2);
      });
    });
  });
});
