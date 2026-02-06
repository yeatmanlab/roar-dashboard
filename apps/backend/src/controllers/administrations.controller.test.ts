import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  AdministrationFactory,
  AdministrationWithEmbedsFactory,
} from '../test-support/factories/administration.factory';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { OrgType } from '../enums/org-type.enum';

// Mock the AdministrationService module
vi.mock('../services/administration/administration.service', () => ({
  AdministrationService: vi.fn(),
}));

import { AdministrationService } from '../services/administration/administration.service';

describe('AdministrationsController', () => {
  const mockList = vi.fn();
  const mockGet = vi.fn();
  const mockListDistricts = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(AdministrationService).mockReturnValue({
      list: mockList,
      getById: mockGet,
      listDistricts: mockListDistricts,
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

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body.data.items).toHaveLength(2);
      expect(result.body.data.pagination).toEqual({
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

      const item = result.body.data.items[0]!;
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

      expect(result.body.data.pagination.totalPages).toBe(10); // ceil(95/10) = 10
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

      expect(result.body.data.items).toEqual([]);
      expect(result.body.data.pagination.totalItems).toBe(0);
      expect(result.body.data.pagination.totalPages).toBe(0);
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
      expect(result.body.data.items[0]!.stats).toEqual({
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

      expect(result.body.data.items[0]).not.toHaveProperty('stats');
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
      expect(result.body.data.items[0]!.tasks).toEqual([
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
        new ApiError('You do not have permission to access this administration', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { AdministrationsController: Controller } = await import('./administrations.controller');

      const result = await Controller.get(mockAuthContext, 'admin-123');

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toEqual({
        error: {
          message: 'You do not have permission to access this administration',
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

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status !== StatusCodes.OK) throw new Error('Expected OK status');
      expect(result.body.data.items).toHaveLength(2);
      expect(result.body.data.pagination).toEqual({
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
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        locationAddressLine1: '123 Main St',
        locationAddressLine2: 'Suite 100',
        locationCity: 'Springfield',
        locationStateProvince: 'IL',
        locationPostalCode: '62701',
        locationCountry: 'US',
        locationLatLong: [-89.6501, 39.7817], // [longitude, latitude]
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

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status !== StatusCodes.OK) throw new Error('Expected OK status');
      const item = result.body.data.items[0]!;
      expect(item.id).toBe('district-uuid-123');
      expect(item.name).toBe('Test District');
      expect(item.abbreviation).toBe('TD');
      expect(item.location).toEqual({
        addressLine1: '123 Main St',
        addressLine2: 'Suite 100',
        city: 'Springfield',
        stateProvince: 'IL',
        postalCode: '62701',
        country: 'US',
        latLong: {
          type: 'Point',
          coordinates: [-89.6501, 39.7817],
        },
      });
    });

    it('should handle null location fields', async () => {
      const mockDistrict = OrgFactory.build({
        id: 'district-uuid-456',
        name: 'Minimal District',
        abbreviation: 'MD',
        orgType: OrgType.DISTRICT,
        locationAddressLine1: null,
        locationAddressLine2: null,
        locationCity: null,
        locationStateProvince: null,
        locationPostalCode: null,
        locationCountry: null,
        locationLatLong: null,
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

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status !== StatusCodes.OK) throw new Error('Expected OK status');
      const item = result.body.data.items[0]!;
      expect(item.location).toEqual({
        addressLine1: null,
        addressLine2: null,
        city: null,
        stateProvince: null,
        postalCode: null,
        country: null,
        latLong: null,
      });
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
        new ApiError('You do not have permission to access this administration', {
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
          message: 'You do not have permission to access this administration',
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

      expect(result.status).toBe(StatusCodes.OK);
      if (result.status !== StatusCodes.OK) throw new Error('Expected OK status');
      expect(result.body.data.items).toEqual([]);
      expect(result.body.data.pagination.totalItems).toBe(0);
      expect(result.body.data.pagination.totalPages).toBe(0);
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
});
