import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchoolService } from './school.service';
import { OrgFactory } from '../../test-support/factories/org.factory';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { EnrolledUserFactory } from '../../test-support/factories/user.factory';
import { OrgType } from '../../enums/org-type.enum';
import { UserRole } from '../../enums/user-role.enum';
import { SortOrder, SchoolDetailSortField } from '@roar-dashboard/api-contract';
import { createMockSchoolRepository, createMockClassRepository } from '../../test-support/repositories';
import type { MockSchoolRepository } from '../../test-support/repositories';
import { createMockAuthorizationService } from '../../test-support/services';
import type { MockAuthorizationService } from '../../test-support/services';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { StatusCodes } from 'http-status-codes';
import { FgaType, FgaRelation } from '../authorization/fga-constants';

describe('SchoolService', () => {
  let mockSchoolRepository: MockSchoolRepository;
  let mockClassRepository: ReturnType<typeof createMockClassRepository>;
  let mockAuthorizationService: MockAuthorizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSchoolRepository = createMockSchoolRepository();
    mockClassRepository = createMockClassRepository();
    mockAuthorizationService = createMockAuthorizationService();
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
        authorizationService: mockAuthorizationService,
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
      expect(mockAuthorizationService.listAccessibleObjects).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should use FGA listAccessibleObjects + listByIds for non-super admin users', async () => {
      const mockSchools = OrgFactory.buildList(2, { orgType: OrgType.SCHOOL });

      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(['school:school-id-1', 'school:school-id-2']);
      mockSchoolRepository.listByIds.mockResolvedValue({
        items: mockSchools,
        totalItems: 2,
      });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith('user-123', 'can_list', 'school');
      expect(mockSchoolRepository.listByIds).toHaveBeenCalledWith(['school-id-1', 'school-id-2'], {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: SortOrder.ASC },
        includeEnded: false,
        embedCounts: false,
      });
      expect(mockSchoolRepository.listAll).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should pass includeEnded parameter to repository', async () => {
      mockSchoolRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
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
        authorizationService: mockAuthorizationService,
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
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(['school:school-1']);
      mockSchoolRepository.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockSchoolRepository.listByIds).toHaveBeenCalledWith(
        ['school-1'],
        expect.objectContaining({
          includeEnded: false,
        }),
      );
    });

    it('should default embedCounts to false when not provided', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(['school:school-1']);
      mockSchoolRepository.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockSchoolRepository.listByIds).toHaveBeenCalledWith(
        ['school-1'],
        expect.objectContaining({
          embedCounts: false,
        }),
      );
    });

    it('should map sortBy "name" to database column "name"', async () => {
      mockSchoolRepository.listAll.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
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
        authorizationService: mockAuthorizationService,
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

    it('should return empty results when FGA returns no accessible schools', async () => {
      // Default mock returns empty array for listAccessibleObjects
      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockAuthorizationService.listAccessibleObjects).toHaveBeenCalledWith(
        'user-no-access',
        'can_list',
        'school',
      );
      expect(mockSchoolRepository.listByIds).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should pass pagination options correctly', async () => {
      mockAuthorizationService.listAccessibleObjects.mockResolvedValue(['school:school-1']);
      mockSchoolRepository.listByIds.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
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

      expect(mockSchoolRepository.listByIds).toHaveBeenCalledWith(
        ['school-1'],
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
      mockSchoolRepository.listAll.mockRejectedValue(error);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
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
        authorizationService: mockAuthorizationService,
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
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getById({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id'),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });

      // Should check unrestricted first, not FGA
      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith('non-existent-id');
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    it('should return school for super admin without checking FGA', async () => {
      const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getById({ userId: 'admin-123', isSuperAdmin: true }, mockSchool.id);

      expect(result).toEqual(mockSchool);
      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith(mockSchool.id);
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });

    it('should return 403 when non-admin user lacks access to existing school', async () => {
      const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getById({ userId: 'user-no-access', isSuperAdmin: false }, mockSchool.id),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith(mockSchool.id);
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-no-access',
        'can_read',
        `school:${mockSchool.id}`,
      );
    });

    it('should return school when non-admin user has access', async () => {
      const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getById({ userId: 'user-with-access', isSuperAdmin: false }, mockSchool.id);

      expect(result).toEqual(mockSchool);
      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith(mockSchool.id);
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-with-access',
        'can_read',
        `school:${mockSchool.id}`,
      );
    });

    it('should wrap non-ApiError in ApiError with DATABASE_QUERY_FAILED code', async () => {
      const error = new Error('Unexpected database error');
      mockSchoolRepository.getUnrestrictedById.mockRejectedValue(error);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'some-id')).rejects.toMatchObject({
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    });

    it('should rethrow ApiError without wrapping', async () => {
      const error = new ApiError('Custom error', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(OrgFactory.build({ orgType: OrgType.SCHOOL }));
      mockAuthorizationService.requirePermission.mockRejectedValue(error);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(service.getById({ userId: 'user-123', isSuperAdmin: false }, 'some-id')).rejects.toThrow(error);
    });

    it('should include context in 404 error', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getById({ userId: 'user-456', isSuperAdmin: false }, 'missing-school-id'),
      ).rejects.toMatchObject({
        context: {
          userId: 'user-456',
          schoolId: 'missing-school-id',
        },
      });
    });

    it('should return 404 when regular user accesses ended school (not 403)', async () => {
      const endedSchool = OrgFactory.build({
        orgType: OrgType.SCHOOL,
        rosteringEnded: new Date('2020-01-01'),
      });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(endedSchool);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.getById({ userId: 'user-with-access', isSuperAdmin: false }, endedSchool.id),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should return ended school for super admin', async () => {
      const endedSchool = OrgFactory.build({
        orgType: OrgType.SCHOOL,
        rosteringEnded: new Date('2020-01-01'),
      });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(endedSchool);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.getById({ userId: 'admin-123', isSuperAdmin: true }, endedSchool.id);

      expect(result).toEqual(endedSchool);
      // Super admin should bypass both authorization and rosteringEnded checks
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
    });
  });

  describe('listSchoolClasses', () => {
    const mockSchool = OrgFactory.build({ orgType: OrgType.SCHOOL });
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
    };

    function createService() {
      return SchoolService({
        schoolRepository: mockSchoolRepository,
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });
    }

    // Helper: set up mocks so that the school exists and user is authorized
    function setupAuthorizedSchool() {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      // FGA requirePermission resolves by default (access granted via can_list_classes)
    }

    it('should return classes for super admin', async () => {
      const authContext = { userId: 'admin-123', isSuperAdmin: true };
      setupAuthorizedSchool();

      const mockClasses = ClassFactory.buildList(3, { schoolId: mockSchool.id });
      mockClassRepository.listBySchoolId.mockResolvedValue({
        items: mockClasses,
        totalItems: 3,
      });

      const service = createService();
      const result = await service.listSchoolClasses(authContext, mockSchool.id, defaultOptions);

      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
      expect(mockClassRepository.listBySchoolId).toHaveBeenCalledWith(mockSchool.id, {
        page: 1,
        perPage: 25,
        orderBy: { field: 'name', direction: 'asc' },
      });
      // FGA requirePermission is called for all users (including super admin)
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'admin-123',
        'can_list_classes',
        `school:${mockSchool.id}`,
      );
    });

    it('should return classes for user with supervisory role (via FGA)', async () => {
      const authContext = { userId: 'teacher-123', isSuperAdmin: false };
      setupAuthorizedSchool();

      const mockClasses = ClassFactory.buildList(2, { schoolId: mockSchool.id });
      mockClassRepository.listBySchoolId.mockResolvedValue({
        items: mockClasses,
        totalItems: 2,
      });

      const service = createService();
      const result = await service.listSchoolClasses(authContext, mockSchool.id, defaultOptions);

      expect(result.items).toHaveLength(2);
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'teacher-123',
        'can_list_classes',
        `school:${mockSchool.id}`,
      );
    });

    it('should throw 403 when user has only supervised roles (FGA denies can_list_classes)', async () => {
      const authContext = { userId: 'student-123', isSuperAdmin: false };
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      // FGA denies can_list_classes for supervised roles (student, guardian, etc.)
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(service.listSchoolClasses(authContext, mockSchool.id, defaultOptions)).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw 404 when school does not exist', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = createService();

      await expect(
        service.listSchoolClasses({ userId: 'user-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw 403 when user lacks access to the school', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = createService();

      await expect(
        service.listSchoolClasses({ userId: 'unauthorized-user', isSuperAdmin: false }, mockSchool.id, defaultOptions),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should pass filter options to repository', async () => {
      const authContext = { userId: 'admin-123', isSuperAdmin: true };
      setupAuthorizedSchool();

      mockClassRepository.listBySchoolId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = createService();
      const filters = [{ field: 'grade', operator: 'eq' as const, value: '3' }];

      await service.listSchoolClasses(authContext, mockSchool.id, {
        ...defaultOptions,
        filter: filters,
      });

      expect(mockClassRepository.listBySchoolId).toHaveBeenCalledWith(
        mockSchool.id,
        expect.objectContaining({
          filter: filters,
        }),
      );
    });

    it('should throw 400 when filter uses unsupported operator', async () => {
      const authContext = { userId: 'admin-123', isSuperAdmin: true };

      const service = createService();

      await expect(
        service.listSchoolClasses(authContext, mockSchool.id, {
          ...defaultOptions,
          filter: [{ field: 'grade', operator: 'gte' as const, value: '3' }],
        }),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
      });
    });

    it('should wrap non-ApiError in ApiError with DATABASE_QUERY_FAILED code', async () => {
      const authContext = { userId: 'admin-123', isSuperAdmin: true };
      setupAuthorizedSchool();

      mockClassRepository.listBySchoolId.mockRejectedValue(new Error('Unexpected DB error'));

      const service = createService();

      await expect(service.listSchoolClasses(authContext, mockSchool.id, defaultOptions)).rejects.toMatchObject({
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should rethrow ApiError without wrapping', async () => {
      const authContext = { userId: 'admin-123', isSuperAdmin: true };
      setupAuthorizedSchool();

      const error = new ApiError('Custom error', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockClassRepository.listBySchoolId.mockRejectedValue(error);

      const service = createService();

      await expect(service.listSchoolClasses(authContext, mockSchool.id, defaultOptions)).rejects.toThrow(error);
    });
  });

  describe('listUsers', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'nameLast' as const,
      sortOrder: SortOrder.ASC,
    };

    it('should return users for super admin (unrestricted)', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      const mockUsers = EnrolledUserFactory.buildList(3);
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockSchoolRepository.getUsersBySchoolId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'school-123', defaultOptions);

      expect(mockSchoolRepository.getUnrestrictedById).toHaveBeenCalledWith('school-123');
      expect(mockSchoolRepository.getUsersBySchoolId).toHaveBeenCalledWith('school-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should check authorization for non-super admin users via FGA', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      const mockUsers = EnrolledUserFactory.buildList(2);
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
      mockSchoolRepository.getUsersBySchoolId.mockResolvedValue({
        items: mockUsers,
        totalItems: 2,
      });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'school-123', defaultOptions);

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_LIST_USERS,
        `${FgaType.SCHOOL}:school-123`,
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return empty results when school has no users', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockSchoolRepository.getUsersBySchoolId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'school-123', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when school does not exist', async () => {
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(null);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw forbidden error when user lacks access to the school', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'school-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should bypass FGA check for super admin and use getUsersBySchoolId', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      const mockUsers = EnrolledUserFactory.buildList(2);
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockSchoolRepository.getUsersBySchoolId.mockResolvedValue({ items: mockUsers, totalItems: 2 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'school-123', defaultOptions);

      // Super admin skips FGA gate
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(mockSchoolRepository.getUsersBySchoolId).toHaveBeenCalledWith('school-123', expect.any(Object));
      expect(result.items).toHaveLength(2);
    });

    it('should throw ApiError when database query fails', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      const dbError = new Error('Connection refused');
      mockSchoolRepository.getUsersBySchoolId.mockRejectedValue(dbError);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'school-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should pass role filter to repository', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockSchoolRepository.getUsersBySchoolId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'school-123', {
        ...defaultOptions,
        role: UserRole.STUDENT,
      });

      expect(mockSchoolRepository.getUsersBySchoolId).toHaveBeenCalledWith('school-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        role: UserRole.STUDENT,
      });
    });

    it('should pass grade filter to repository', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      mockSchoolRepository.getUsersBySchoolId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
      });

      await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'school-123', {
        ...defaultOptions,
        grade: ['5', '6'],
      });

      expect(mockSchoolRepository.getUsersBySchoolId).toHaveBeenCalledWith('school-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        grade: ['5', '6'],
      });
    });

    it('should rethrow ApiError without wrapping', async () => {
      const mockSchool = OrgFactory.build({ id: 'school-123', orgType: OrgType.SCHOOL });
      mockSchoolRepository.getUnrestrictedById.mockResolvedValue(mockSchool);
      const apiError = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockAuthorizationService.requirePermission.mockRejectedValue(apiError);

      const service = SchoolService({
        schoolRepository: mockSchoolRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'school-123', defaultOptions),
      ).rejects.toThrow(apiError);
    });
  });
});
