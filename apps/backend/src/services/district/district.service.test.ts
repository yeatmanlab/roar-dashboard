/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { DistrictService } from './district.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import type { AuthContext } from '../../types/auth-context';

// Mock repository
const mockGetByIdWithEmbeds = vi.fn();
const mockDistrictRepository = {
  getByIdWithEmbeds: mockGetByIdWithEmbeds,
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
    it('should accept valid UUID format', async () => {
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

      mockGetByIdWithEmbeds.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      const result = await service.getById(validUuid, mockAuthContext, {});

      expect(result).toEqual(mockDistrict);
      expect(mockGetByIdWithEmbeds).toHaveBeenCalledWith(validUuid, expect.any(Object), false);
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

      mockGetByIdWithEmbeds.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await service.getById(validUuid, mockAuthContext, {});

      expect(mockGetByIdWithEmbeds).toHaveBeenCalledWith(
        validUuid,
        {
          userId: 'user-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
        },
        false,
      );
    });

    it('should build access control filter for super admins', async () => {
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

      mockGetByIdWithEmbeds.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await service.getById(validUuid, mockSuperAdminContext, {});

      expect(mockGetByIdWithEmbeds).toHaveBeenCalledWith(
        validUuid,
        {
          userId: 'admin-123',
          allowedRoles: expect.arrayContaining(['site_administrator', 'administrator', 'teacher']),
        },
        false,
      );
    });

    it('should pass embedChildren=false when not requested', async () => {
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

      mockGetByIdWithEmbeds.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await service.getById(validUuid, mockAuthContext, {});

      expect(mockGetByIdWithEmbeds).toHaveBeenCalledWith(validUuid, expect.any(Object), false);
    });

    it('should pass embedChildren=true when requested', async () => {
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
        children: [],
      };

      mockGetByIdWithEmbeds.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await service.getById(validUuid, mockAuthContext, { embedChildren: true });

      expect(mockGetByIdWithEmbeds).toHaveBeenCalledWith(validUuid, expect.any(Object), true);
    });

    it('should throw 404 when district not found', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockGetByIdWithEmbeds.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await expect(service.getById(validUuid, mockAuthContext, {})).rejects.toThrow(ApiError);

      try {
        await service.getById(validUuid, mockAuthContext, {});
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        expect((error as ApiError).code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
        expect((error as ApiError).message).toBe('District not found');
      }
    });

    it('should throw 404 when user lacks access (security - no distinction)', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockGetByIdWithEmbeds.mockResolvedValue(null);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      await expect(service.getById(validUuid, mockAuthContext, {})).rejects.toThrow(ApiError);

      try {
        await service.getById(validUuid, mockAuthContext, {});
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
        // Should not distinguish between "not found" and "no access" for security
        expect((error as ApiError).message).toBe('District not found');
      }
    });

    it('should return district with children when embedChildren=true', async () => {
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
        children: [
          {
            id: 'school-1',
            name: 'School A',
            abbreviation: 'SA',
            orgType: 'school',
            parentOrgId: validUuid,
            isRosteringRootOrg: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockGetByIdWithEmbeds.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      const result = await service.getById(validUuid, mockAuthContext, { embedChildren: true });

      expect(result).toEqual(mockDistrict);
      expect(result.children).toHaveLength(1);
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

      mockGetByIdWithEmbeds.mockResolvedValue(mockDistrict);

      const service = DistrictService({
        districtRepository: mockDistrictRepository as any,
      });

      const result = await service.getById(validUuid, mockAuthContext, {});

      expect(result).toEqual(mockDistrict);
    });
  });
});
