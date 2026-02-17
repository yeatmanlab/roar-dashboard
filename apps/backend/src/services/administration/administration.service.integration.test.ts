/**
 * Integration tests for AdministrationService.
 *
 * Tests the service layer against the real database to verify authorization
 * logic that spans multiple layers (service + repository + access controls).
 *
 * These tests complement the unit tests by verifying end-to-end behavior
 * with actual database queries and the base fixture's org hierarchy.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AdministrationService } from './administration.service';
import { baseFixture } from '../../test-support/fixtures';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { UserClassFactory } from '../../test-support/factories/user-class.factory';
import { UserGroupFactory } from '../../test-support/factories/user-group.factory';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { GroupFactory } from '../../test-support/factories/group.factory';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../../test-support/factories/administration-org.factory';
import { AdministrationClassFactory } from '../../test-support/factories/administration-class.factory';
import { AdministrationGroupFactory } from '../../test-support/factories/administration-group.factory';
import { UserRole } from '../../enums/user-role.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ApiError } from '../../errors/api-error';

describe('AdministrationService (integration)', () => {
  // Initialize after database pools are ready (set up in vitest.setup.ts beforeAll)
  let service: ReturnType<typeof AdministrationService>;

  beforeAll(() => {
    service = AdministrationService();
  });

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
});
