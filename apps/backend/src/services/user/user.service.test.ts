import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { UserService } from './user.service';
import { UserFactory, AuthContextFactory } from '../../test-support/factories/user.factory';
import { createMockUserRepository } from '../../test-support/repositories/user.repository';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';
import { ApiErrorMessage } from '../../enums/api-error-message.enum';
import { PostgresErrorCode } from '../../enums/postgres-error-code.enum';

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

  describe('update', () => {
    const superAdminContext = AuthContextFactory.build({ userId: 'admin-123', isSuperAdmin: true });
    const regularUserContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });
    const targetUserId = 'target-user-456';

    describe('authorization', () => {
      it('should throw FORBIDDEN immediately when requestor is not a super admin', async () => {
        const userService = UserService({ userRepository: mockUserRepository });

        await expect(userService.update(regularUserContext, targetUserId, { nameFirst: 'Jane' })).rejects.toMatchObject(
          {
            message: ApiErrorMessage.FORBIDDEN,
            statusCode: StatusCodes.FORBIDDEN,
            code: ApiErrorCode.AUTH_FORBIDDEN,
            context: { userId: regularUserContext.userId, id: targetUserId },
          },
        );

        // No repository calls should be made before the auth check
        expect(mockUserRepository.getById).not.toHaveBeenCalled();
        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });

      it('should throw NOT_FOUND when the target user does not exist', async () => {
        mockUserRepository.getById.mockResolvedValue(null);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(userService.update(superAdminContext, targetUserId, { nameFirst: 'Jane' })).rejects.toMatchObject({
          message: ApiErrorMessage.NOT_FOUND,
          statusCode: StatusCodes.NOT_FOUND,
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          context: { userId: superAdminContext.userId, id: targetUserId },
        });

        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });

      it('should allow a super admin to update any user', async () => {
        const mockUser = UserFactory.build({ id: targetUserId });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        mockUserRepository.update.mockResolvedValue(undefined);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(
          userService.update(superAdminContext, targetUserId, { nameFirst: 'Jane' }),
        ).resolves.toBeUndefined();

        expect(mockUserRepository.getById).toHaveBeenCalledWith({ id: targetUserId });
        expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
      });
    });

    describe('partial update semantics', () => {
      it('should only pass provided fields to the repository', async () => {
        const mockUser = UserFactory.build({ id: targetUserId });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        mockUserRepository.update.mockResolvedValue(undefined);

        const userService = UserService({ userRepository: mockUserRepository });

        await userService.update(superAdminContext, targetUserId, { nameFirst: 'Jane', nameLast: 'Doe' });

        expect(mockUserRepository.update).toHaveBeenCalledWith({
          id: targetUserId,
          data: { nameFirst: 'Jane', nameLast: 'Doe' },
        });
      });

      it('should not include omitted fields in the repository call', async () => {
        const mockUser = UserFactory.build({ id: targetUserId });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        mockUserRepository.update.mockResolvedValue(undefined);

        const userService = UserService({ userRepository: mockUserRepository });

        // Only nameFirst is provided — email, grade, etc. should be absent from the update
        await userService.update(superAdminContext, targetUserId, { nameFirst: 'Jane' });

        const updateCall = mockUserRepository.update.mock.calls[0]![0]!;
        expect(updateCall.data).not.toHaveProperty('email');
        expect(updateCall.data).not.toHaveProperty('grade');
        expect(updateCall.data).not.toHaveProperty('nameLast');
      });

      it('should pass null to the repository to clear a nullable field', async () => {
        const mockUser = UserFactory.build({ id: targetUserId });
        mockUserRepository.getById.mockResolvedValue(mockUser);
        mockUserRepository.update.mockResolvedValue(undefined);

        const userService = UserService({ userRepository: mockUserRepository });

        await userService.update(superAdminContext, targetUserId, { nameFirst: null });

        expect(mockUserRepository.update).toHaveBeenCalledWith({
          id: targetUserId,
          data: { nameFirst: null },
        });
      });
    });

    describe('error handling', () => {
      it('should re-throw ApiError without wrapping', async () => {
        const mockUser = UserFactory.build({ id: targetUserId });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const apiError = new ApiError('Already wrapped', {
          statusCode: StatusCodes.BAD_REQUEST,
          code: ApiErrorCode.REQUEST_INVALID,
        });
        mockUserRepository.update.mockRejectedValue(apiError);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(userService.update(superAdminContext, targetUserId, { nameFirst: 'Jane' })).rejects.toBe(apiError);
      });

      it('should throw CONFLICT on a unique constraint violation', async () => {
        const mockUser = UserFactory.build({ id: targetUserId });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        /**
         * Simulate a PostgreSQL unique violation error (SQLSTATE 23505).
         * Object.assign is used to add the typed `code` property without using `as any`.
         * unwrapDrizzleError returns the error as-is when it is not a DrizzleQueryError,
         * so isUniqueViolation will detect the code directly on this error.
         */
        const uniqueViolationError = Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: PostgresErrorCode.UNIQUE_VIOLATION,
        });
        mockUserRepository.update.mockRejectedValue(uniqueViolationError);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(
          userService.update(superAdminContext, targetUserId, { email: 'duplicate@example.com' }),
        ).rejects.toMatchObject({
          message: ApiErrorMessage.CONFLICT,
          statusCode: StatusCodes.CONFLICT,
          code: ApiErrorCode.RESOURCE_CONFLICT,
          context: { userId: superAdminContext.userId, id: targetUserId },
        });
      });

      it('should throw DATABASE_QUERY_FAILED on an unexpected database error', async () => {
        const mockUser = UserFactory.build({ id: targetUserId });
        mockUserRepository.getById.mockResolvedValue(mockUser);

        const dbError = new Error('Connection timeout');
        mockUserRepository.update.mockRejectedValue(dbError);

        const userService = UserService({ userRepository: mockUserRepository });

        await expect(userService.update(superAdminContext, targetUserId, { nameFirst: 'Jane' })).rejects.toMatchObject({
          message: 'Failed to update user',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          context: { userId: superAdminContext.userId, id: targetUserId },
          cause: dbError,
        });
      });
    });
  });
});
