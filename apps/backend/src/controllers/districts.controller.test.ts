import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SortOrder } from '@roar-dashboard/api-contract';
import { StatusCodes } from 'http-status-codes';
import { OrgFactory } from '../test-support/factories/org.factory';
import { EnrolledOrgUserFactory } from '../test-support/factories/user.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import { OrgType } from '../enums/org-type.enum';
import { UserRole } from '../enums/user-role.enum';

// Mock the DistrictService module
vi.mock('../services/district/district.service', () => ({
  DistrictService: vi.fn(),
}));

import { DistrictService } from '../services/district/district.service';

/**
 * Type-safe assertion helper for success responses.
 * Asserts the status is OK and returns the data with proper typing.
 */
function expectOkResponse<T>(result: { status: number; body: { data: T } | { error: unknown } }): T {
  expect(result.status).toBe(StatusCodes.OK);
  expect(result.body).toHaveProperty('data');
  return (result.body as { data: T }).data;
}

/**
 * Type-safe assertion helper for error responses.
 */
function expectErrorResponse(
  result: { status: number; body: { data: unknown } | { error: unknown } },
  expectedStatus: number,
) {
  expect(result.status).toBe(expectedStatus);
  expect(result.body).toHaveProperty('error');
  return (result.body as { error: unknown }).error;
}

