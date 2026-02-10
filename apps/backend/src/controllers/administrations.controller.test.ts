import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  AdministrationFactory,
  AdministrationWithEmbedsFactory,
} from '../test-support/factories/administration.factory';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ClassFactory } from '../test-support/factories/class.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { OrgType } from '../enums/org-type.enum';

// Mock the AdministrationService module
vi.mock('../services/administration/administration.service', () => ({
  AdministrationService: vi.fn(),
}));

import { AdministrationService } from '../services/administration/administration.service';

/**
 * Type-safe assertion helper for success responses.
 * Asserts the status is OK and returns the data with proper typing.
 */
function expectOkResponse<T>(result: { status: number; body: { data: T } | { error: unknown } }): T {
  expect(result.status).toBe(StatusCodes.OK);
  expect(result.body).toHaveProperty('data');
  return (result.body as { data: T }).data;
}

describe('AdministrationsController', () => {
  const mockList = vi.fn();
  const mockGet = vi.fn();
  const mockListDistricts = vi.fn();
  const mockListSchools = vi.fn();
  const mockListClasses = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(AdministrationService).mockReturnValue({
      list: mockList,
      getById: mockGet,
      listDistricts: mockListDistricts,
      listSchools: mockListSchools,
      listClasses: mockListClasses,
    });
  });

  describe('list', () => {
    it('should return paginated administrations with 200 status', async () => {
      const mockAdmins = [AdministrationFactory.build(), AdministrationFactory.build()];
      mockList.mockResolvedValue({
        items: mockAdmins,
        totalItems: 2,
      });

      // Re-import to pick up the mock
      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should transform administration fields to API response format', async () => {
      const mockAdmin = AdministrationFactory.build({
        id: 'admin-uuid-123',
        name: 'Internal Name',
        namePublic: 'Public Name',
        dateStart: new Date('2024-01-01T00:00:00Z'),
        dateEnd: new Date('2024-12-31T23:59:59Z'),
        createdAt: new Date('2023-06-15T10:30:00Z'),
        isOrdered: true,
      });
      mockList.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      const data = expectOkResponse(result);
      const item = data.items[0]!;
      expect(item.id).toBe('admin-uuid-123');
      expect(item.name).toBe('Internal Name');
      expect(item.publicName).toBe('Public Name');
      expect(item.dates.start).toBe('2024-01-01T00:00:00.000Z');
      expect(item.dates.end).toBe('2024-12-31T23:59:59.000Z');
      expect(item.dates.created).toBe('2023-06-15T10:30:00.000Z');
      expect(item.isOrdered).toBe(true);
    });

    it('should calculate totalPages correctly', async () => {
      mockList.mockResolvedValue({
        items: AdministrationFactory.buildList(10),
        totalItems: 95,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(10); // ceil(95/10) = 10
    });

    it('should pass auth context and query parameters to service', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.list(authContext, {
        page: 3,
        perPage: 50,
        sortBy: 'dateStart',
        sortOrder: 'asc',
        embed: [],
      });

      expect(mockList).toHaveBeenCalledWith(authContext, {
        page: 3,
        perPage: 50,
        sortBy: 'dateStart',
        sortOrder: 'asc',
        embed: [],
      });
    });

    it('should return empty items array when no administrations found', async () => {
      mockList.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('should include stats in response when embed=stats is requested', async () => {
      const mockAdmin = AdministrationWithEmbedsFactory.build({
        id: 'admin-1',
        name: 'Test Admin',
        stats: { assigned: 25, started: 10, completed: 5 },
      });
      mockList.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: ['stats'],
      });

      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: ['stats'],
      });
      const data = expectOkResponse(result);
      expect(data.items[0]!.stats).toEqual({
        assigned: 25,
        started: 10,
        completed: 5,
      });
    });

    it('should not include stats in response when not embedded (list)', async () => {
      const mockAdmin = AdministrationFactory.build({
        id: 'admin-1',
        name: 'Test Admin',
        // No stats property
      });
      mockList.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.items[0]).not.toHaveProperty('stats');
    });

    it('should include tasks in response when embed=tasks is requested', async () => {
      const mockAdmin = AdministrationWithEmbedsFactory.build({
        id: 'admin-1',
        name: 'Test Admin',
        tasks: [
          { taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 },
          { taskId: 'task-2', taskName: 'PA', variantId: 'variant-2', variantName: null, orderIndex: 1 },
        ],
      });
      mockList.mockResolvedValue({
        items: [mockAdmin],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: ['tasks'],
      });

      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: ['tasks'],
      });
      const data = expectOkResponse(result);
      expect(data.items[0]!.tasks).toEqual([
        { taskId: 'task-1', taskName: 'SWR', variantId: 'variant-1', variantName: 'Variant A', orderIndex: 0 },
        { taskId: 'task-2', taskName: 'PA', variantId: 'variant-2', variantName: null, orderIndex: 1 },
      ]);
    });

    it('should return 500 when service throws ApiError', async () => {
      mockList.mockRejectedValue(
        new ApiError('Failed to retrieve administrations', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toEqual({
        error: {
          message: 'Failed to retrieve administrations',
          code: 'database/query-failed',
          traceId: expect.any(String),
        },
      });
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockList.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(
        Controller.list(mockAuthContext, {
          page: 1,
          perPage: 25,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          embed: [],
        }),
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('get', () => {
    it('should return administration with 200 status when found and accessible', async () => {
      const mockAdmin = AdministrationFactory.build({
        id: 'admin-uuid-123',
        name: 'Internal Name',
        namePublic: 'Public Name',
        dateStart: new Date('2024-01-01T00:00:00Z'),
        dateEnd: new Date('2024-12-31T23:59:59Z'),
        createdAt: new Date('2023-06-15T10:30:00Z'),
        isOrdered: true,
      });
      mockGet.mockResolvedValue(mockAdmin);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.get(mockAuthContext, 'admin-uuid-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({
        data: {
          id: 'admin-uuid-123',
          name: 'Internal Name',
          publicName: 'Public Name',
          dates: {
            start: '2024-01-01T00:00:00.000Z',
            end: '2024-12-31T23:59:59.000Z',
            created: '2023-06-15T10:30:00.000Z',
          },
          isOrdered: true,
        },
      });
    });

    it('should return 404 when administration does not exist', async () => {
      mockGet.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.get(mockAuthContext, 'non-existent-id');

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Administration not found',
          code: 'resource/not-found',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 403 when user lacks permission to access administration', async () => {
      mockGet.mockRejectedValue(
        new ApiError('You do not have permission to perform this action', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.get(mockAuthContext, 'admin-123');

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not have permission to perform this action',
          code: 'auth/forbidden',
          traceId: expect.any(String),
        },
      });
    });

    it('should pass auth context and administration ID to service', async () => {
      const mockAdmin = AdministrationFactory.build();
      mockGet.mockResolvedValue(mockAdmin);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.get(authContext, 'admin-123');

      expect(mockGet).toHaveBeenCalledWith(authContext, 'admin-123');
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockGet.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(Controller.get(mockAuthContext, 'admin-123')).rejects.toThrow('Database connection lost');
    });
  });

  describe('listDistricts', () => {
    it('should return paginated districts with 200 status', async () => {
      const mockDistricts = [
        OrgFactory.build({ orgType: OrgType.DISTRICT }),
        OrgFactory.build({ orgType: OrgType.DISTRICT }),
      ];
      mockListDistricts.mockResolvedValue({
        items: mockDistricts,
        totalItems: 2,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listDistricts(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should transform district fields to API response format', async () => {
      const mockDistrict = OrgFactory.build({
        id: 'district-uuid-123',
        name: 'Test District',
        orgType: OrgType.DISTRICT,
      });
      mockListDistricts.mockResolvedValue({
        items: [mockDistrict],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listDistricts(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      const item = data.items[0]!;
      expect(item.id).toBe('district-uuid-123');
      expect(item.name).toBe('Test District');
    });

    it('should return 404 when administration does not exist', async () => {
      mockListDistricts.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listDistricts(mockAuthContext, 'non-existent-id', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Administration not found',
          code: 'resource/not-found',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 403 when user lacks permission to access administration', async () => {
      mockListDistricts.mockRejectedValue(
        new ApiError('You do not have permission to perform this action', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listDistricts(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not have permission to perform this action',
          code: 'auth/forbidden',
          traceId: expect.any(String),
        },
      });
    });

    it('should pass auth context, administration ID, and query parameters to service', async () => {
      mockListDistricts.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.listDistricts(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockListDistricts).toHaveBeenCalledWith(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });
    });

    it('should return empty items array when no districts found', async () => {
      mockListDistricts.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listDistricts(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockListDistricts.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(
        Controller.listDistricts(mockAuthContext, 'admin-123', {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('listSchools', () => {
    it('should return paginated schools with 200 status', async () => {
      const mockSchools = [
        OrgFactory.build({ orgType: OrgType.SCHOOL }),
        OrgFactory.build({ orgType: OrgType.SCHOOL }),
      ];
      mockListSchools.mockResolvedValue({
        items: mockSchools,
        totalItems: 2,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listSchools(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should transform school fields to API response format', async () => {
      const mockSchool = OrgFactory.build({
        id: 'school-uuid-123',
        name: 'Test School',
        abbreviation: 'TS',
        orgType: OrgType.SCHOOL,
      });
      mockListSchools.mockResolvedValue({
        items: [mockSchool],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listSchools(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      const item = data.items[0]!;
      expect(item.id).toBe('school-uuid-123');
      expect(item.name).toBe('Test School');
      // School response only contains id and name (no abbreviation or location)
      expect(Object.keys(item)).toEqual(['id', 'name']);
    });

    it('should return 404 when administration does not exist', async () => {
      mockListSchools.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listSchools(mockAuthContext, 'non-existent-id', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Administration not found',
          code: 'resource/not-found',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 403 when user lacks permission to access administration', async () => {
      mockListSchools.mockRejectedValue(
        new ApiError('You do not have permission to perform this action', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listSchools(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not have permission to perform this action',
          code: 'auth/forbidden',
          traceId: expect.any(String),
        },
      });
    });

    it('should pass auth context, administration ID, and query parameters to service', async () => {
      mockListSchools.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.listSchools(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockListSchools).toHaveBeenCalledWith(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });
    });

    it('should return empty items array when no schools found', async () => {
      mockListSchools.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listSchools(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockListSchools.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(
        Controller.listSchools(mockAuthContext, 'admin-123', {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('listClasses', () => {
    it('should return paginated classes with 200 status', async () => {
      const mockClasses = [ClassFactory.build(), ClassFactory.build()];
      mockListClasses.mockResolvedValue({
        items: mockClasses,
        totalItems: 2,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listClasses(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should transform class fields to API response format', async () => {
      const mockClass = ClassFactory.build({
        id: 'class-uuid-123',
        name: 'Test Class',
      });
      mockListClasses.mockResolvedValue({
        items: [mockClass],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listClasses(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      const item = data.items[0]!;
      expect(item.id).toBe('class-uuid-123');
      expect(item.name).toBe('Test Class');
      // Class response only contains id and name
      expect(Object.keys(item)).toEqual(['id', 'name']);
    });

    it('should return 404 when administration does not exist', async () => {
      mockListClasses.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listClasses(mockAuthContext, 'non-existent-id', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Administration not found',
          code: 'resource/not-found',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 403 when user lacks permission to access administration', async () => {
      mockListClasses.mockRejectedValue(
        new ApiError('You do not have permission to perform this action', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listClasses(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not have permission to perform this action',
          code: 'auth/forbidden',
          traceId: expect.any(String),
        },
      });
    });

    it('should pass auth context, administration ID, and query parameters to service', async () => {
      mockListClasses.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.listClasses(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockListClasses).toHaveBeenCalledWith(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });
    });

    it('should return empty items array when no classes found', async () => {
      mockListClasses.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listClasses(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      mockListClasses.mockResolvedValue({
        items: ClassFactory.buildList(10),
        totalItems: 95,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listClasses(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(10); // ceil(95/10) = 10
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockListClasses.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(
        Controller.listClasses(mockAuthContext, 'admin-123', {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      ).rejects.toThrow('Database connection lost');
    });
  });
});
