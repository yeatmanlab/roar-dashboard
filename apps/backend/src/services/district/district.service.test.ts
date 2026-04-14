import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { SortOrder, DistrictDetailSortField, DistrictSchoolSortField } from '@roar-dashboard/api-contract';
import { DistrictService } from './district.service';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { EnrolledOrgUserFactory } from '../../test-support/factories/user.factory';
import { createMockDistrictRepository, createMockSchoolRepository } from '../../test-support/repositories';
import { OrgType } from '../../enums/org-type.enum';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { createMockAuthorizationService } from '../../test-support/services';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import { UserRole } from '../../enums/user-role.enum';
import type { District } from '../../repositories/district.repository';

describe('DistrictService', () => {
  const mockDistrictRepository = createMockDistrictRepository();
  const mockAuthorizationService = createMockAuthorizationService();
  const mockSchoolRepository = createMockSchoolRepository();

  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };
  const mockSuperAdminContext = { userId: 'admin-123', isSuperAdmin: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return all districts for super admins (unrestricted)', async () => {
      const mockDistricts = OrgFactory.buildList(3, { orgType: OrgType.DISTRICT });
      mockDistrictRepository.listAll.mockResolvedValue({
        items: mockDistricts,
        totalItems: 3,
      });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.DESC,
        },
      );

      expect(mockDistrictRepository.listAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: SortOrder.DESC },
        includeEnded: false,
        embedCounts: false,
      });
      expect(mockAuthorizationService.listAccessibleObjects).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use FGA listAccessibleObjects + listByIds for non-super admin users', async () => {
      const mockDistricts = OrgFactory.buildList(2, { orgType: OrgType.DISTRICT });

      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([
        `${FgaType.DISTRICT}:${mockDistricts[0]!.id}`,
        `${FgaType.DISTRICT}:${mockDistricts[1]!.id}`,
      ]);
      mockDistrictRepository.listByIds.mockResolvedValue({
        items: mockDistricts,
        totalItems: 2,
      });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_LIST,
        FgaType.DISTRICT,
      );
      expect(mockDistrictRepository.listByIds).toHaveBeenCalledWith([mockDistricts[0]!.id, mockDistricts[1]!.id], {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: SortOrder.ASC },
        includeEnded: false,
        embedCounts: false,
      });
      expect(mockDistrictRepository.listAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should pass includeEnded parameter to repository', async () => {
      mockDistrictRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
          includeEnded: true,
        },
      );

      expect(mockDistrictRepository.listAll).toHaveBeenCalledWith(
        expect.objectContaining({
          includeEnded: true,
        }),
      );
    });

    it('should pass embedCounts parameter to repository', async () => {
      mockDistrictRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
          embedCounts: true,
        },
      );

      expect(mockDistrictRepository.listAll).toHaveBeenCalledWith(
        expect.objectContaining({
          embedCounts: true,
        }),
      );
    });

    it('should default includeEnded to false when not provided', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([`${FgaType.DISTRICT}:dist-1`]);
      mockDistrictRepository.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockDistrictRepository.listByIds).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          includeEnded: false,
        }),
      );
    });

    it('should default embedCounts to false when not provided', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([`${FgaType.DISTRICT}:dist-1`]);
      mockDistrictRepository.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockDistrictRepository.listByIds).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          embedCounts: false,
        }),
      );
    });

    it('should map sortBy "name" to database column "name"', async () => {
      mockDistrictRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockDistrictRepository.listAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { field: 'name', direction: SortOrder.ASC },
        }),
      );
    });

    it('should map sortBy "abbreviation" to database column "abbreviation"', async () => {
      mockDistrictRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.ABBREVIATION,
          sortOrder: SortOrder.DESC,
        },
      );

      expect(mockDistrictRepository.listAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { field: 'abbreviation', direction: SortOrder.DESC },
        }),
      );
    });

    it('should return empty results when FGA returns no accessible districts', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([]);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list(
        { userId: 'user-no-access', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
      expect(mockDistrictRepository.listByIds).not.toHaveBeenCalled();
    });

    it('should pass pagination options correctly', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue([`${FgaType.DISTRICT}:dist-1`]);
      mockDistrictRepository.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.list(
        { userId: 'user-456', isSuperAdmin: false },
        {
          page: 3,
          perPage: 50,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockDistrictRepository.listByIds).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          page: 3,
          perPage: 50,
        }),
      );
    });

    it('should throw ApiError when repository throws ApiError', async () => {
      const error = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockDistrictRepository.listAll.mockRejectedValue(error);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          {
            page: 1,
            perPage: 25,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        ),
      ).rejects.toThrow(ApiError);
    });

    it('should wrap non-ApiError in ApiError with DATABASE_QUERY_FAILED code', async () => {
      const error = new Error('Unexpected database error');
      mockDistrictRepository.listAll.mockRejectedValue(error);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          {
            page: 1,
            perPage: 25,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        ),
      ).rejects.toMatchObject({
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    });

    it('should return districts with counts when embedCounts is true', async () => {
      const mockDistrictsWithCounts = OrgFactory.buildList(2, { orgType: OrgType.DISTRICT }).map((d) => ({
        ...d,
        counts: {
          users: 100,
          schools: 5,
          classes: 20,
        },
      }));

      mockDistrictRepository.listAll.mockResolvedValue({
        items: mockDistrictsWithCounts,
        totalItems: 2,
      });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: DistrictDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
          embedCounts: true,
        },
      );

      expect(result.items[0]).toHaveProperty('counts');
      expect(result.items[0]!.counts).toEqual({
        users: 100,
        schools: 5,
        classes: 20,
      });
    });
  });

  describe('getById', () => {
    it('should fetch district by ID for regular users via FGA', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Step 1: unrestricted lookup succeeds
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      // Step 3: FGA permission check passes
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getById(mockAuthContext, validUuid);

      expect(result).toEqual(mockDistrict);
    });

    it('should call requirePermission with correct FGA arguments for regular users', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.getById(mockAuthContext, validUuid);

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_READ,
        `${FgaType.DISTRICT}:${validUuid}`,
      );
    });

    it('should use getUnrestrictedById for super admins and skip FGA check', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await service.getById(mockSuperAdminContext, validUuid);

      // Super admins should use unrestricted method, not the FGA check
      expect(mockDistrictRepository.getUnrestrictedById).toHaveBeenCalledWith(validUuid);
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    it('should throw 404 when district not found', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById(mockAuthContext, validUuid)).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        message: ApiErrorMessage.NOT_FOUND,
      });
    });

    it('should throw 403 when FGA denies permission', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // District exists (unrestricted lookup succeeds)
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      // But FGA denies permission
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById(mockAuthContext, validUuid)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        message: ApiErrorMessage.FORBIDDEN,
      });
    });

    it('should wrap database errors in ApiError with DATABASE_QUERY_FAILED code', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const dbError = new Error('Database connection lost');
      mockDistrictRepository.getUnrestrictedById.mockRejectedValue(dbError);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById(mockAuthContext, validUuid)).rejects.toMatchObject({
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('listDistrictSchools', () => {
    const districtId = '123e4567-e89b-12d3-a456-426614174000';
    const mockDistrict = {
      id: districtId,
      name: 'Test District',
      abbreviation: 'TD',
      orgType: OrgType.DISTRICT,
      parentOrgId: null,
      isRosteringRootOrg: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: DistrictSchoolSortField.NAME as 'name' | 'abbreviation',
      sortOrder: 'asc' as const,
    };

    const mockSchools = OrgFactory.buildList(3, { orgType: OrgType.SCHOOL });

    it('returns all schools for super admin without role check', async () => {
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockSchoolRepository.listAllByDistrictId.mockResolvedValue({
        items: mockSchools,
        totalItems: 3,
      });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.listDistrictSchools(mockSuperAdminContext, districtId, defaultOptions);

      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
      expect(mockSchoolRepository.listAllByDistrictId).toHaveBeenCalledWith(districtId, expect.any(Object));
      expect(mockSchoolRepository.listAuthorizedByDistrictId).not.toHaveBeenCalled();
      // Super admin should not trigger role check
      expect(mockDistrictRepository.getUserRolesForDistrict).not.toHaveBeenCalled();
    });

    it('returns authorized schools for supervisory role user', async () => {
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockDistrictRepository.getAuthorizedById.mockResolvedValue(mockDistrict as District);
      mockDistrictRepository.getUserRolesForDistrict.mockResolvedValue([UserRole.ADMINISTRATOR]);
      mockSchoolRepository.listAuthorizedByDistrictId.mockResolvedValue({
        items: mockSchools,
        totalItems: 3,
      });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.listDistrictSchools(mockAuthContext, districtId, defaultOptions);

      expect(result.items).toHaveLength(3);
      expect(mockDistrictRepository.getUserRolesForDistrict).toHaveBeenCalledWith('user-123', districtId);
      expect(mockSchoolRepository.listAuthorizedByDistrictId).toHaveBeenCalledWith(
        { userId: 'user-123', allowedRoles: expect.any(Array) },
        districtId,
        expect.any(Object),
      );
    });

    it('throws 403 when user has only supervised roles', async () => {
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockDistrictRepository.getAuthorizedById.mockResolvedValue(mockDistrict as District);
      mockDistrictRepository.getUserRolesForDistrict.mockResolvedValue([UserRole.STUDENT]);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.listDistrictSchools(mockAuthContext, districtId, defaultOptions)).rejects.toThrow(ApiError);

      try {
        await service.listDistrictSchools(mockAuthContext, districtId, defaultOptions);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.FORBIDDEN);
        expect((error as ApiError).code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      }
    });

    it('throws 404 when district does not exist', async () => {
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.listDistrictSchools(mockAuthContext, districtId, defaultOptions)).rejects.toThrow(ApiError);

      try {
        await service.listDistrictSchools(mockAuthContext, districtId, defaultOptions);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        expect((error as ApiError).code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      }
    });

    it('throws 403 when user lacks access to the district', async () => {
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockDistrictRepository.getAuthorizedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.listDistrictSchools(mockAuthContext, districtId, defaultOptions)).rejects.toThrow(ApiError);

      try {
        await service.listDistrictSchools(mockAuthContext, districtId, defaultOptions);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.FORBIDDEN);
        expect((error as ApiError).code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      }
    });

    it('passes pagination and sorting options to repository', async () => {
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockSchoolRepository.listAllByDistrictId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      await service.listDistrictSchools(mockSuperAdminContext, districtId, {
        page: 3,
        perPage: 50,
        sortBy: DistrictSchoolSortField.ABBREVIATION as 'name' | 'abbreviation',
        sortOrder: 'desc',
      });

      expect(mockSchoolRepository.listAllByDistrictId).toHaveBeenCalledWith(
        districtId,
        expect.objectContaining({
          page: 3,
          perPage: 50,
          orderBy: { field: 'abbreviation', direction: 'desc' },
        }),
      );
    });

    it('passes includeEnded and embedCounts options to repository', async () => {
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockSchoolRepository.listAllByDistrictId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      await service.listDistrictSchools(mockSuperAdminContext, districtId, {
        ...defaultOptions,
        includeEnded: true,
        embedCounts: true,
      });

      expect(mockSchoolRepository.listAllByDistrictId).toHaveBeenCalledWith(
        districtId,
        expect.objectContaining({
          includeEnded: true,
          embedCounts: true,
        }),
      );
    });

    it('wraps non-ApiError in ApiError with DATABASE_QUERY_FAILED code', async () => {
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockSchoolRepository.listAllByDistrictId.mockRejectedValue(new Error('Unexpected DB error'));

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.listDistrictSchools(mockSuperAdminContext, districtId, defaultOptions)).rejects.toThrow(
        ApiError,
      );

      try {
        await service.listDistrictSchools(mockSuperAdminContext, districtId, defaultOptions);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
        expect((error as ApiError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    });

    it('re-throws ApiError without wrapping', async () => {
      const apiError = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(mockDistrict as District);
      mockDistrictRepository.getAuthorizedById.mockResolvedValue(mockDistrict as District);
      mockDistrictRepository.getUserRolesForDistrict.mockRejectedValue(apiError);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.listDistrictSchools(mockAuthContext, districtId, defaultOptions)).rejects.toThrow(apiError);
    });
  });

  describe('listUsers', () => {
    let mockDistrictRepo: ReturnType<typeof createMockDistrictRepository>;

    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'nameLast' as const,
      sortOrder: SortOrder.ASC,
    };

    beforeEach(() => {
      mockDistrictRepo = createMockDistrictRepository();
    });

    it('should return users for super admin (unrestricted)', async () => {
      const mockDistrict = OrgFactory.build({ id: 'district-123', orgType: OrgType.DISTRICT });
      const mockUsers = EnrolledOrgUserFactory.buildList(3);
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(mockDistrict);
      mockDistrictRepo.getUsersByDistrictPath.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
      });

      const result = await service.listUsers(
        { userId: 'admin-123', isSuperAdmin: true },
        'district-123',
        defaultOptions,
      );

      expect(mockDistrictRepo.getUnrestrictedById).toHaveBeenCalledWith('district-123');
      expect(mockDistrictRepo.getUsersByDistrictPath).toHaveBeenCalledWith(mockDistrict.path, {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should check authorization for non-super admin users with supervisory role', async () => {
      const mockDistrict = OrgFactory.build({ id: 'district-123', orgType: OrgType.DISTRICT });
      const mockUsers = EnrolledOrgUserFactory.buildList(2);
      const mockAuthService = createMockAuthorizationService();
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(mockDistrict);
      mockAuthService.requirePermission.mockResolvedValue(undefined);
      mockDistrictRepo.getUserRolesForDistrict.mockResolvedValue([UserRole.ADMINISTRATOR]);
      mockDistrictRepo.getAuthorizedUsersByDistrictId.mockResolvedValue({
        items: mockUsers,
        totalItems: 2,
      });

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
        authorizationService: mockAuthService,
      });

      const result = await service.listUsers(
        { userId: 'user-123', isSuperAdmin: false },
        'district-123',
        defaultOptions,
      );

      expect(mockAuthService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_READ,
        `${FgaType.DISTRICT}:district-123`,
      );
      expect(mockDistrictRepo.getUserRolesForDistrict).toHaveBeenCalledWith('user-123', 'district-123');
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return empty results when district has no users', async () => {
      const mockDistrict = OrgFactory.build({ id: 'district-123', orgType: OrgType.DISTRICT });
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(mockDistrict);
      mockDistrictRepo.getUsersByDistrictPath.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
      });

      const result = await service.listUsers(
        { userId: 'admin-123', isSuperAdmin: true },
        'district-123',
        defaultOptions,
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when district does not exist', async () => {
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw forbidden error when user lacks access to the district', async () => {
      const mockDistrict = OrgFactory.build({ id: 'district-123', orgType: OrgType.DISTRICT });
      const mockAuthService = createMockAuthorizationService();
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(mockDistrict);
      mockAuthService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
        authorizationService: mockAuthService,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'district-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw forbidden error when user has no supervisory role', async () => {
      const mockDistrict = OrgFactory.build({ id: 'district-123', orgType: OrgType.DISTRICT });
      const mockAuthService = createMockAuthorizationService();
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(mockDistrict);
      mockAuthService.requirePermission.mockResolvedValue(undefined);
      mockDistrictRepo.getUserRolesForDistrict.mockResolvedValue([UserRole.GUARDIAN]);

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
        authorizationService: mockAuthService,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'district-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
        context: { userId: 'user-123', districtId: 'district-123', userRoles: [UserRole.GUARDIAN] },
      });
    });

    it('should throw ApiError when database query fails', async () => {
      const mockDistrict = OrgFactory.build({ id: 'district-123', orgType: OrgType.DISTRICT });
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(mockDistrict);
      const dbError = new Error('Connection refused');
      mockDistrictRepo.getUsersByDistrictPath.mockRejectedValue(dbError);

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'district-123', defaultOptions),
      ).rejects.toMatchObject({
        message: 'Failed to retrieve district users',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should pass role filter to repository', async () => {
      const mockDistrict = OrgFactory.build({ id: 'district-123', orgType: OrgType.DISTRICT });
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(mockDistrict);
      mockDistrictRepo.getUsersByDistrictPath.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
      });

      await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'district-123', {
        ...defaultOptions,
        role: UserRole.STUDENT,
      });

      expect(mockDistrictRepo.getUsersByDistrictPath).toHaveBeenCalledWith(mockDistrict.path, {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        role: UserRole.STUDENT,
      });
    });

    it('should pass grade filter to repository', async () => {
      const mockDistrict = OrgFactory.build({ id: 'district-123', orgType: OrgType.DISTRICT });
      mockDistrictRepo.getUnrestrictedById.mockResolvedValue(mockDistrict);
      mockDistrictRepo.getUsersByDistrictPath.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepo,
      });

      await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'district-123', {
        ...defaultOptions,
        grade: ['5', '6'],
      });

      expect(mockDistrictRepo.getUsersByDistrictPath).toHaveBeenCalledWith(mockDistrict.path, {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        grade: ['5', '6'],
      });
    });
  });
});
