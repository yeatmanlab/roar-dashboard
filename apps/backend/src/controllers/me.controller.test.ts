import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { MeController } from './me.controller';
import { UserFactory, AuthContextFactory } from '../test-support/factories/user.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';

// Hoist mock function
const mockGetById = vi.hoisted(() => vi.fn());

// Mock UserService
vi.mock('../services/user', () => ({
  UserService: () => ({
    getById: mockGetById,
  }),
}));

describe('MeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return user profile when user exists', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });
      const mockUser = UserFactory.build({
        id: authContext.userId,
        nameFirst: 'John',
        nameLast: 'Doe',
        userType: 'student',
      });
      mockGetById.mockResolvedValue(mockUser);

      const result = await MeController.get(authContext);

      expect(mockGetById).toHaveBeenCalledWith(authContext, authContext.userId);
      expect(result).toEqual({
        status: StatusCodes.OK,
        body: {
          data: {
            id: mockUser.id,
            userType: mockUser.userType,
            nameFirst: mockUser.nameFirst,
            nameLast: mockUser.nameLast,
          },
        },
      });
    });

    it('should handle null name fields', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-456', isSuperAdmin: false });
      const mockUser = UserFactory.build({
        id: authContext.userId,
        nameFirst: null,
        nameLast: null,
        userType: 'educator',
      });
      mockGetById.mockResolvedValue(mockUser);

      const result = await MeController.get(authContext);

      expect(mockGetById).toHaveBeenCalledWith(authContext, authContext.userId);
      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({
        data: {
          id: mockUser.id,
          userType: mockUser.userType,
          nameFirst: null,
          nameLast: null,
        },
      });
    });

    it('should return 401 when service throws UNAUTHORIZED ApiError', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-789', isSuperAdmin: false });
      const error = new ApiError('Authentication failed', {
        statusCode: StatusCodes.UNAUTHORIZED,
        code: ApiErrorCode.AUTH_REQUIRED,
      });
      mockGetById.mockRejectedValue(error);

      const result = await MeController.get(authContext);

      expect(mockGetById).toHaveBeenCalledWith(authContext, authContext.userId);
      expect(result.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(result.body).toEqual({
        error: {
          message: 'Authentication failed',
          code: ApiErrorCode.AUTH_REQUIRED,
          traceId: error.traceId,
        },
      });
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR ApiError', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-999', isSuperAdmin: false });
      const error = new ApiError('Database error', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockGetById.mockRejectedValue(error);

      const result = await MeController.get(authContext);

      expect(mockGetById).toHaveBeenCalledWith(authContext, authContext.userId);
      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toEqual({
        error: {
          message: 'Database error',
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          traceId: error.traceId,
        },
      });
    });

    it('should rethrow non-ApiError errors', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-111', isSuperAdmin: false });
      const error = new Error('Unexpected error');
      mockGetById.mockRejectedValue(error);

      await expect(MeController.get(authContext)).rejects.toThrow('Unexpected error');
      expect(mockGetById).toHaveBeenCalledWith(authContext, authContext.userId);
    });
  });
});
