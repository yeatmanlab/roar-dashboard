import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { UserFactory, AuthContextFactory } from '../test-support/factories/user.factory';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';

// Mock the UserService module
vi.mock('../services/user', () => ({
  UserService: vi.fn(),
}));

import { UserService } from '../services/user';

/**
 * Type-safe assertion helper for success responses.
 * Asserts the status is OK and returns the data with proper typing.
 */
function expectOkResponse<T>(result: { status: number; body: { data: T } | { error: unknown } }): T {
  expect(result.status).toBe(StatusCodes.OK);
  expect(result.body).toHaveProperty('data');
  return (result.body as { data: T }).data;
}

/**
 * Type-safe assertion helper for error responses.
 */
function expectErrorResponse(
  result: { status: number; body: { data: unknown } | { error: unknown } },
  expectedStatus: number,
) {
  expect(result.status).toBe(expectedStatus);
  expect(result.body).toHaveProperty('error');
  return (result.body as { error: { message: string; code?: string; traceId?: string } }).error;
}

describe('UsersController', () => {
  const mockGetById = vi.fn();
  const mockAuthContext = AuthContextFactory.build({ userId: 'user-123', isSuperAdmin: false });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock service
    vi.mocked(UserService).mockReturnValue({
      getById: mockGetById,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  describe('get', () => {
    it('should return user with 200 status when found and authorized', async () => {
      const mockUser = UserFactory.build({
        id: 'user-456',
        nameFirst: 'John',
        nameLast: 'Doe',
        userType: 'student',
        email: 'john.doe@example.com',
        createdAt: new Date('2024-01-01T10:00:00.000Z'),
        updatedAt: new Date('2024-01-02T15:30:00.000Z'),
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-456');

      const data = expectOkResponse(result);
      expect(data).toMatchObject({
        id: 'user-456',
        nameFirst: 'John',
        nameLast: 'Doe',
        userType: 'student',
        email: 'john.doe@example.com',
      });
      expect(mockGetById).toHaveBeenCalledWith(mockAuthContext, 'user-456');
    });

    it('should transform Date fields to ISO datetime strings', async () => {
      const mockUser = UserFactory.build({
        id: 'user-789',
        createdAt: new Date('2024-01-15T08:30:00.000Z'),
        updatedAt: new Date('2024-01-20T14:45:00.000Z'),
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-789');

      const data = expectOkResponse(result);
      expect(data.createdAt).toBe('2024-01-15T08:30:00.000Z');
      expect(data.updatedAt).toBe('2024-01-20T14:45:00.000Z');
    });

    it('should handle null updatedAt field', async () => {
      const mockUser = UserFactory.build({
        id: 'user-101',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: null,
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-101');

      const data = expectOkResponse(result);
      expect(data.updatedAt).toBeNull();
    });

    it('should transform all user fields correctly', async () => {
      const mockUser = UserFactory.build({
        id: 'user-full',
        assessmentPid: 'PID123',
        authProvider: ['google', 'password'],
        nameFirst: 'Jane',
        nameMiddle: 'M',
        nameLast: 'Smith',
        username: 'jsmith',
        email: 'jane.smith@example.com',
        userType: 'educator',
        dob: '1990-05-15',
        grade: '5',
        schoolLevel: 'elementary',
        statusEll: 'active',
        statusFrl: 'Reduced',
        statusIep: 'yes',
        studentId: 'STU001',
        sisId: 'SIS002',
        stateId: 'STATE003',
        localId: 'LOCAL004',
        gender: 'female',
        race: 'asian',
        hispanicEthnicity: false,
        homeLanguage: 'English',
        isSuperAdmin: false,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-full');

      const data = expectOkResponse(result);
      expect(data).toMatchObject({
        id: 'user-full',
        assessmentPid: 'PID123',
        authProvider: ['google', 'password'],
        nameFirst: 'Jane',
        nameMiddle: 'M',
        nameLast: 'Smith',
        username: 'jsmith',
        email: 'jane.smith@example.com',
        userType: 'educator',
        dob: '1990-05-15',
        grade: '5',
        schoolLevel: 'elementary',
        statusEll: 'active',
        statusFrl: 'Reduced',
        statusIep: 'yes',
        studentId: 'STU001',
        sisId: 'SIS002',
        stateId: 'STATE003',
        localId: 'LOCAL004',
        gender: 'female',
        race: 'asian',
        hispanicEthnicity: false,
        homeLanguage: 'English',
        isSuperAdmin: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });
    });

    it('should handle null optional fields', async () => {
      const mockUser = UserFactory.build({
        id: 'user-minimal',
        nameFirst: null,
        nameMiddle: null,
        nameLast: null,
        username: null,
        email: null,
        dob: null,
        grade: null,
        schoolLevel: null,
        updatedAt: null,
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-minimal');

      const data = expectOkResponse(result);
      expect(data.nameFirst).toBeNull();
      expect(data.nameMiddle).toBeNull();
      expect(data.nameLast).toBeNull();
      expect(data.username).toBeNull();
      expect(data.email).toBeNull();
      expect(data.dob).toBeNull();
      expect(data.grade).toBeNull();
      expect(data.schoolLevel).toBeNull();
      expect(data.updatedAt).toBeNull();
    });

    it('should pass auth context and userId to service', async () => {
      const mockUser = UserFactory.build();
      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const authContext = AuthContextFactory.build({ userId: 'requester-123', isSuperAdmin: true });
      await Controller.get(authContext, 'target-user-456');

      expect(mockGetById).toHaveBeenCalledWith(authContext, 'target-user-456');
    });

    it('should return 401 when service throws UNAUTHORIZED ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.UNAUTHORIZED, {
        statusCode: StatusCodes.UNAUTHORIZED,
        code: ApiErrorCode.AUTH_REQUIRED,
      });
      mockGetById.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-456');

      const errorBody = expectErrorResponse(result, StatusCodes.UNAUTHORIZED);
      expect(errorBody.message).toBe(ApiErrorMessage.UNAUTHORIZED);
      expect(errorBody.code).toBe(ApiErrorCode.AUTH_REQUIRED);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should return 403 when service throws FORBIDDEN ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.FORBIDDEN, {
        statusCode: StatusCodes.FORBIDDEN,
        code: ApiErrorCode.AUTH_FORBIDDEN,
      });
      mockGetById.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-456');

      const errorBody = expectErrorResponse(result, StatusCodes.FORBIDDEN);
      expect(errorBody.message).toBe(ApiErrorMessage.FORBIDDEN);
      expect(errorBody.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should return 404 when service throws NOT_FOUND ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
      });
      mockGetById.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'non-existent-user');

      const errorBody = expectErrorResponse(result, StatusCodes.NOT_FOUND);
      expect(errorBody.message).toBe(ApiErrorMessage.NOT_FOUND);
      expect(errorBody.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should return 500 when service throws INTERNAL_SERVER_ERROR ApiError', async () => {
      const error = new ApiError(ApiErrorMessage.INTERNAL_SERVER_ERROR, {
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        code: ApiErrorCode.DATABASE_QUERY_FAILED,
      });
      mockGetById.mockRejectedValue(error);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(mockAuthContext, 'user-456');

      const errorBody = expectErrorResponse(result, StatusCodes.INTERNAL_SERVER_ERROR);
      expect(errorBody.message).toBe(ApiErrorMessage.INTERNAL_SERVER_ERROR);
      expect(errorBody.code).toBe(ApiErrorCode.DATABASE_QUERY_FAILED);
      expect(errorBody.traceId).toBeDefined();
    });

    it('should rethrow non-ApiError exceptions', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockGetById.mockRejectedValue(unexpectedError);

      const { UsersController: Controller } = await import('./users.controller');

      await expect(Controller.get(mockAuthContext, 'user-456')).rejects.toThrow('Unexpected error');
    });

    it('should handle user accessing their own profile (self-access)', async () => {
      const authContext = AuthContextFactory.build({ userId: 'self-user-123', isSuperAdmin: false });
      const mockUser = UserFactory.build({
        id: 'self-user-123',
        nameFirst: 'Self',
        nameLast: 'User',
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(authContext, 'self-user-123');

      const data = expectOkResponse(result);
      expect(data.id).toBe('self-user-123');
      expect(mockGetById).toHaveBeenCalledWith(authContext, 'self-user-123');
    });

    it('should handle super admin accessing any user', async () => {
      const authContext = AuthContextFactory.build({ userId: 'admin-123', isSuperAdmin: true });
      const mockUser = UserFactory.build({
        id: 'any-user-456',
        nameFirst: 'Any',
        nameLast: 'User',
      });

      mockGetById.mockResolvedValue(mockUser);

      const { UsersController: Controller } = await import('./users.controller');

      const result = await Controller.get(authContext, 'any-user-456');

      const data = expectOkResponse(result);
      expect(data.id).toBe('any-user-456');
      expect(mockGetById).toHaveBeenCalledWith(authContext, 'any-user-456');
    });
  });
});
