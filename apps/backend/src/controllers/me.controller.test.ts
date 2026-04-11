import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { MeController } from './me.controller';
import { UserFactory, AuthContextFactory } from '../test-support/factories/user.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';

// Hoist mock functions
const mockGetById = vi.hoisted(() => vi.fn());
const mockGetUnsignedTosAgreements = vi.hoisted(() => vi.fn());

// Mock UserService
vi.mock('../services/user', () => ({
  UserService: () => ({
    getById: mockGetById,
    getUnsignedTosAgreements: mockGetUnsignedTosAgreements,
  }),
}));

describe('MeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUnsignedTosAgreements.mockResolvedValue([]);
  });

  describe('get', () => {
    it('should return user profile with empty unsignedAgreements when all TOS are signed', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });
      const mockUser = UserFactory.build({
        id: authContext.userId,
        nameFirst: 'John',
        nameLast: 'Doe',
        userType: 'student',
      });
      mockGetById.mockResolvedValue(mockUser);
      mockGetUnsignedTosAgreements.mockResolvedValue([]);

      const result = await MeController.get(authContext);

      expect(mockGetById).toHaveBeenCalledWith(authContext, authContext.userId);
      expect(mockGetUnsignedTosAgreements).toHaveBeenCalledWith(authContext.userId);
      expect(result).toEqual({
        status: StatusCodes.OK,
        body: {
          data: {
            id: mockUser.id,
            userType: mockUser.userType,
            nameFirst: mockUser.nameFirst,
            nameLast: mockUser.nameLast,
            unsignedAgreements: [],
          },
        },
      });
    });

    it('should return user profile with unsigned agreements when TOS are not signed', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });
      const mockUser = UserFactory.build({
        id: authContext.userId,
        nameFirst: 'Jane',
        nameLast: 'Smith',
        userType: 'educator',
      });
      const unsignedAgreements = [
        {
          agreementId: 'agreement-1',
          agreementName: 'ROAR Terms of Service',
          versions: [
            { versionId: 'version-en', locale: 'en-US' },
            { versionId: 'version-es', locale: 'es-MX' },
          ],
        },
      ];
      mockGetById.mockResolvedValue(mockUser);
      mockGetUnsignedTosAgreements.mockResolvedValue(unsignedAgreements);

      const result = await MeController.get(authContext);

      expect(result).toEqual({
        status: StatusCodes.OK,
        body: {
          data: {
            id: mockUser.id,
            userType: mockUser.userType,
            nameFirst: mockUser.nameFirst,
            nameLast: mockUser.nameLast,
            unsignedAgreements,
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

      expect(result.status).toBe(StatusCodes.OK);
      expect(result.body).toEqual({
        data: {
          id: mockUser.id,
          userType: mockUser.userType,
          nameFirst: null,
          nameLast: null,
          unsignedAgreements: [],
        },
      });
    });

    it('should return 404 when service throws NOT_FOUND ApiError', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-789', isSuperAdmin: false });
      const error = new ApiError('Not found', {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockGetById.mockRejectedValue(error);

      const result = await MeController.get(authContext);

      expect(result.status).toBe(StatusCodes.NOT_FOUND);
      expect(result.body).toEqual({
        error: {
          message: 'Not found',
          code: ApiErrorCode.RESOURCE_NOT_FOUND,
          traceId: error.traceId,
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

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.body).toEqual({
        error: {
          message: 'Database error',
          code: ApiErrorCode.DATABASE_QUERY_FAILED,
          traceId: error.traceId,
        },
      });
    });

    it('should return 500 when getUnsignedTosAgreements fails', async () => {
      const authContext = AuthContextFactory.build({ userId: 'user-999', isSuperAdmin: false });
      const mockUser = UserFactory.build({ id: authContext.userId });
      mockGetById.mockResolvedValue(mockUser);
      const error = new ApiError('Failed to retrieve unsigned agreements', {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockGetUnsignedTosAgreements.mockRejectedValue(error);

      const result = await MeController.get(authContext);

      expect(result.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
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
