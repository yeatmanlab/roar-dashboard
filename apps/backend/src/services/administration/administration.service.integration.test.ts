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
import { OrgFactory } from '../../test-support/factories/org.factory';
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../../test-support/factories/administration-org.factory';
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
});
