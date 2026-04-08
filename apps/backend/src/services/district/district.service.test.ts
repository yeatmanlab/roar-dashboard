import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistrictService } from './district.service';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { OrgType } from '../../enums/org-type.enum';
import { SortOrder, DistrictDetailSortField } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { StatusCodes } from 'http-status-codes';
import { createMockDistrictRepository } from '../../test-support/repositories';
import type { District } from '../../repositories/district.repository';

describe('DistrictService', () => {
  const mockDistrictRepository = createMockDistrictRepository();

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
      expect(mockDistrictRepository.listAuthorized).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use listAuthorized for non-super admin users', async () => {
      const mockDistricts = OrgFactory.buildList(2, { orgType: OrgType.DISTRICT });

      mockDistrictRepository.listAuthorized.mockResolvedValue({
        items: mockDistricts,
        totalItems: 2,
      });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
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

      expect(mockDistrictRepository.listAuthorized).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
        },
        {
          page: 1,
          perPage: 25,
          orderBy: { field: 'name', direction: SortOrder.ASC },
          includeEnded: false,
          embedCounts: false,
        },
      );
      expect(mockDistrictRepository.listAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should pass includeEnded parameter to repository', async () => {
      mockDistrictRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
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
      mockDistrictRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
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

      expect(mockDistrictRepository.listAuthorized).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          includeEnded: false,
        }),
      );
    });

    it('should default embedCounts to false when not provided', async () => {
      mockDistrictRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
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

      expect(mockDistrictRepository.listAuthorized).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          embedCounts: false,
        }),
      );
    });

    it('should map sortBy "name" to database column "name"', async () => {
      mockDistrictRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
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

    it('should return empty results when user has no accessible districts', async () => {
      mockDistrictRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
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
    });

    it('should pass pagination options correctly', async () => {
      mockDistrictRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
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

      expect(mockDistrictRepository.listAuthorized).toHaveBeenCalledWith(
        expect.any(Object),
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

      try {
        await service.list(
          { userId: 'admin-123', isSuperAdmin: true },
          {
            page: 1,
            perPage: 25,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        );
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
        expect((err as ApiError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
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
    it('should fetch district by ID for regular users', async () => {
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
      // Step 3: authorized lookup succeeds
      mockDistrictRepository.getAuthorizedById.mockResolvedValue(mockDistrict as District);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      const result = await service.getById(mockAuthContext, validUuid);

      expect(result).toEqual(mockDistrict);
    });

    it('should build access control filter for regular users', async () => {
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
      // Step 3: authorized lookup succeeds
      mockDistrictRepository.getAuthorizedById.mockResolvedValue(mockDistrict as District);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.getById(mockAuthContext, validUuid);

      expect(mockDistrictRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
        },
        validUuid,
      );
    });

    it('should use getUnrestrictedById for super admins', async () => {
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
      });

      await service.getById(mockSuperAdminContext, validUuid);

      // Super admins should use unrestricted method, not the authorized one
      expect(mockDistrictRepository.getUnrestrictedById).toHaveBeenCalledWith(validUuid);
      expect(mockDistrictRepository.getAuthorizedById).not.toHaveBeenCalled();
    });

    it('should throw 404 when district not found', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockDistrictRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await expect(service.getById(mockAuthContext, validUuid)).rejects.toThrow(ApiError);

      try {
        await service.getById(mockAuthContext, validUuid);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        expect((error as ApiError).code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
        expect((error as ApiError).message).toBe(ApiErrorMessage.NOT_FOUND);
      }
    });

    it('should throw 403 when user lacks access', async () => {
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
      // But user lacks access (authorized lookup fails)
      mockDistrictRepository.getAuthorizedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await expect(service.getById(mockAuthContext, validUuid)).rejects.toThrow(ApiError);

      try {
        await service.getById(mockAuthContext, validUuid);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.FORBIDDEN);
        expect((error as ApiError).code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
        expect((error as ApiError).message).toBe(ApiErrorMessage.FORBIDDEN);
      }
    });

    it('should wrap database errors in ApiError with DATABASE_QUERY_FAILED code', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const dbError = new Error('Database connection lost');
      mockDistrictRepository.getAuthorizedById.mockRejectedValue(dbError);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await expect(service.getById(mockAuthContext, validUuid)).rejects.toThrow(ApiError);

      try {
        await service.getById(mockAuthContext, validUuid);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
        expect((error as ApiError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    });
  });
});
