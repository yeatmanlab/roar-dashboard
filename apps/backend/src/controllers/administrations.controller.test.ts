import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  AdministrationFactory,
  AdministrationWithEmbedsFactory,
} from '../test-support/factories/administration.factory';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ClassFactory } from '../test-support/factories/class.factory';
import { GroupFactory } from '../test-support/factories/group.factory';
import { AgreementFactory } from '../test-support/factories/agreement.factory';
import { AgreementVersionFactory } from '../test-support/factories/agreement-version.factory';
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
  const mockListGroups = vi.fn();
  const mockListTaskVariants = vi.fn();
  const mockListAgreements = vi.fn();
  const mockDeleteById = vi.fn();
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
      listGroups: mockListGroups,
      listTaskVariants: mockListTaskVariants,
      listAgreements: mockListAgreements,
      deleteById: mockDeleteById,
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

  describe('listGroups', () => {
    it('should return paginated groups with 200 status', async () => {
      const mockGroups = [GroupFactory.build(), GroupFactory.build()];
      mockListGroups.mockResolvedValue({
        items: mockGroups,
        totalItems: 2,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listGroups(mockAuthContext, 'admin-123', {
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

    it('should transform group fields to API response format', async () => {
      const mockGroup = GroupFactory.build({
        id: 'group-uuid-123',
        name: 'Test Group',
      });
      mockListGroups.mockResolvedValue({
        items: [mockGroup],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listGroups(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      const item = data.items[0]!;
      expect(item.id).toBe('group-uuid-123');
      expect(item.name).toBe('Test Group');
      // Group response only contains id and name
      expect(Object.keys(item)).toEqual(['id', 'name']);
    });

    it('should return 404 when administration does not exist', async () => {
      mockListGroups.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listGroups(mockAuthContext, 'non-existent-id', {
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
      mockListGroups.mockRejectedValue(
        new ApiError('You do not have permission to perform this action', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listGroups(mockAuthContext, 'admin-123', {
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
      mockListGroups.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.listGroups(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockListGroups).toHaveBeenCalledWith(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });
    });

    it('should return empty items array when no groups found', async () => {
      mockListGroups.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listGroups(mockAuthContext, 'admin-123', {
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
      mockListGroups.mockResolvedValue({
        items: GroupFactory.buildList(10),
        totalItems: 95,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listGroups(mockAuthContext, 'admin-123', {
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
      mockListGroups.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(
        Controller.listGroups(mockAuthContext, 'admin-123', {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
        }),
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('listTaskVariants', () => {
    // Helper to create mock TaskVariantWithAssignment data
    const createMockTaskVariant = (
      overrides: {
        variantId?: string;
        variantName?: string;
        variantDescription?: string | null;
        taskId?: string;
        taskName?: string;
        taskDescription?: string | null;
        taskImage?: string | null;
        taskTutorialVideo?: string | null;
        orderIndex?: number;
        conditionsAssignment?: Record<string, unknown> | null;
        conditionsRequirements?: Record<string, unknown> | null;
        optional?: boolean;
      } = {},
    ) => ({
      variant: {
        id: overrides.variantId ?? 'variant-uuid-123',
        name: overrides.variantName ?? 'Test Variant',
        description: overrides.variantDescription ?? 'Variant description',
        taskId: overrides.taskId ?? 'task-uuid-123',
        status: 'published',
        params: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      task: {
        id: overrides.taskId ?? 'task-uuid-123',
        name: overrides.taskName ?? 'Test Task',
        description: overrides.taskDescription ?? 'Task description',
        image: overrides.taskImage ?? 'https://example.com/image.png',
        // Use 'in' check to distinguish between undefined (use default) and explicit null
        tutorialVideo: 'taskTutorialVideo' in overrides ? overrides.taskTutorialVideo : 'https://example.com/video.mp4',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      assignment:
        overrides.optional !== undefined
          ? {
              administrationId: 'admin-123',
              taskVariantId: overrides.variantId ?? 'variant-uuid-123',
              orderIndex: overrides.orderIndex ?? 0,
              conditionsAssignment: null,
              conditionsRequirements: null,
              optional: overrides.optional,
            }
          : {
              administrationId: 'admin-123',
              taskVariantId: overrides.variantId ?? 'variant-uuid-123',
              orderIndex: overrides.orderIndex ?? 0,
              conditionsAssignment: overrides.conditionsAssignment ?? null,
              conditionsRequirements: overrides.conditionsRequirements ?? null,
            },
    });

    it('should return paginated task variants with 200 status', async () => {
      const mockTaskVariants = [createMockTaskVariant(), createMockTaskVariant({ variantId: 'variant-2' })];
      mockListTaskVariants.mockResolvedValue({
        items: mockTaskVariants,
        totalItems: 2,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listTaskVariants(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'orderIndex',
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

    it('should transform TaskVariantWithAssignment to API response format for supervisory roles', async () => {
      const mockTaskVariant = createMockTaskVariant({
        variantId: 'variant-uuid-123',
        variantName: 'SWR Variant A',
        variantDescription: 'Sight Word Recognition',
        taskId: 'task-uuid-456',
        taskName: 'SWR',
        taskDescription: 'Sight Word Recognition Task',
        taskImage: 'https://example.com/swr.png',
        taskTutorialVideo: 'https://example.com/swr-tutorial.mp4',
        orderIndex: 1,
        conditionsAssignment: { field: 'studentData.grade', op: 'GREATER_THAN_OR_EQUAL', value: '3' },
        conditionsRequirements: { field: 'studentData.statusEll', op: 'EQUAL', value: 'EL' },
      });
      mockListTaskVariants.mockResolvedValue({
        items: [mockTaskVariant],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listTaskVariants(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'orderIndex',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      const item = data.items[0]!;
      expect(item.id).toBe('variant-uuid-123');
      expect(item.name).toBe('SWR Variant A');
      expect(item.description).toBe('Sight Word Recognition');
      expect(item.orderIndex).toBe(1);
      expect(item.task).toEqual({
        id: 'task-uuid-456',
        name: 'SWR',
        description: 'Sight Word Recognition Task',
        image: 'https://example.com/swr.png',
        tutorialVideo: 'https://example.com/swr-tutorial.mp4',
      });
      expect(item.conditions).toEqual({
        assigned_if: { field: 'studentData.grade', op: 'GREATER_THAN_OR_EQUAL', value: '3' },
        optional_if: { field: 'studentData.statusEll', op: 'EQUAL', value: 'EL' },
      });
    });

    it('should transform TaskVariantWithAssignment to API response format for supervised roles', async () => {
      // Supervised roles (students) receive pre-evaluated optional flag instead of raw conditions
      const mockTaskVariant = createMockTaskVariant({
        variantId: 'variant-uuid-123',
        variantName: 'PA Variant B',
        variantDescription: 'Phonological Awareness',
        taskId: 'task-uuid-789',
        taskName: 'PA',
        taskDescription: 'Phonological Awareness Task',
        taskImage: 'https://example.com/pa.png',
        taskTutorialVideo: null,
        orderIndex: 2,
        optional: true, // Pre-evaluated by service for supervised roles
      });
      mockListTaskVariants.mockResolvedValue({
        items: [mockTaskVariant],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listTaskVariants(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'orderIndex',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      const item = data.items[0]!;
      expect(item.id).toBe('variant-uuid-123');
      expect(item.name).toBe('PA Variant B');
      expect(item.description).toBe('Phonological Awareness');
      expect(item.orderIndex).toBe(2);
      expect(item.task).toEqual({
        id: 'task-uuid-789',
        name: 'PA',
        description: 'Phonological Awareness Task',
        image: 'https://example.com/pa.png',
        tutorialVideo: null,
      });
      expect(item.conditions).toEqual({
        optional: true,
      });
    });

    it('should return 404 when administration does not exist', async () => {
      mockListTaskVariants.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listTaskVariants(mockAuthContext, 'non-existent-id', {
        page: 1,
        perPage: 25,
        sortBy: 'orderIndex',
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
      mockListTaskVariants.mockRejectedValue(
        new ApiError('You do not have permission to perform this action', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listTaskVariants(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'orderIndex',
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

    it('should return 500 when service throws internal error', async () => {
      mockListTaskVariants.mockRejectedValue(
        new ApiError('Failed to retrieve task variants', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listTaskVariants(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'orderIndex',
        sortOrder: 'asc',
      });

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toEqual({
        error: {
          message: 'Failed to retrieve task variants',
          code: 'database/query-failed',
          traceId: expect.any(String),
        },
      });
    });

    it('should pass auth context, administration ID, and query parameters to service', async () => {
      mockListTaskVariants.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.listTaskVariants(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockListTaskVariants).toHaveBeenCalledWith(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'desc',
      });
    });

    it('should return empty items array when no task variants found', async () => {
      mockListTaskVariants.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listTaskVariants(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'orderIndex',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      const mockTaskVariants = Array.from({ length: 10 }, (_, i) =>
        createMockTaskVariant({ variantId: `variant-${i}`, orderIndex: i }),
      );
      mockListTaskVariants.mockResolvedValue({
        items: mockTaskVariants,
        totalItems: 95,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listTaskVariants(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 10,
        sortBy: 'orderIndex',
        sortOrder: 'asc',
      });

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(10); // ceil(95/10) = 10
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockListTaskVariants.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(
        Controller.listTaskVariants(mockAuthContext, 'admin-123', {
          page: 1,
          perPage: 25,
          sortBy: 'orderIndex',
          sortOrder: 'asc',
        }),
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('listAgreements', () => {
    it('should return paginated agreements with 200 status', async () => {
      const mockAgreement = AgreementFactory.build({ name: 'Terms of Service', agreementType: 'tos' });
      const mockVersion = AgreementVersionFactory.build({ locale: 'en-US', githubFilename: 'TOS.md' });
      mockListAgreements.mockResolvedValue({
        items: [{ agreement: mockAgreement, currentVersion: mockVersion }],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listAgreements(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        locale: 'en-US',
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toEqual({
        id: mockAgreement.id,
        name: 'Terms of Service',
        agreementType: 'tos',
        currentVersion: {
          id: mockVersion.id,
          locale: 'en-US',
          githubFilename: 'TOS.md',
          githubOrgRepo: mockVersion.githubOrgRepo,
          githubCommitSha: mockVersion.githubCommitSha,
        },
      });
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 1,
        totalPages: 1,
      });
    });

    it('should handle null currentVersion when version not found for locale', async () => {
      const mockAgreement = AgreementFactory.build();
      mockListAgreements.mockResolvedValue({
        items: [{ agreement: mockAgreement, currentVersion: null }],
        totalItems: 1,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listAgreements(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        locale: 'fr',
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(1);
      expect(data.items[0]!.currentVersion).toBeNull();
    });

    it('should return 404 when administration does not exist', async () => {
      mockListAgreements.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listAgreements(mockAuthContext, 'nonexistent-id', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        locale: 'en-US',
      });

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Administration not found',
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          traceId: expect.any(String),
        },
      });
    });

    it('should return 403 when user lacks permission to access administration', async () => {
      mockListAgreements.mockRejectedValue(
        new ApiError('Forbidden', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listAgreements(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        locale: 'en-US',
      });

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'Forbidden',
          code: ApiErrorCode.AUTH_FORBIDDEN,
          traceId: expect.any(String),
        },
      });
    });

    it('should pass auth context, administration ID, and query parameters to service', async () => {
      mockListAgreements.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.listAgreements(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'agreementType',
        sortOrder: 'desc',
        locale: 'es',
        agreementType: 'consent',
      });

      expect(mockListAgreements).toHaveBeenCalledWith(authContext, 'admin-123', {
        page: 2,
        perPage: 10,
        sortBy: 'agreementType',
        sortOrder: 'desc',
        locale: 'es',
        agreementType: 'consent',
      });
    });

    it('should return empty items array when no agreements found', async () => {
      mockListAgreements.mockResolvedValue({ items: [], totalItems: 0 });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listAgreements(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        locale: 'en-US',
      });

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly', async () => {
      const mockAgreements = Array.from({ length: 10 }, () => ({
        agreement: AgreementFactory.build(),
        currentVersion: AgreementVersionFactory.build(),
      }));
      mockListAgreements.mockResolvedValue({
        items: mockAgreements,
        totalItems: 95,
      });

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.listAgreements(mockAuthContext, 'admin-123', {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        locale: 'en-US',
      });

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(10); // ceil(95/10) = 10
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockListAgreements.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(
        Controller.listAgreements(mockAuthContext, 'admin-123', {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
          locale: 'en-US',
        }),
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('delete', () => {
    it('should return 204 on successful deletion', async () => {
      mockDeleteById.mockResolvedValue(undefined);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.delete(mockAuthContext, 'admin-123');

      expect(result.status).toBe(StatusCodes.NO_CONTENT);
      expect(result.body).toBeUndefined();
      expect(mockDeleteById).toHaveBeenCalledWith(mockAuthContext, 'admin-123');
    });

    it('should return 404 when administration does not exist', async () => {
      mockDeleteById.mockRejectedValue(
        new ApiError('Administration not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.delete(mockAuthContext, 'non-existent-id');

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Administration not found',
          code: 'resource/not-found',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 403 when user lacks permission to delete', async () => {
      mockDeleteById.mockRejectedValue(
        new ApiError('You do not have permission to perform this action', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.delete(mockAuthContext, 'admin-123');

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not have permission to perform this action',
          code: 'auth/forbidden',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 409 when runs exist for the administration', async () => {
      mockDeleteById.mockRejectedValue(
        new ApiError('Cannot delete administration with existing assessment runs', {
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.delete(mockAuthContext, 'admin-123');

      expect(result.status).toBe(StatusCodes.CONFLICT);
      expect(result.body).toEqual({
        error: {
          message: 'Cannot delete administration with existing assessment runs',
          code: 'resource/conflict',
          traceId: expect.any(String),
        },
      });
    });

    it('should return 500 on internal error', async () => {
      mockDeleteById.mockRejectedValue(
        new ApiError('Failed to delete administration', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.delete(mockAuthContext, 'admin-123');

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toEqual({
        error: {
          message: 'Failed to delete administration',
          code: 'database/query-failed',
          traceId: expect.any(String),
        },
      });
    });

    it('should pass auth context and administration ID to service', async () => {
      mockDeleteById.mockResolvedValue(undefined);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const authContext = { userId: 'user-456', isSuperAdmin: true };
      await Controller.delete(authContext, 'admin-789');

      expect(mockDeleteById).toHaveBeenCalledWith(authContext, 'admin-789');
    });

    it('should re-throw non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Database connection lost');
      mockDeleteById.mockRejectedValue(unexpectedError);

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      await expect(Controller.delete(mockAuthContext, 'admin-123')).rejects.toThrow('Database connection lost');
    });
  });
});
