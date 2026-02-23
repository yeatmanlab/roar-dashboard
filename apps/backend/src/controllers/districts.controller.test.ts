import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import type { AuthContext } from '../types/auth-context';

// Mock the service using vi.hoisted to avoid initialization issues
const { mockList, mockGetById } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockGetById: vi.fn(),
}));

vi.mock('../services/district/district.service', () => ({
  DistrictService: () => ({
    list: mockList,
    getById: mockGetById,
  }),
}));

// Import controller after mock is set up
import { DistrictsController } from './districts.controller';

const mockAuthContext: AuthContext = {
  userId: 'user-123',
  isSuperAdmin: false,
};

describe('DistrictsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated districts with 200 status', async () => {
      const mockResult = {
        items: [
          {
            id: 'district-1',
            name: 'District A',
            abbreviation: 'DA',
            orgType: 'district',
            parentOrgId: null,
            isRosteringRootOrg: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
          },
          {
            id: 'district-2',
            name: 'District B',
            abbreviation: 'DB',
            orgType: 'district',
            parentOrgId: null,
            isRosteringRootOrg: true,
            createdAt: new Date('2024-01-03'),
            updatedAt: new Date('2024-01-04'),
          },
        ],
        totalItems: 2,
      };

      mockList.mockResolvedValue(mockResult);

      const result = await DistrictsController.list(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (result.body as { data: any }).data;
      expect(data.items).toHaveLength(2);
      expect(data.pagination).toMatchObject({
        page: 1,
        perPage: 10,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should include counts when embed=counts is requested', async () => {
      const mockResult = {
        items: [
          {
            id: 'district-1',
            name: 'District A',
            abbreviation: 'DA',
            orgType: 'district',
            parentOrgId: null,
            isRosteringRootOrg: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            counts: {
              users: 100,
              schools: 5,
              classes: 20,
            },
          },
        ],
        totalItems: 1,
      };

      mockList.mockResolvedValue(mockResult);

      const result = await DistrictsController.list(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: ['counts'],
      });

      expect(result.status).toBe(StatusCodes.OK);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (result.body as { data: any }).data;
      expect(data.items[0].counts).toMatchObject({
        users: 100,
        schools: 5,
        classes: 20,
      });
      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        embedCounts: true,
      });
    });

    it('should handle includeEnded parameter', async () => {
      const mockResult = {
        items: [],
        totalItems: 0,
      };

      mockList.mockResolvedValue(mockResult);

      await DistrictsController.list(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
        includeEnded: true,
      });

      expect(mockList).toHaveBeenCalledWith(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        includeEnded: true,
      });
    });

    it('should calculate totalPages correctly', async () => {
      const mockResult = {
        items: Array(10).fill({
          id: 'district-1',
          name: 'District A',
          abbreviation: 'DA',
          orgType: 'district',
          parentOrgId: null,
          isRosteringRootOrg: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        }),
        totalItems: 25,
      };

      mockList.mockResolvedValue(mockResult);

      const result = await DistrictsController.list(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (result.body as { data: any }).data;
      expect(data.pagination.totalPages).toBe(3); // 25 items / 10 per page = 3 pages
    });

    it('should handle ApiError with 403 Forbidden', async () => {
      mockList.mockRejectedValue(
        new ApiError('Access denied', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const result = await DistrictsController.list(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
      expect(result.body).toHaveProperty('error');
    });

    it('should handle ApiError with 500 Internal Server Error', async () => {
      mockList.mockRejectedValue(
        new ApiError('Database error', {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
        }),
      );

      const result = await DistrictsController.list(mockAuthContext, {
        page: 1,
        perPage: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error');
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockList.mockRejectedValue(error);

      await expect(
        DistrictsController.list(mockAuthContext, {
          page: 1,
          perPage: 10,
          sortBy: 'name',
          sortOrder: 'asc',
          embed: [],
        }),
      ).rejects.toThrow('Unexpected error');
    });
  });

  describe('getById', () => {
    it('should return a district with 200 status', async () => {
      const mockDistrict = {
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockDistrict);

      const result = await DistrictsController.getById(mockAuthContext, 'district-123');

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data).toMatchObject({
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
      });
      expect(mockGetById).toHaveBeenCalledWith('district-123', mockAuthContext);
    });

    it('should transform district with location data', async () => {
      const mockDistrict = {
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        locationAddressLine1: '123 Main St',
        locationCity: 'Test City',
        locationStateProvince: 'CA',
        locationPostalCode: '12345',
        locationCountry: 'USA',
        locationLatLong: [-122.4194, 37.7749], // [longitude, latitude]
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockDistrict);

      const result = await DistrictsController.getById(mockAuthContext, 'district-123', {
        embed: [],
      });

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
        orgType: 'district',
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

      const result = await DistrictsController.getById(mockAuthContext, 'district-123', {
        embed: [],
      });

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
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        rosteringEnded: new Date('2023-12-31'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockGetById.mockResolvedValue(mockDistrict);

      const result = await DistrictsController.getById(mockAuthContext, 'district-123', {
        embed: [],
      });

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

      const { DistrictsController } = await import('./districts.controller');

      const result = await DistrictsController.getById(mockAuthContext, 'district-999', {
        embed: [],
      });

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

      const { DistrictsController } = await import('./districts.controller');

      const result = await DistrictsController.getById(mockAuthContext, 'district-123', {
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: { message: string } }).error.message).toBeDefined();
    });

    it('should rethrow non-ApiError errors', async () => {
      const error = new Error('Unexpected error');
      mockGetById.mockRejectedValue(error);

      const { DistrictsController } = await import('./districts.controller');

      await expect(
        DistrictsController.getById(mockAuthContext, 'district-123', {
          embed: [],
        }),
      ).rejects.toThrow('Unexpected error');
    });
  });
});
