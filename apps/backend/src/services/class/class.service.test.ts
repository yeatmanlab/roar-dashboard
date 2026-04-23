import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { SortOrder } from '@roar-dashboard/api-contract';
import { ClassService } from './class.service';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { EnrolledUserFactory } from '../../test-support/factories/user.factory';
import { createMockClassRepository } from '../../test-support/repositories';
import type { MockClassRepository } from '../../test-support/repositories';
import { createMockAuthorizationService } from '../../test-support/services';
import { FgaType, FgaRelation } from '../authorization/fga-constants';
import type { MockAuthorizationService } from '../../test-support/services';

describe('ClassService', () => {
  let mockClassRepository: MockClassRepository;
  let mockAuthorizationService: MockAuthorizationService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockClassRepository = createMockClassRepository();
    mockAuthorizationService = createMockAuthorizationService();
  });

  describe('listUsers', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'nameLast' as const,
      sortOrder: SortOrder.ASC,
    };

    it('should return users for super admin (unrestricted)', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = EnrolledUserFactory.buildList(3);
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions);

      expect(mockClassRepository.getById).toHaveBeenCalledWith({ id: 'class-123' });
      expect(mockAuthorizationService.requirePermission).not.toHaveBeenCalled();
      expect(mockClassRepository.getUsersByClassId).toHaveBeenCalledWith('class-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should return users for class with rosteringEnded != null for super admin (unrestricted)', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123', rosteringEnded: new Date() });
      const mockUsers = EnrolledUserFactory.buildList(3);
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions);

      expect(mockClassRepository.getById).toHaveBeenCalledWith({ id: 'class-123' });
      expect(mockClassRepository.getUsersByClassId).toHaveBeenCalledWith('class-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should check FGA can_list_users for non-super admin users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = EnrolledUserFactory.buildList(2);
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 2,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'class-123', defaultOptions);

      expect(mockClassRepository.getById).toHaveBeenCalledWith({ id: 'class-123' });
      expect(mockAuthorizationService.requirePermission).toHaveBeenCalledWith(
        'user-123',
        FgaRelation.CAN_LIST_USERS,
        `${FgaType.CLASS}:class-123`,
      );
      expect(mockClassRepository.getUsersByClassId).toHaveBeenCalledWith('class-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: SortOrder.ASC },
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should return empty results when class has no users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when class does not exist', async () => {
      mockClassRepository.getById.mockResolvedValue(null);

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: false }, 'non-existent-id', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.NOT_FOUND,
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw forbidden error when FGA denies can_list_users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockAuthorizationService.requirePermission.mockRejectedValue(
        new ApiError(ApiErrorMessage.FORBIDDEN, {
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
        }),
      );

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'class-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw ApiError when database query fails', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      const dbError = new Error('Connection refused');
      mockClassRepository.getUsersByClassId.mockRejectedValue(dbError);

      const service = ClassService({
        classRepository: mockClassRepository,
        authorizationService: mockAuthorizationService,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions),
      ).rejects.toMatchObject({
        message: 'Failed to retrieve class users',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
    });
  });
});
