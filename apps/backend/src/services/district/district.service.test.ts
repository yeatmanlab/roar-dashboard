/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { DistrictService } from './district.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type { AuthContext } from '../../types/auth-context';

// Mock repository
const mockGetAuthorizedById = vi.fn();
const mockGetByIdUnrestricted = vi.fn();
const mockDistrictRepository = {
  getAuthorizedById: mockGetAuthorizedById,
  getByIdUnrestricted: mockGetByIdUnrestricted,
} as any;

const mockAuthContext: AuthContext = {
  userId: 'user-123',
  isSuperAdmin: false,
};

const mockSuperAdminContext: AuthContext = {
  userId: 'admin-123',
  isSuperAdmin: true,
};

describe('DistrictService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should fetch district by ID for regular users', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetAuthorizedById.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      const result = await service.getById(validUuid, mockAuthContext);

      expect(result).toEqual(mockDistrict);
      expect(mockGetByIdUnrestricted).not.toHaveBeenCalled();
    });

    it('should build access control filter for regular users', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetAuthorizedById.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await service.getById(validUuid, mockAuthContext);

      expect(mockGetAuthorizedById).toHaveBeenCalledWith(validUuid, {
        userId: 'user-123',
        allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
      });
    });

    it('should use getByIdUnrestricted for super admins', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockDistrict = {
        id: validUuid,
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetByIdUnrestricted.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await service.getById(validUuid, mockSuperAdminContext);

      // Super admins should use unrestricted method, not the authorized one
      expect(mockGetByIdUnrestricted).toHaveBeenCalledWith(validUuid);
      expect(mockGetAuthorizedById).not.toHaveBeenCalled();
    });

    it('should throw 404 when district not found', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockGetAuthorizedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await expect(service.getById(validUuid, mockAuthContext)).rejects.toThrow(ApiError);

      try {
        await service.getById(validUuid, mockAuthContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        expect((error as ApiError).code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
        expect((error as ApiError).message).toBe('District not found');
      }
    });

    it('should throw 404 when user lacks access (security - no distinction)', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockGetAuthorizedById.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await expect(service.getById(validUuid, mockAuthContext)).rejects.toThrow(ApiError);

      try {
        await service.getById(validUuid, mockAuthContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        // Should not distinguish between "not found" and "no access" for security
        expect((error as ApiError).message).toBe('District not found');
      }
    });

    it('should handle UUID with uppercase letters', async () => {
      const validUuid = '123E4567-E89B-12D3-A456-426614174000';
      const mockDistrict = {
        id: validUuid.toLowerCase(),
        name: 'Test District',
        abbreviation: 'TD',
        orgType: 'district',
        parentOrgId: null,
        isRosteringRootOrg: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetAuthorizedById.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      const result = await service.getById(validUuid, mockAuthContext);

      expect(result).toEqual(mockDistrict);
    });
  });
});
