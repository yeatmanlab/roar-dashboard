import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import type { AuthContext } from '../types/auth-context';

// Mock the service using vi.hoisted to avoid initialization issues
const { mockGetById } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
}));

vi.mock('../services/district/district.service', () => ({
  DistrictService: () => ({
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

      const result = await DistrictsController.getById(mockAuthContext, 'district-123', {
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.body as { data: any }).data).toMatchObject({
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
      });
      expect(mockGetById).toHaveBeenCalledWith('district-123', mockAuthContext, {
        embedChildren: false,
      });
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

    it('should include children when embed=children is requested', async () => {
      const mockDistrict = {
        id: 'district-123',
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        children: [
          {
            id: 'school-1',
            name: 'School A',
            abbreviation: 'SA',
            orgType: 'school',
            parentOrgId: 'district-123',
            isRosteringRootOrg: false,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
          },
          {
            id: 'school-2',
            name: 'School B',
            abbreviation: 'SB',
            orgType: 'school',
            parentOrgId: 'district-123',
            isRosteringRootOrg: false,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
          },
        ],
      };

      mockGetById.mockResolvedValue(mockDistrict);

      const result = await DistrictsController.getById(mockAuthContext, 'district-123', {
        embed: ['children'],
      });

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toHaveProperty('data');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (result.body as { data: any }).data;
      expect(data.children).toHaveLength(2);
      expect(data.children?.[0]).toMatchObject({
        id: 'school-1',
        name: 'School A',
      });
      expect(mockGetById).toHaveBeenCalledWith('district-123', mockAuthContext, {
        embedChildren: true,
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

    it('should handle ApiError with 400 Bad Request', async () => {
      mockGetById.mockRejectedValue(
        new ApiError('Invalid UUID format', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_VALIDATION_FAILED,
        }),
      );

      const { DistrictsController } = await import('./districts.controller');

      const result = await DistrictsController.getById(mockAuthContext, 'invalid-id', {
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.BAD_REQUEST);
      expect(result.body).toHaveProperty('error');
      expect((result.body as { error: { message: string } }).error.message).toBeDefined();
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

    it('should handle ApiError with 403 Forbidden', async () => {
      mockGetById.mockRejectedValue(
        new ApiError('Access denied', {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const { DistrictsController } = await import('./districts.controller');

      const result = await DistrictsController.getById(mockAuthContext, 'district-123', {
        embed: [],
      });

      expect(result.status).toBe(StatusCodes.FORBIDDEN);
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
