import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchoolService } from './school.service';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { OrgType } from '../../enums/org-type.enum';
import { SortOrder, SchoolDetailSortField } from '@roar-dashboard/api-contract';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { StatusCodes } from 'http-status-codes';
import { createMockSchoolRepository } from '../../test-support/repositories';
import type { School } from '../../repositories/school.repository';

describe('SchoolService', () => {
  const mockSchoolRepository = createMockSchoolRepository();

  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };
  const mockSuperAdminContext = { userId: 'admin-123', isSuperAdmin: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return all schools for super admins (unrestricted)', async () => {
      const mockSchools = OrgFactory.buildList(3, { orgType: OrgType.SCHOOL });
      mockSchoolRepository.listAll.mockResolvedValue({
        items: mockSchools,
        totalItems: 3,
      });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.DESC,
        },
      );

      expect(mockSchoolRepository.listAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: SortOrder.DESC },
        includeEnded: false,
        embedCounts: false,
      });
      expect(mockSchoolRepository.listAuthorized).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use listAuthorized for non-super admin users', async () => {
      const mockSchools = OrgFactory.buildList(2, { orgType: OrgType.SCHOOL });

      mockSchoolRepository.listAuthorized.mockResolvedValue({
        items: mockSchools,
        totalItems: 2,
      });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockSchoolRepository.listAuthorized).toHaveBeenCalledWith(
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
      expect(mockSchoolRepository.listAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should pass includeEnded parameter to repository', async () => {
      mockSchoolRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
          includeEnded: true,
        },
      );

      expect(mockSchoolRepository.listAll).toHaveBeenCalledWith(
        expect.objectContaining({
          includeEnded: true,
        }),
      );
    });

    it('should pass embedCounts parameter to repository', async () => {
      mockSchoolRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
          embedCounts: true,
        },
      );

      expect(mockSchoolRepository.listAll).toHaveBeenCalledWith(
        expect.objectContaining({
          embedCounts: true,
        }),
      );
    });

    it('should default includeEnded to false when not provided', async () => {
      mockSchoolRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockSchoolRepository.listAuthorized).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          includeEnded: false,
        }),
      );
    });

    it('should default embedCounts to false when not provided', async () => {
      mockSchoolRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.list(
        { userId: 'user-123', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockSchoolRepository.listAuthorized).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          embedCounts: false,
        }),
      );
    });

    it('should map sortBy "name" to database column "name"', async () => {
      mockSchoolRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockSchoolRepository.listAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { field: 'name', direction: SortOrder.ASC },
        }),
      );
    });

    it('should map sortBy "abbreviation" to database column "abbreviation"', async () => {
      mockSchoolRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.ABBREVIATION,
          sortOrder: SortOrder.DESC,
        },
      );

      expect(mockSchoolRepository.listAll).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { field: 'abbreviation', direction: SortOrder.DESC },
        }),
      );
    });

    it('should return empty results when user has no accessible schools', async () => {
      mockSchoolRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.list(
        { userId: 'user-no-access', isSuperAdmin: false },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should pass pagination options correctly', async () => {
      mockSchoolRepository.listAuthorized.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.list(
        { userId: 'user-456', isSuperAdmin: false },
        {
          page: 3,
          perPage: 50,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
        },
      );

      expect(mockSchoolRepository.listAuthorized).toHaveBeenCalledWith(
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
      mockSchoolRepository.listAll.mockRejectedValue(error);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
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
      mockSchoolRepository.listAll.mockRejectedValue(error);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
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

    it('should return schools with counts when embedCounts is true', async () => {
      const mockSchoolsWithCounts = OrgFactory.buildList(2, { orgType: OrgType.SCHOOL }).map((s) => ({
        ...s,
        counts: {
          users: 50,
          classes: 10,
        },
      }));

      mockSchoolRepository.listAll.mockResolvedValue({
        items: mockSchoolsWithCounts,
        totalItems: 2,
      });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.list(
        { userId: 'admin-123', isSuperAdmin: true },
        {
          page: 1,
          perPage: 25,
          sortBy: SchoolDetailSortField.NAME,
          sortOrder: SortOrder.ASC,
          embedCounts: true,
        },
      );

      expect(result.items[0]).toHaveProperty('counts');
      expect(result.items[0]!.counts).toEqual({
        users: 50,
        classes: 10,
      });
      // Schools should NOT have schools count
      expect(result.items[0]!.counts).not.toHaveProperty('schools');
    });
  });

  describe('getById', () => {
    it('should fetch school by ID for regular users', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockSchool = {
        id: validUuid,
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-id',
        isRosteringRootOrg: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Step 1: unrestricted lookup succeeds
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool as School);
      // Step 3: authorized lookup succeeds
      mockSchoolRepository.getAuthorizedById.mockResolvedValue(mockSchool as School);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.getById(mockAuthContext, validUuid);

      expect(result).toEqual(mockSchool);
    });

    it('should build access control filter for regular users', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockSchool = {
        id: validUuid,
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-id',
        isRosteringRootOrg: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Step 1: unrestricted lookup succeeds
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool as School);
      // Step 3: authorized lookup succeeds
      mockSchoolRepository.getAuthorizedById.mockResolvedValue(mockSchool as School);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.getById(mockAuthContext, validUuid);

      expect(mockSchoolRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
        },
        validUuid,
      );
    });

    it('should use getUnrestrictedById for super admins', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockSchool = {
        id: validUuid,
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-id',
        isRosteringRootOrg: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool as School);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.getById(mockSuperAdminContext, validUuid);

      // Super admins should use unrestricted method, not the authorized one
      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith(validUuid);
      expect(mockSchoolRepository.getAuthorizedById).not.toHaveBeenCalled();
    });

    it('should throw 404 when school not found', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
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
      const mockSchool = {
        id: validUuid,
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
        parentOrgId: 'district-id',
        isRosteringRootOrg: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // School exists (unrestricted lookup succeeds)
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool as School);
      // But user lacks access (authorized lookup fails)
      mockSchoolRepository.getAuthorizedById.mockResolvedValue(null);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
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
      mockSchoolRepository.getAuthorizedById.mockRejectedValue(dbError);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
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
