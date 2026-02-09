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
import { AdministrationFactory } from '../../test-support/factories/administration.factory';
import { AdministrationOrgFactory } from '../../test-support/factories/administration-org.factory';
import { UserRole } from '../../enums/user-role.enum';
import { ApiError } from '../../errors/api-error';

describe('AdministrationService (integration)', () => {
  const service = AdministrationService();

  const defaultDistrictOptions = {
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

        await expect(
          service.listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions),
        ).rejects.toThrow(ApiError);

        try {
          await service.listDistricts(
            authContext,
            baseFixture.administrationAssignedToDistrict.id,
            defaultDistrictOptions,
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
          expect((error as ApiError).message).toBe('Supervised users cannot list administration districts');
        }
      });

      it('should return 403 when class-level student tries to list districts', async () => {
        // classAStudent is a student in classInSchoolA
        // They have access to administrationAssignedToDistrict via class → school → district ancestry
        const authContext = {
          userId: baseFixture.classAStudent.id,
          isSuperAdmin: false,
        };

        await expect(
          service.listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions),
        ).rejects.toThrow(ApiError);

        try {
          await service.listDistricts(
            authContext,
            baseFixture.administrationAssignedToDistrict.id,
            defaultDistrictOptions,
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
        }
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

        await expect(
          service.listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions),
        ).rejects.toThrow(ApiError);

        try {
          await service.listDistricts(
            authContext,
            baseFixture.administrationAssignedToDistrict.id,
            defaultDistrictOptions,
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
        }
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

        await expect(
          service.listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions),
        ).rejects.toThrow(ApiError);

        try {
          await service.listDistricts(
            authContext,
            baseFixture.administrationAssignedToDistrict.id,
            defaultDistrictOptions,
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
        }
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

        await expect(
          service.listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions),
        ).rejects.toThrow(ApiError);

        try {
          await service.listDistricts(
            authContext,
            baseFixture.administrationAssignedToDistrict.id,
            defaultDistrictOptions,
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
        }
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

        await expect(
          service.listDistricts(authContext, '00000000-0000-0000-0000-000000000000', defaultDistrictOptions),
        ).rejects.toThrow(ApiError);

        try {
          await service.listDistricts(authContext, '00000000-0000-0000-0000-000000000000', defaultDistrictOptions);
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(404);
        }
      });

      it('should return 403 when user has no access to administration', async () => {
        // districtBAdmin has no access to administrationAssignedToDistrict
        const authContext = {
          userId: baseFixture.districtBAdmin.id,
          isSuperAdmin: false,
        };

        await expect(
          service.listDistricts(authContext, baseFixture.administrationAssignedToDistrict.id, defaultDistrictOptions),
        ).rejects.toThrow(ApiError);

        try {
          await service.listDistricts(
            authContext,
            baseFixture.administrationAssignedToDistrict.id,
            defaultDistrictOptions,
          );
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(403);
          // This is the "no access to administration" error, not "supervised user" error
          expect((error as ApiError).message).toBe('You do not have permission to access this administration');
        }
      });
    });
  });
});
