import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ClassService } from './class.service';
import { ClassFactory } from '../../test-support/factories/class.factory';
import { UserFactory } from '../../test-support/factories/user.factory';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { UserRole } from '../../enums/user-role.enum';
import { createMockClassRepository } from '../../test-support/repositories';

describe('ClassService', () => {
  let mockClassRepository: ReturnType<typeof createMockClassRepository>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockClassRepository = createMockClassRepository();
  });

  describe('listUsers', () => {
    const defaultOptions = {
      page: 1,
      perPage: 25,
      sortBy: 'nameLast' as const,
      sortOrder: 'asc' as const,
    };

    it('should return users for super admin (unrestricted)', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = UserFactory.buildList(3).map((user) => ({
        ...user,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(),
      }));
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions);

      expect(mockClassRepository.getById).toHaveBeenCalledWith({ id: 'class-123' });
      expect(mockClassRepository.getUsersByClassId).toHaveBeenCalledWith('class-123', {
        page: 1,
        perPage: 25,
        orderBy: { field: 'nameLast', direction: 'asc' },
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should check authorization for non-super admin users with supervisory role', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = UserFactory.buildList(2).map((user) => ({
        ...user,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(),
      }));
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getAuthorizedById.mockResolvedValue(mockClass);
      mockClassRepository.getUserRolesForClass.mockResolvedValue([UserRole.TEACHER]);
      mockClassRepository.getAuthorizedUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 2,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      const result = await service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'class-123', defaultOptions);

      expect(mockClassRepository.getById).toHaveBeenCalledWith({ id: 'class-123' });
      expect(mockClassRepository.getAuthorizedById).toHaveBeenCalled();
      expect(mockClassRepository.getUserRolesForClass).toHaveBeenCalledWith('user-123', 'class-123');
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it('should allow administrator role to list users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = UserFactory.buildList(5).map((user) => ({
        ...user,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(),
      }));
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getAuthorizedById.mockResolvedValue(mockClass);
      mockClassRepository.getUserRolesForClass.mockResolvedValue([UserRole.ADMINISTRATOR]);
      mockClassRepository.getAuthorizedUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 5,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      const result = await service.listUsers(
        { userId: 'admin-user-123', isSuperAdmin: false },
        'class-123',
        defaultOptions,
      );

      expect(result.items).toHaveLength(5);
    });

    it('should allow site_administrator role to list users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = UserFactory.buildList(4).map((user) => ({
        ...user,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(),
      }));
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getAuthorizedById.mockResolvedValue(mockClass);
      mockClassRepository.getUserRolesForClass.mockResolvedValue([UserRole.SITE_ADMINISTRATOR]);
      mockClassRepository.getAuthorizedUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 4,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      const result = await service.listUsers(
        { userId: 'site-admin-123', isSuperAdmin: false },
        'class-123',
        defaultOptions,
      );

      expect(result.items).toHaveLength(4);
    });

    it('should allow user with teacher role for class but admin role for school to list users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      const mockUsers = UserFactory.buildList(3).map((user) => ({
        ...user,
        role: UserRole.STUDENT,
        enrollmentStart: new Date(),
      }));
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getAuthorizedById.mockResolvedValue(mockClass);
      mockClassRepository.getUserRolesForClass.mockResolvedValue([UserRole.TEACHER, UserRole.ADMINISTRATOR]);
      mockClassRepository.getAuthorizedUsersByClassId.mockResolvedValue({
        items: mockUsers,
        totalItems: 3,
      });

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      const result = await service.listUsers(
        { userId: 'teacher-with-school-admin-123', isSuperAdmin: false },
        'class-123',
        defaultOptions,
      );

      expect(mockClassRepository.getUserRolesForClass).toHaveBeenCalledWith(
        'teacher-with-school-admin-123',
        'class-123',
      );
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });

    it('should return empty results when class has no users', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getUsersByClassId.mockResolvedValue({ items: [], totalItems: 0 });

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      const result = await service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'class-123', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
    });

    it('should throw not-found error when class does not exist', async () => {
      mockClassRepository.getById.mockResolvedValue(null);

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      await expect(
        service.listUsers({ userId: 'admin-123', isSuperAdmin: true }, 'non-existent-id', defaultOptions),
      ).rejects.toMatchObject({
        message: 'Class not found',
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
    });

    it('should throw forbidden error when non-super admin has no access to existing class', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getAuthorizedById.mockResolvedValue(null);

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'class-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw forbidden error when user has no supervisory role', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getAuthorizedById.mockResolvedValue(mockClass);
      mockClassRepository.getUserRolesForClass.mockResolvedValue([UserRole.STUDENT]);

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      await expect(
        service.listUsers({ userId: 'user-123', isSuperAdmin: false }, 'class-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
    });

    it('should throw forbidden error for caregiver roles (guardian/parent/relative) - supervised not supervisory', async () => {
      const mockClass = ClassFactory.build({ id: 'class-123' });
      mockClassRepository.getById.mockResolvedValue(mockClass);
      mockClassRepository.getAuthorizedById.mockResolvedValue(mockClass);
      mockClassRepository.getUserRolesForClass.mockResolvedValue([UserRole.GUARDIAN]);

      const service = ClassService({
        classRepository: mockClassRepository,
      });

      await expect(
        service.listUsers({ userId: 'caregiver-123', isSuperAdmin: false }, 'class-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      // Also verify parent and relative roles are rejected
      mockClassRepository.getUserRolesForClass.mockResolvedValue([UserRole.PARENT]);
      await expect(
        service.listUsers({ userId: 'parent-123', isSuperAdmin: false }, 'class-123', defaultOptions),
      ).rejects.toMatchObject({
        message: ApiErrorMessage.FORBIDDEN,
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });

      mockClassRepository.getUserRolesForClass.mockResolvedValue([UserRole.RELATIVE]);
      await expect(
        service.listUsers({ userId: 'relative-123', isSuperAdmin: false }, 'class-123', defaultOptions),
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
