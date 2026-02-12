import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { OrgFactory } from '../test-support/factories/org.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { OrgType } from '../enums/org-type.enum';

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
  const mockAuthContext = { userId: 'user-123', isSuperAdmin: false };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(DistrictService).mockReturnValue({
      list: mockList,
    });
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
        dates: {
          created: '2023-06-15T10:30:00.000Z',
          updated: '2023-06-16T11:00:00.000Z',
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
      expect(data.items[0].counts).toEqual({
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

    it('should handle ApiError with 403 Forbidden', async () => {
      const error = new ApiError('Access denied', {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
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

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody).toBeDefined();
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
});
