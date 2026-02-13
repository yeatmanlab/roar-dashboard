import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { DistrictService } from './district.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import { UserOrgFactory } from '../../test-support/factories/user-org.factory';
import { OrgType } from '../../enums/org-type.enum';
import { UserRole } from '../../enums/user-role.enum';
import type { AuthContext } from '../../types/auth-context';
// TODO: Uncomment when test-db-setup is available
// import { setupTestDatabase, teardownTestDatabase, type TestFixture } from '../../test-support/test-db-setup';

describe('DistrictService Integration Tests', () => {
  let baseFixture: TestFixture;

  beforeAll(async () => {
    baseFixture = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('getById', () => {
    describe('UUID validation', () => {
      it('should reject invalid UUID format', async () => {
        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        await expect(service.getById('not-a-uuid', authContext, {})).rejects.toThrow(ApiError);

        try {
          await service.getById('not-a-uuid', authContext, {});
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(StatusCodes.BAD_REQUEST);
          expect((error as ApiError).code).toBe(ApiErrorCode.REQUEST_VALIDATION_FAILED);
        }
      });

      it('should accept valid UUID format', async () => {
        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {});

        expect(result).toBeDefined();
        expect(result.id).toBe(baseFixture.district.id);
      });
    });

    describe('Authorization', () => {
      it('should allow district admin to access their district', async () => {
        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {});

        expect(result).toBeDefined();
        expect(result.id).toBe(baseFixture.district.id);
        expect(result.name).toBe(baseFixture.district.name);
      });

      it('should allow super admin to access any district', async () => {
        const superAdmin = await UserFactory.create({
          email: 'superadmin@test.com',
          isSuperAdmin: true,
        });

        const service = DistrictService();
        const authContext: AuthContext = {
          userId: superAdmin.id,
          isSuperAdmin: true,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {});

        expect(result).toBeDefined();
        expect(result.id).toBe(baseFixture.district.id);
      });

      it('should deny access to user with no membership', async () => {
        const unauthorizedUser = await UserFactory.create({
          email: 'unauthorized@test.com',
        });

        const service = DistrictService();
        const authContext: AuthContext = {
          userId: unauthorizedUser.id,
          isSuperAdmin: false,
        };

        await expect(service.getById(baseFixture.district.id, authContext, {})).rejects.toThrow(ApiError);

        try {
          await service.getById(baseFixture.district.id, authContext, {});
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
          // Should not distinguish between "not found" and "no access"
          expect((error as ApiError).message).toBe('District not found');
        }
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

        const service = DistrictService();
        const authContext: AuthContext = {
          userId: schoolAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {});

        expect(result).toBeDefined();
        expect(result.id).toBe(baseFixture.district.id);
      });

      it('should allow teacher in school to access parent district', async () => {
        const teacher = await UserFactory.create({
          email: 'teacher@test.com',
        });

        await UserOrgFactory.create({
          userId: teacher.id,
          orgId: baseFixture.schoolA.id,
          role: UserRole.TEACHER,
        });

        const service = DistrictService();
        const authContext: AuthContext = {
          userId: teacher.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {});

        expect(result).toBeDefined();
        expect(result.id).toBe(baseFixture.district.id);
      });
    });

    describe('Not Found', () => {
      it('should return 404 for non-existent district', async () => {
        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const nonExistentId = '00000000-0000-0000-0000-000000000000';

        await expect(service.getById(nonExistentId, authContext, {})).rejects.toThrow(ApiError);

        try {
          await service.getById(nonExistentId, authContext, {});
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        }
      });

      it('should return 404 when requesting a school ID (not a district)', async () => {
        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        await expect(service.getById(baseFixture.schoolA.id, authContext, {})).rejects.toThrow(ApiError);

        try {
          await service.getById(baseFixture.schoolA.id, authContext, {});
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        }
      });
    });

    describe('Children Embed', () => {
      it('should return district without children when embedChildren=false', async () => {
        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {
          embedChildren: false,
        });

        expect(result).toBeDefined();
        expect(result.children).toBeUndefined();
      });

      it('should return district with children when embedChildren=true', async () => {
        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {
          embedChildren: true,
        });

        expect(result).toBeDefined();
        expect(result.children).toBeDefined();
        expect(result.children!.length).toBeGreaterThan(0);

        // Verify children are schools
        const childIds = result.children!.map((c) => c.id);
        expect(childIds).toContain(baseFixture.schoolA.id);
      });

      it('should exclude ended children by default', async () => {
        // Create an ended school
        const endedSchool = await OrgFactory.create({
          orgType: OrgType.SCHOOL,
          parentOrgId: baseFixture.district.id,
          name: 'Ended School',
          rosteringEnded: new Date('2020-01-01'),
        });

        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {
          embedChildren: true,
        });

        expect(result).toBeDefined();
        expect(result.children).toBeDefined();

        const childIds = result.children!.map((c) => c.id);
        expect(childIds).not.toContain(endedSchool.id);
      });

      it('should return empty children array for district with no children', async () => {
        const emptyDistrict = await OrgFactory.create({
          orgType: OrgType.DISTRICT,
          name: 'Empty District',
        });

        const districtAdmin = await UserFactory.create({
          email: 'emptydistrictadmin@test.com',
        });

        await UserOrgFactory.create({
          userId: districtAdmin.id,
          orgId: emptyDistrict.id,
          role: UserRole.ADMINISTRATOR,
        });

        const service = DistrictService();
        const authContext: AuthContext = {
          userId: districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(emptyDistrict.id, authContext, {
          embedChildren: true,
        });

        expect(result).toBeDefined();
        expect(result.children).toBeDefined();
        expect(result.children).toHaveLength(0);
      });
    });

    describe('District Data', () => {
      it('should return complete district data', async () => {
        const service = DistrictService();
        const authContext: AuthContext = {
          userId: baseFixture.districtAdmin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(baseFixture.district.id, authContext, {});

        expect(result).toMatchObject({
          id: baseFixture.district.id,
          name: baseFixture.district.name,
          abbreviation: baseFixture.district.abbreviation,
          orgType: 'district',
          isRosteringRootOrg: baseFixture.district.isRosteringRootOrg,
        });
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeDefined();
      });

      it('should handle district with rosteringEnded timestamp', async () => {
        const endedDistrict = await OrgFactory.create({
          orgType: OrgType.DISTRICT,
          name: 'Ended District',
          rosteringEnded: new Date('2023-12-31'),
        });

        const admin = await UserFactory.create({
          email: 'endeddistrictadmin@test.com',
        });

        await UserOrgFactory.create({
          userId: admin.id,
          orgId: endedDistrict.id,
          role: UserRole.ADMINISTRATOR,
        });

        const service = DistrictService();
        const authContext: AuthContext = {
          userId: admin.id,
          isSuperAdmin: false,
        };

        const result = await service.getById(endedDistrict.id, authContext, {});

        expect(result).toBeDefined();
        expect(result.rosteringEnded).toBeInstanceOf(Date);
        expect(result.rosteringEnded?.toISOString()).toContain('2023-12-31');
      });
    });
  });
});
