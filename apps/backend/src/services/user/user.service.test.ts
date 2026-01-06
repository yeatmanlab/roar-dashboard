import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { UserService } from './user.service';
import { UserFactory } from '../../test-support/factories/user.factory';
import { ApiError } from '../../errors/api-error';
import { ApiErrorCode } from '../../enums/api-error-code.enum';

vi.mock('../../logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('UserService', () => {
  const mockUserRepository = {
    findByAuthId: vi.fn(),
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findByAuthId', () => {
    it('should return user when found', async () => {
      const mockUser = UserFactory.build();
      mockUserRepository.findByAuthId.mockResolvedValue(mockUser);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });
      const result = await userService.findByAuthId('test-auth-id');

      expect(mockUserRepository.findByAuthId).toHaveBeenCalledWith('test-auth-id');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findByAuthId.mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });
      const result = await userService.findByAuthId('non-existent-auth-id');

      expect(mockUserRepository.findByAuthId).toHaveBeenCalledWith('non-existent-auth-id');
      expect(result).toBeNull();
    });

    it('should wrap repository errors in ApiError with context', async () => {
      const dbError = new Error('Database connection failed');
      mockUserRepository.findByAuthId.mockRejectedValue(dbError);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });

      await expect(userService.findByAuthId('test-auth-id')).rejects.toBe(apiError);
    });
  });

  describe('getById', () => {
    it('should return user when found', async () => {
      const mockUser = UserFactory.build();
      mockUserRepository.get.mockResolvedValue(mockUser);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });
      const result = await userService.getById(mockUser.id);

      expect(mockUserRepository.get).toHaveBeenCalledWith({ id: mockUser.id });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.get.mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });
      const result = await userService.getById('non-existent-id');

      expect(mockUserRepository.get).toHaveBeenCalledWith({ id: 'non-existent-id' });
      expect(result).toBeNull();
    });

    it('should wrap repository errors in ApiError with context', async () => {
      const dbError = new Error('Database connection failed');
      mockUserRepository.get.mockRejectedValue(dbError);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });

      await expect(userService.getById('test-id')).rejects.toMatchObject({
        message: 'Failed to retrieve user',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
        context: { userId: 'test-id' },
        cause: dbError,
      });
    });

    it('should re-throw ApiError without wrapping', async () => {
      const apiError = new ApiError('Already wrapped', {
        statusCode: StatusCodes.BAD_REQUEST,
        code: ApiErrorCode.REQUEST_INVALID,
      });
      mockUserRepository.get.mockRejectedValue(apiError);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userService = UserService({ userRepository: mockUserRepository as any });

      await expect(userService.getById('test-id')).rejects.toBe(apiError);
    });
  });
});
