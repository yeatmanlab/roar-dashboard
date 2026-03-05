import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistrictService } from './district.service';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { OrgType } from '../../enums/org-type.enum';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { StatusCodes } from 'http-status-codes';

describe('DistrictService', () => {
  const mockListAll = vi.fn();
  const mockListAuthorized = vi.fn();
  const mockGetByIdUnrestricted = vi.fn();
  const mockGetAuthorizedById = vi.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDistrictRepository: any = {
    listAll: mockListAll,
    listAuthorized: mockListAuthorized,
    getUnrestrictedById: mockGetByIdUnrestricted,
    getAuthorizedById: mockGetAuthorizedById,
  };

  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };
  const mockSuperAdminContext = { userId: 'admin-123', isSuperAdmin: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return all districts for super admins (unrestricted)', async () => {
      const mockDistricts = OrgFactory.buildList(3, { orgType: OrgType.DISTRICT });
      mockListAll.mockResolvedValue({
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
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );

      expect(mockListAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 25,
        orderBy: { field: 'createdAt', direction: 'desc' },
        includeEnded: false,
        embedCounts: false,
      });
      expect(mockListAuthorized).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use listAuthorized for non-super admin users', async () => {
      const mockDistricts = OrgFactory.buildList(2, { orgType: OrgType.DISTRICT });

      mockListAuthorized.mockResolvedValue({
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
          sortBy: 'name',
          sortOrder: 'asc',
        },
      );

      expect(mockListAuthorized).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
        },
        {
          page: 1,
          perPage: 25,
          orderBy: { field: 'name', direction: 'asc' },
          includeEnded: false,
          embedCounts: false,
        },
      );
      expect(mockListAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should pass includeEnded parameter to repository', async () => {
      mockListAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
          includeEnded: true,
        },
      );

      expect(mockListAll).toHaveBeenCalledWith(
        expect.objectContaining({
          includeEnded: true,
        }),
      );
    });

    it('should pass embedCounts parameter to repository', async () => {
      mockListAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
          embedCounts: true,
        },
      );

      expect(mockListAll).toHaveBeenCalledWith(
        expect.objectContaining({
          embedCounts: true,
        }),
      );
    });

    it('should default includeEnded to false when not provided', async () => {
      mockListAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      );

      expect(mockListAuthorized).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          includeEnded: false,
        }),
      );
    });

    it('should default embedCounts to false when not provided', async () => {
      mockListAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      );

      expect(mockListAuthorized).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          embedCounts: false,
        }),
      );
    });

    it('should map sortBy "name" to database column "name"', async () => {
      mockListAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      );

      expect(mockListAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { field: 'name', direction: 'asc' },
        }),
      );
    });

    it('should map sortBy "abbreviation" to database column "abbreviation"', async () => {
      mockListAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: 'abbreviation',
          sortOrder: 'desc',
        },
      );

      expect(mockListAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { field: 'abbreviation', direction: 'desc' },
        }),
      );
    });

    it('should map sortBy "createdAt" to database column "createdAt"', async () => {
      mockListAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      );

      expect(mockListAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { field: 'createdAt', direction: 'desc' },
        }),
      );
    });

    it('should return empty results when user has no accessible districts', async () => {
      mockListAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      const result = await service.list(
        { userId: 'user-no-access', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should pass pagination options correctly', async () => {
      mockListAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.list(
        { userId: 'user-456', isSuperAdmin: false },
        {
          page: 3,
          perPage: 50,
          sortBy: 'name',
          sortOrder: 'asc',
        },
      );

      expect(mockListAuthorized).toHaveBeenCalledWith(
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
      mockListAll.mockRejectedValue(error);

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
      mockListAll.mockRejectedValue(error);

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

      mockListAll.mockResolvedValue({
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
          sortBy: 'name',
          sortOrder: 'asc',
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
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetAuthorizedById.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      const result = await service.getById(mockAuthContext, validUuid);

      expect(result).toEqual(mockDistrict);
      expect(mockGetByIdUnrestricted).not.toHaveBeenCalled();
    });

    it('should build access control filter for regular users', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetAuthorizedById.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.getById(mockAuthContext, validUuid);

      expect(mockGetAuthorizedById).toHaveBeenCalledWith(validUuid, {
        userId: 'user-123',
        allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
      });
    });

    it('should use getUnrestrictedById for super admins', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetByIdUnrestricted.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await service.getById(mockSuperAdminContext, validUuid);

      // Super admins should use unrestricted method, not the authorized one
      expect(mockGetByIdUnrestricted).toHaveBeenCalledWith(validUuid);
      expect(mockGetAuthorizedById).not.toHaveBeenCalled();
    });

    it('should throw 404 when district not found', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockGetAuthorizedById.mockResolvedValue(null);

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
        expect((error as ApiError).message).toBe('District not found');
      }
    });

    it('should throw 404 when user lacks access (security - no distinction)', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockGetAuthorizedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository,
      });

      await expect(service.getById(mockAuthContext, validUuid)).rejects.toThrow(ApiError);

      try {
        await service.getById(mockAuthContext, validUuid);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        // Should not distinguish between "not found" and "no access" for security
        expect((error as ApiError).message).toBe('District not found');
      }
    });

    it('should wrap database errors in ApiError with DATABASE_QUERY_FAILED code', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const dbError = new Error('Database connection lost');
      mockGetAuthorizedById.mockRejectedValue(dbError);

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
