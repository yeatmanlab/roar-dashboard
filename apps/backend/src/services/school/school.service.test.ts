import { describe, it, expect, beforeEach } from 'vitest';
import { SchoolService } from './school.service';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { OrgType } from '../../enums/org-type.enum';
import { SortOrder, SchoolDetailSortField } from '@roar-dashboard/api-contract';
import { createMockSchoolRepository } from '../../test-support/repositories';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { StatusCodes } from 'http-status-codes';

describe('SchoolService', () => {
  let mockSchoolRepository: ReturnType<typeof createMockSchoolRepository>;

  beforeEach(() => {
    mockSchoolRepository = createMockSchoolRepository();
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
    it('should return 404 when school does not exist (before checking authorization)', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id')).rejects.toThrow(
        ApiError,
      );

      try {
        await service.getById({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        expect((err as ApiError).code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      }

      // Should check unrestricted first, not authorized
      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith('non-existent-id');
      expect(mockSchoolRepository.getAuthorizedById).not.toHaveBeenCalled();
    });

    it('should return school for super admin without checking authorization', async () => {
      const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.getById({ userId: 'admin-123', isSuperAdmin: true }, mockSchool.id);

      expect(result).toEqual(mockSchool);
      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith(mockSchool.id);
      // Super admin should bypass authorization check
      expect(mockSchoolRepository.getAuthorizedById).not.toHaveBeenCalled();
    });

    it('should return 403 when non-admin user lacks access to existing school', async () => {
      const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockSchoolRepository.getAuthorizedById.mockResolvedValue(null);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.getById({ userId: 'user-no-access', isSuperAdmin: false }, mockSchool.id)).rejects.toThrow(
        ApiError,
      );

      try {
        await service.getById({ userId: 'user-no-access', isSuperAdmin: false }, mockSchool.id);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(StatusCodes.FORBIDDEN);
        expect((err as ApiError).code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      }

      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith(mockSchool.id);
      expect(mockSchoolRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-no-access',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
        },
        mockSchool.id,
      );
    });

    it('should return school when non-admin user has access', async () => {
      const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockSchoolRepository.getAuthorizedById.mockResolvedValue(mockSchool);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.getById({ userId: 'user-with-access', isSuperAdmin: false }, mockSchool.id);

      expect(result).toEqual(mockSchool);
      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith(mockSchool.id);
      expect(mockSchoolRepository.getAuthorizedById).toHaveBeenCalledWith(
        {
          userId: 'user-with-access',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
        },
        mockSchool.id,
      );
    });

    it('should wrap non-ApiError in ApiError with DATABASE_QUERY_FAILED code', async () => {
      const error = new Error('Unexpected database error');
      mockSchoolRepository.getUnrestrictedById.mockRejectedValue(error);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'some-id')).rejects.toThrow(ApiError);

      try {
        await service.getById({ userId: 'user-123', isSuperAdmin: false }, 'some-id');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
        expect((err as ApiError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    });

    it('should rethrow ApiError without wrapping', async () => {
      const error = new ApiError('Custom error', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(OrgFactory.build({ orgType: OrgType.SCHOOL }));
      mockSchoolRepository.getAuthorizedById.mockRejectedValue(error);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'some-id')).rejects.toThrow(error);
    });

    it('should include context in 404 error', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      try {
        await service.getById({ userId: 'user-456', isSuperAdmin: false }, 'missing-school-id');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.context).toMatchObject({
          userId: 'user-456',
          schoolId: 'missing-school-id',
        });
      }
    });

    it('should include context in 403 error', async () => {
      const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL, id: 'restricted-school' });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockSchoolRepository.getAuthorizedById.mockResolvedValue(null);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      try {
        await service.getById({ userId: 'unauthorized-user', isSuperAdmin: false }, 'restricted-school');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.context).toMatchObject({
          userId: 'unauthorized-user',
          schoolId: 'restricted-school',
        });
      }
    });
  });
});