describe('DistrictsController', () => {
  const mockList = vi.fn();
  const mockGetById = vi.fn();
  const mockListUsers = vi.fn();
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(DistrictService).mockReturnValue({
      list: mockList,
      getById: mockGetById,
      listUsers: mockListUsers,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  describe('list', () => {
    it('should return paginated districts with 200 status', async () => {
      const mockDistricts = [
        OrgFactory.build({ orgType: OrgType.DISTRICT }),
        OrgFactory.build({ orgType: OrgType.DISTRICT }),
      ];
      mockList.mockResolvedValue({
        items: mockDistricts,
        totalItems: 2,
      });

      // Re-import to pick up the mock
      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
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

    it('should transform district fields to API response format', async () => {
      const mockDistrict = OrgFactory.build({
        id: 'district-uuid-123',
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        locationAddressLine1: '123 Main St',
        locationCity: 'Springfield',
        locationStateProvince: 'IL',
        locationPostalCode: '62701',
        locationCountry: 'USA',
        createdAt: new Date('2023-06-15T10:30:00Z'),
        updatedAt: new Date('2023-06-16T11:00:00Z'),
        isRosteringRootOrg: true,
      });
      mockList.mockResolvedValue({
        items: [mockDistrict],
        totalItems: 1,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const data = expectOkResponse(result);
      const district = data.items[0];

      expect(district).toMatchObject({
        id: 'district-uuid-123',
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        location: {
          addressLine1: '123 Main St',
          city: 'Springfield',
          stateProvince: 'IL',
          postalCode: '62701',
          country: 'USA',
        },
        isRosteringRootOrg: true,
      });
    });

    it('should include counts when embed=counts is requested', async () => {
      const mockDistrict = OrgFactory.build({
        orgType: OrgType.DISTRICT,
      });
      const mockDistrictWithCounts = {
        ...mockDistrict,
        counts: {
          users: 150,
          schools: 10,
          classes: 45,
        },
      };

      mockList.mockResolvedValue({
        items: [mockDistrictWithCounts],
        totalItems: 1,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: ['counts'],
      });

      const data = expectOkResponse(result);
      expect(data.items[0]!.counts).toEqual({
        users: 150,
        schools: 10,
        classes: 45,
      });
    });

    it('should calculate totalPages correctly', async () => {
      const mockDistricts = OrgFactory.buildList(3, { orgType: OrgType.DISTRICT });
      mockList.mockResolvedValue({
        items: mockDistricts,
        totalItems: 53,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 2,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.pagination.totalPages).toBe(3); // ceil(53 / 25) = 3
    });

    it('should pass includeEnded parameter to service', async () => {
      mockList.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        includeEnded: true,
        embed: [],
      });

      expect(mockList).toHaveBeenCalledWith(
        mockAuthContext,
        expect.objectContaining({
          includeEnded: true,
        }),
      );
    });

    it('should handle ApiError with 500 Internal Server Error', async () => {
      const error = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockList.mockRejectedValue(error);

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody).toBeDefined();
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockList.mockRejectedValue(error);

      const { DistrictsController: Controller } = await import('./districts.controller');

      await expect(
        Controller.list(mockAuthContext, {
          page: 1,
          perPage: 25,
          sortBy: 'name',
          sortOrder: 'asc',
          embed: [],
        }),
      ).rejects.toThrow('Unexpected error');
    });

    it('should omit location when all location fields are null', async () => {
      const mockDistrict = OrgFactory.build({
        orgType: OrgType.DISTRICT,
        locationAddressLine1: null,
        locationAddressLine2: null,
        locationCity: null,
        locationStateProvince: null,
        locationPostalCode: null,
        locationCountry: null,
        locationLatLong: null,
      });
      mockList.mockResolvedValue({
        items: [mockDistrict],
        totalItems: 1,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.items[0]).not.toHaveProperty('location');
    });

    it('should omit identifiers when all identifier fields are null', async () => {
      const mockDistrict = OrgFactory.build({
        orgType: OrgType.DISTRICT,
        mdrNumber: null,
        ncesId: null,
        stateId: null,
        schoolNumber: null,
      });
      mockList.mockResolvedValue({
        items: [mockDistrict],
        totalItems: 1,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.list(mockAuthContext, {
        page: 1,
        perPage: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      const data = expectOkResponse(result);
      expect(data.items[0]).not.toHaveProperty('identifiers');
    });
  });

  describe('getById', () => {
    it('should return a district with 200 status', async () => {
      const mockDistrict = {
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockDistrict);

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.getById(mockAuthContext, 'district-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data).toMatchObject({
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
      });
      expect(mockGetById).toHaveBeenCalledWith(mockAuthContext, 'district-123');
    });

    it('should transform district with location data', async () => {
      const mockDistrict = {
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        isRosteringRootOrg: true,
        locationAddressLine1: '123 Main St',
        locationCity: 'Test City',
        locationStateProvince: 'CA',
        locationPostalCode: '12345',
        locationCountry: 'USA',
        locationLatLong: { x: -122.4194, y: 37.7749 },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockDistrict);

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.getById(mockAuthContext, 'district-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data.location).toMatchObject({
        addressLine1: '123 Main St',
        city: 'Test City',
        stateProvince: 'CA',
        postalCode: '12345',
        country: 'USA',
        coordinates: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
      });
    });

    it('should transform district with identifiers', async () => {
      const mockDistrict = {
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        isRosteringRootOrg: true,
        mdrNumber: 'MDR123',
        ncesId: 'NCES456',
        stateId: 'STATE789',
        schoolNumber: 'SCH001',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockDistrict);

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.getById(mockAuthContext, 'district-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data.identifiers).toMatchObject({
        mdrNumber: 'MDR123',
        ncesId: 'NCES456',
        stateId: 'STATE789',
        schoolNumber: 'SCH001',
      });
    });

    it('should handle rosteringEnded timestamp', async () => {
      const mockDistrict = {
        id: 'district-123',
        name: 'Ended District',
        abbreviation: 'ED',
        orgType: OrgType.DISTRICT,
        parentOrgId: null,
        isRosteringRootOrg: true,
        rosteringEnded: new Date('2023-12-31'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockDistrict);

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.getById(mockAuthContext, 'district-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data.rosteringEnded).toBe('2023-12-31T00:00:00.000Z');
    });

    it('should handle ApiError with 404 Not Found', async () => {
      mockGetById.mockRejectedValue(
        new ApiError('District not found', {
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
        }),
      );

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.getById(mockAuthContext, 'district-999');

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: { message: string } }).error.message).toBeDefined();
    });

    it('should handle ApiError with 500 Internal Server Error', async () => {
      mockGetById.mockRejectedValue(
        new ApiError('Database error', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.getById(mockAuthContext, 'district-123');

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: { message: string } }).error.message).toBeDefined();
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockGetById.mockRejectedValue(error);

      const { DistrictsController: Controller } = await import('./districts.controller');

      await expect(Controller.getById(mockAuthContext, 'district-123')).rejects.toThrow('Unexpected error');
    });
  });

  describe('listUsers', () => {
    it('should return paginated users with 200 status', async () => {
      const mockUsers = EnrolledOrgUserFactory.buildList(3);
      mockListUsers.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.listUsers(mockAuthContext, 'district-123', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const data = expectOkResponse(result);
      expect(data.items).toHaveLength(3);
      expect(data.pagination).toEqual({
        page: 1,
        perPage: 25,
        totalItems: 3,
        totalPages: 1,
      });
    });

    it('should handle empty results', async () => {
      mockListUsers.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.listUsers(mockAuthContext, 'district-123', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const data = expectOkResponse(result);
      expect(data.items).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });

    it('should pass query parameters to service', async () => {
      mockListUsers.mockResolvedValue({
        items: [],
        totalItems: 0,
      });

      const { DistrictsController: Controller } = await import('./districts.controller');

      await Controller.listUsers(mockAuthContext, 'district-456', {
        page: 2,
        perPage: 50,
        sortBy: 'username',
        sortOrder: SortOrder.DESC,
        grade: ['5'],
        role: UserRole.STUDENT,
      });

      expect(mockListUsers).toHaveBeenCalledWith(mockAuthContext, 'district-456', {
        page: 2,
        perPage: 50,
        sortBy: 'username',
        sortOrder: SortOrder.DESC,
        grade: ['5'],
        role: UserRole.STUDENT,
      });
    });

    it('should handle ApiError with 404 Not Found', async () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockListUsers.mockRejectedValue(error);

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.listUsers(mockAuthContext, 'nonexistent-district', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const errorBody = expectErrorResponse(result, StatusCodes.NOT_FOUND);
      expect(errorBody).toBeDefined();
    });

    it('should handle ApiError with 403 Forbidden', async () => {
      const error = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockListUsers.mockRejectedValue(error);

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.listUsers(mockAuthContext, 'district-123', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody).toBeDefined();
    });

    it('should handle ApiError with 500 Internal Server Error', async () => {
      const error = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockListUsers.mockRejectedValue(error);

      const { DistrictsController: Controller } = await import('./districts.controller');

      const result = await Controller.listUsers(mockAuthContext, 'district-123', {
        page: 1,
        perPage: 25,
        sortBy: 'nameLast',
        sortOrder: SortOrder.ASC,
      });

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody).toBeDefined();
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockListUsers.mockRejectedValue(error);

      const { DistrictsController: Controller } = await import('./districts.controller');

      await expect(
        Controller.listUsers(mockAuthContext, 'district-123', {
          page: 1,
          perPage: 25,
          sortBy: 'nameLast',
          sortOrder: SortOrder.ASC,
        }),
      ).rejects.toThrow('Unexpected error');
    });
  });
});
