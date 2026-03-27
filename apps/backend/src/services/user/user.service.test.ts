import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { UserService } from './user.service';
import { UserFactory, AuthContextFactory } from '../../test-support/factories/user.factory';
import { createMockUserRepository } from '../../test-support/repositories/user.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';

describe('UserService', () => {
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    vi.clearAllMocks();
  });

  describe('findByAuthId', () => {
    it('should return user when found', async () => {
      const mockUser = UserFactory.build();
      mockUserRepository.findByAuthId.mockResolvedValue(mockUser);

      const userService = UserService({ userRepository: mockUserRepository });
      const result = await userService.findByAuthId('test-auth-id');

      expect(mockUserRepository.findByAuthId).toHaveBeenCalledWith('test-auth-id');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findByAuthId.mockResolvedValue(null);

      const userService = UserService({ userRepository: mockUserRepository });
      const result = await userService.findByAuthId('non-existent-auth-id');

      expect(mockUserRepository.findByAuthId).toHaveBeenCalledWith('non-existent-auth-id');
      expect(result).toBeNull();
    });

    it('should wrap repository errors in ApiError with context', async () => {
      const dbError = new Error('Database connection failed');
      mockUserRepository.findByAuthId.mockRejectedValue(dbError);

      const userService = UserService({ userRepository: mockUserRepository });

      await expect(userService.findByAuthId('test-auth-id')).rejects.toMatchObject({
        message: 'Failed to retrieve user',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { authId: 'test-auth-id' },
        cause: dbError,
      });
    });

    it('should re-throw ApiError without wrapping', async () => {
      const apiError = new ApiError('Already wrapped', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_INVALID,
      });
      mockUserRepository.findByAuthId.mockRejectedValue(apiError);

      const userService = UserService({ userRepository: mockUserRepository });

      await expect(userService.findByAuthId('test-auth-id')).rejects.toBe(apiError);
    });
  });

  describe('getById', () => {
    describe('self-access', () => {
      it('should allow user to access their own profile', async () => {
        const authContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });
        const mockUser = UserFactory.build({ id: authContext.userId });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const userService = UserService({ userRepository: mockUserRepository });
        const result = await userService.getById(authContext, authContext.userId);

        expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: authContext.userId });
        expect(result).toEqual(mockUser);
        // Should NOT call getAuthorizedById for self-access
        expect(mockUserRepository.getAuthorizedById).not.toHaveBeenCalled();
      });
    });

    describe('super admin access', () => {
      it('should allow super admin to access any user', async () => {
        const authContext = AuthContextFactory.build({ userId: 'admin-456', isSuperAdmin: true });
        const targetUserId = 'other-user-789';
        const mockUser = UserFactory.build({ id: targetUserId });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const userService = UserService({ userRepository: mockUserRepository });
        const result = await userService.getById(authContext, targetUserId);

        expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: targetUserId });
        expect(result).toEqual(mockUser);
        // Should NOT call getAuthorizedById for super admin
        expect(mockUserRepository.getAuthorizedById).not.toHaveBeenCalled();
      });
    });

    describe('supervisory access', () => {
      it('should allow access when user is authorized via access controls', async () => {
        const authContext = AuthContextFactory.build({ userId: 'teacher-123', isSuperAdmin: false });
        const targetUserId = 'student-456';
        const mockUser = UserFactory.build({ id: targetUserId });

        mockUserRepository.getById.mockResolvedValue(mockUser);
        mockUserRepository.getAuthorizedById.mockResolvedValue(mockUser);

        const userService = UserService({ userRepository: mockUserRepository });
        const result = await userService.getById(authContext, targetUserId);

        expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: targetUserId });
        expect(mockUserRepository.getAuthorizedById).toHaveBeenCalledWith(
          expect.objectContaining({ userId: authContext.userId }),
          targetUserId,
        );
        expect(result).toEqual(mockUser);
      });

      it('should throw FORBIDDEN when user is not authorized via access controls', async () => {
        const authContext = AuthContextFactory.build({ userId: 'student-123', isSuperAdmin: false });
        const targetUserId = 'other-student-456';
        const mockUser = UserFactory.build({ id: targetUserId });

        mockUserRepository.getById.mockResolvedValue(mockUser);
        mockUserRepository.getAuthorizedById.mockResolvedValue(null);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(userService.getById(authContext, targetUserId)).rejects.toMatchObject({
          message: ApiErrorMessage.FORBIDDEN,
          statusCode: StatusCodes.FORBIDDEN,
          code: ApiErrorCode.AUTH_FORBIDDEN,
          context: { userId: authContext.userId, id: targetUserId },
        });
      });
    });

    describe('error cases', () => {
      it('should throw NOT_FOUND when user does not exist', async () => {
        const authContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });
        const targetUserId = 'non-existent-user';

        mockUserRepository.getById.mockResolvedValue(null);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(userService.getById(authContext, targetUserId)).rejects.toMatchObject({
          message: ApiErrorMessage.NOT_FOUND,
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { id: targetUserId, userId: authContext.userId },
        });
      });

      it('should wrap repository errors in ApiError with context', async () => {
        const authContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });
        const requestedUserId = 'user-456';
        const dbError = new Error('Database connection failed');

        mockUserRepository.getById.mockRejectedValue(dbError);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(userService.getById(authContext, requestedUserId)).rejects.toMatchObject({
          message: ApiErrorMessage.INTERNAL_SERVER_ERROR,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: 'user-123', requestedUserId },
          cause: dbError,
        });
      });

      it('should re-throw ApiError without wrapping', async () => {
        const authContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });
        const targetUserId = 'user-456';
        const apiError = new ApiError('Already wrapped', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_INVALID,
        });

        mockUserRepository.getById.mockRejectedValue(apiError);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(userService.getById(authContext, targetUserId)).rejects.toBe(apiError);
      });
    });
  });
});
