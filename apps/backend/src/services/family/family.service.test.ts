import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { SortOrder } from '@roar-dashboard/api-contract';
import { FamilyService } from './family.service';
import { FamilyFactory } from '../../test-support/factories/family.factory';
import { EnrolledFamilyUserFactory } from '../../test-support/factories/user.factory';
import { createMockFamilyRepository } from '../../test-support/repositories';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { createMockAuthorizationService } from '../../test-support/services';
import { FgaType, FgaRelation } from '../authorization/fga-constants';

describe('FamilyService', () => {
  describe('listUsers', () => {
    const mockFamilyRepo = createMockFamilyRepository();
    const mockAuthorizationService = createMockAuthorizationService();

    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'nameLast' as const,
      sortOrder: SortOrder.ASC,
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return users for super admin (unrestricted)', async () => {
      const mockFamily = FamilyFactory.build({ id: 'family-123' });
      const mockUsers = EnrolledFamilyUserFactory.buildList(3);
      mockFamilyRepo.getById.mockResolvedValue(mockFamily);
      mockFamilyRepo.getUsersByFamilyId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = FamilyService({
        familyRepository: mockFamilyRepo,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'family-123', defaultOptions);

      expect(mockFamilyRepo.getById).toHaveBeenCalledWith({ id: 'family-123' });
      // Super admin skips FGA gate
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(mockFamilyRepo.getUsersByFamilyId).toHaveBeenCalledWith('family-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should check authorization for non-super admin users via FGA', async () => {
      const mockFamily = FamilyFactory.build({ id: 'family-123' });
      const mockUsers = EnrolledFamilyUserFactory.buildList(2);
      mockFamilyRepo.getById.mockResolvedValue(mockFamily);
      mockAuthorizationService.requirePermission.mockResolvedValue(undefined);
      mockFamilyRepo.getUsersByFamilyId.mockResolvedValue({
        items: mockUsers,
        totalItems: 2,
      });

      const service = FamilyService({
        familyRepository: mockFamilyRepo,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'family-123', defaultOptions);

      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_LIST_USERS,
        `${FgaType.FAMILY}:family-123`,
      );
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return empty results when family has no users', async () => {
      const mockFamily = FamilyFactory.build({ id: 'family-123' });
      mockFamilyRepo.getById.mockResolvedValue(mockFamily);
      mockFamilyRepo.getUsersByFamilyId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = FamilyService({
        familyRepository: mockFamilyRepo,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'family-123', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when family does not exist', async () => {
      mockFamilyRepo.getById.mockResolvedValue(null);

      const service = FamilyService({
        familyRepository: mockFamilyRepo,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toMatchObject({
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw forbidden error when user lacks access to the family', async () => {
      const mockFamily = FamilyFactory.build({ id: 'family-123' });
      mockFamilyRepo.getById.mockResolvedValue(mockFamily);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = FamilyService({
        familyRepository: mockFamilyRepo,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'family-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw ApiError when database query fails', async () => {
      const mockFamily = FamilyFactory.build({ id: 'family-123' });
      mockFamilyRepo.getById.mockResolvedValue(mockFamily);
      const dbError = new Error('Connection refused');
      mockFamilyRepo.getUsersByFamilyId.mockRejectedValue(dbError);

      const service = FamilyService({
        familyRepository: mockFamilyRepo,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'family-123', defaultOptions),
      ).rejects.toMatchObject({
        message: 'Failed to retrieve family users',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });

    it('should pass role filter to repository', async () => {
      const mockFamily = FamilyFactory.build({ id: 'family-123' });
      mockFamilyRepo.getById.mockResolvedValue(mockFamily);
      mockFamilyRepo.getUsersByFamilyId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = FamilyService({
        familyRepository: mockFamilyRepo,
      });

      await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'family-123', {
        ...defaultOptions,
        role: 'parent',
      });

      expect(mockFamilyRepo.getUsersByFamilyId).toHaveBeenCalledWith('family-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        role: 'parent',
      });
    });

    it('should pass grade filter to repository', async () => {
      const mockFamily = FamilyFactory.build({ id: 'family-123' });
      mockFamilyRepo.getById.mockResolvedValue(mockFamily);
      mockFamilyRepo.getUsersByFamilyId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = FamilyService({
        familyRepository: mockFamilyRepo,
      });

      await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'family-123', {
        ...defaultOptions,
        grade: ['5', '6'],
      });

      expect(mockFamilyRepo.getUsersByFamilyId).toHaveBeenCalledWith('family-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
        grade: ['5', '6'],
      });
    });
  });
});
